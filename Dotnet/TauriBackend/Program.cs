using Microsoft.Data.Sqlite;
using System.Reflection;
using System.Text.Json;

namespace VRCX.TauriBackend;

internal sealed record RpcRequest(long Id, string ClassName, string MethodName, JsonElement[]? Args);

internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Dictionary<string, string> Storage = new(StringComparer.OrdinalIgnoreCase);
    private static readonly object StorageLock = new();
    private static string StorageFile = string.Empty;
    private static string DatabaseFile = string.Empty;
    private static string UpdateDirectory = string.Empty;
    private static string? StagedUpdaterPath;
    private static object? UpdatingLock;
    private static CancellationTokenSource? UpdateCts;
    private static volatile int UpdateProgress;
    private static volatile string UpdateState = "idle";
    private static volatile string UpdateError = string.Empty;

    // Version is injected at build time from the repository's `Version` file
    // (`-p:Version`), so it stays in sync with the source of truth.
    private static readonly string AppVersion = Assembly.GetExecutingAssembly()
        .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
        ?.InformationalVersion?.Split('+')[0] ?? "1.0.0";
    public static readonly string Version = $"VRCX-Pro {AppVersion}";

    public static string StorageGet(string key)
    {
        lock (StorageLock)
        {
            return Storage.TryGetValue(key, out var value) ? value : string.Empty;
        }
    }

    public static void StorageSet(string key, string value)
    {
        lock (StorageLock)
        {
            Storage[key] = value;
            File.WriteAllText(StorageFile, JsonSerializer.Serialize(Storage, JsonOptions));
        }
    }

    public static async Task Main()
    {
        var dataDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "VRCX");
        Directory.CreateDirectory(dataDirectory);
        StorageFile = Path.Combine(dataDirectory, "storage.json");
        DatabaseFile = Path.Combine(dataDirectory, "VRCX.sqlite3");
        UpdateDirectory = Path.Combine(Path.GetTempPath(), "VRCX", "update");
        UpdatingLock = new object();
        LoadStorage();
        Sqlite.Init(DatabaseFile);
        WebApi.Instance.Init();

        using var reader = new StreamReader(Console.OpenStandardInput());
        await using var writer = new StreamWriter(Console.OpenStandardOutput()) { AutoFlush = true };
        while (await reader.ReadLineAsync() is { } line)
        {
            if (!string.IsNullOrWhiteSpace(line))
                await writer.WriteLineAsync(JsonSerializer.Serialize(await Handle(line), JsonOptions));
        }
    }

    private static async Task<object> Handle(string line)
    {
        try
        {
            var request = JsonSerializer.Deserialize<RpcRequest>(line, JsonOptions)
                ?? throw new InvalidDataException("Request is empty");
            return new { id = request.Id, ok = true, result = await Dispatch(request) };
        }
        catch (Exception error)
        {
            return new { id = 0L, ok = false, error = error.Message };
        }
    }

    private static async Task<object?> Dispatch(RpcRequest request)
    {
        var args = request.Args ?? [];
        if (request.ClassName.Equals("VRCXStorage", StringComparison.OrdinalIgnoreCase)) return StorageMethod(request.MethodName, args);
        if (request.ClassName.Equals("SQLite", StringComparison.OrdinalIgnoreCase)) return await SqliteMethod(request.MethodName, args);
        if (request.ClassName.Equals("AppApi", StringComparison.OrdinalIgnoreCase)) return AppApiMethod(request.MethodName, args);
        if (request.ClassName.Equals("WebApi", StringComparison.OrdinalIgnoreCase)) return await WebApiMethod(request.MethodName, args);
        if (request.ClassName.Equals("LogWatcher", StringComparison.OrdinalIgnoreCase)) return request.MethodName.Equals("Get", StringComparison.OrdinalIgnoreCase) ? Array.Empty<object>() : true;
        if (request.ClassName.Equals("Discord", StringComparison.OrdinalIgnoreCase) || request.ClassName.Equals("AssetBundleManager", StringComparison.OrdinalIgnoreCase)) return true;
        return null;
    }

    private static object? StorageMethod(string method, JsonElement[] args)
    {
        var key = args.FirstOrDefault().ValueKind == JsonValueKind.String ? args[0].GetString() ?? string.Empty : string.Empty;
        lock (StorageLock)
        {
            return method.ToLowerInvariant() switch
            {
                "get" => Storage.TryGetValue(key, out var value) ? value : null,
                "set" => SetStorage(key, args.ElementAtOrDefault(1)),
                "remove" => Storage.Remove(key),
                "getall" => JsonSerializer.Serialize(Storage, JsonOptions),
                "save" or "flush" or "load" => true,
                _ => null
            };
        }
    }

    private static bool SetStorage(string key, JsonElement value)
    {
        Storage[key] = value.ValueKind == JsonValueKind.String ? value.GetString() ?? string.Empty : value.GetRawText();
        File.WriteAllText(StorageFile, JsonSerializer.Serialize(Storage, JsonOptions));
        return true;
    }

    /// <summary>
    /// Converts a JSON parameter value to its proper CLR type. Binding every
    /// argument as a raw string (JsonElement.ToString()) breaks SQLite type
    /// affinity for INTEGER/REAL/NULL columns and causes "datatype mismatch"
    /// / silent write failures during DB import. Nulls map to DBNull so the
    /// parameter is treated as NULL rather than the literal text "null".
    /// </summary>
    private static object? ToClrValue(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.Null => DBNull.Value,
        JsonValueKind.True => 1,
        JsonValueKind.False => 0,
        JsonValueKind.Number when el.TryGetInt64(out var l) => l,
        JsonValueKind.Number when el.TryGetDouble(out var d) => d,
        JsonValueKind.String => el.GetString(),
        _ => el.GetRawText()
    };
    private static bool ValidateSql(string sql)
    {
        if (string.IsNullOrWhiteSpace(sql)) return false;
        var upper = sql.TrimStart().ToUpperInvariant();
        return StartsWithAllowedKeyword(upper) && !HasDangerousPattern(upper);
    }

    private static bool StartsWithAllowedKeyword(string sql)
    {
        string[] single = ["SELECT", "INSERT", "UPDATE", "DELETE", "PRAGMA", "BEGIN", "COMMIT", "ROLLBACK", "VACUUM", "WITH"];
        foreach (var kw in single)
            if (StartsWithKeyword(sql, kw)) return true;
        string[] multi = ["CREATE TABLE", "CREATE INDEX", "ALTER TABLE", "DROP TABLE"];
        foreach (var kw in multi)
            if (sql.Length >= kw.Length && sql.StartsWith(kw, StringComparison.Ordinal) &&
                (sql.Length == kw.Length || !char.IsAsciiLetter(sql[kw.Length])))
                return true;
        return false;
    }

    private static bool StartsWithKeyword(string sql, string keyword)
    {
        if (!sql.StartsWith(keyword, StringComparison.Ordinal)) return false;
        return sql.Length == keyword.Length || !char.IsAsciiLetter(sql[keyword.Length]);
    }

    private static bool HasDangerousPattern(string sql)
    {
        string[] patterns = ["ATTACH", "DETACH", "LOAD_EXTENSION", "WRITABLE_SCHEMA"];
        foreach (var p in patterns)
            if (HasWord(sql, p)) return true;
        return false;
    }

    private static bool HasWord(string text, string word)
    {
        int pos = 0;
        while (pos <= text.Length - word.Length)
        {
            int idx = text.IndexOf(word, pos, StringComparison.Ordinal);
            if (idx < 0) return false;
            bool before = idx == 0 || !char.IsAsciiLetter(text[idx - 1]);
            bool after = idx + word.Length >= text.Length || !char.IsAsciiLetter(text[idx + word.Length]);
            if (before && after) return true;
            pos = idx + 1;
        }
        return false;
    }

    private static async Task<object?> SqliteMethod(string method, JsonElement[] args)
    {
        var sql = args.FirstOrDefault().GetString() ?? string.Empty;
        if (!ValidateSql(sql))
            throw new InvalidOperationException("SQL validation failed: statement type not allowed or contains dangerous patterns");
        IDictionary<string, object>? sqlArgs = null;
        if (args.Length > 1 && args[1].ValueKind == JsonValueKind.Object)
        {
            sqlArgs = new Dictionary<string, object>();
            foreach (var parameter in args[1].EnumerateObject())
                sqlArgs[parameter.Name] = ToClrValue(parameter.Value);
        }
        if (method.Equals("ExecuteNonQuery", StringComparison.OrdinalIgnoreCase))
            return Sqlite.ExecuteNonQuery(sql, sqlArgs);
        var result = Sqlite.Execute(sql, sqlArgs);
        return method.Equals("ExecuteJson", StringComparison.OrdinalIgnoreCase) ? JsonSerializer.Serialize(result, JsonOptions) : result;
    }

    private static object? AppApiMethod(string method, JsonElement[] args) => method.ToLowerInvariant() switch
    {
        "getversion" => AppVersion,
        "currentlanguage" => "en",
        "currentculture" => "en-US",
        "getzoom" => 1d,
        "setzoom" or "setuseragent" or "desktopnotification" or "flashwindow" or "focuswindow" => true,
        "sendemail" => EmailNotification.SendEmail(args.ElementAtOrDefault(0)).GetAwaiter().GetResult(),
        "setvr" or "executevroverlayfunction" => true,
        "getclipboard" => string.Empty,
        "machineencrypt" => Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(args.FirstOrDefault().ToString())),
        "machinedecrypt" => Decode(args.FirstOrDefault().ToString()),
        "setstartup" => SetStartup(args),
        "downloadupdate" => StartUpdateDownload(args),
        "checkupdateprogress" => CheckUpdateProgress(),
        "getupdatestatus" => GetUpdateStatus(),
        "cancelupdate" => CancelUpdate(),
        "restartapplication" => RestartApplication(),
        "readconfigfile" => ReadConfigFileSafe(),
        "readconfigfilesafe" => ReadConfigFileSafe(),
        "getvrchatappdatalocation" => GetVrChatAppDataFolder(),
        "getvrchatphotoslocation" => GetVrChatPhotosFolder(),
        "getvrchatscreenshotslocation" => GetVrChatScreenshotsFolder(),
        "getvrchatcachelocation" => GetVrChatCacheFolder(),
        "openvrcxappdatafolder" => OpenExplorerFolder(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "VRCX")),
        "openvrcappdatafolder" => OpenExplorerFolder(GetVrChatAppDataFolder()),
        "openvrcphotosfolder" => OpenExplorerFolder(GetVrChatPhotosFolder()),
        "openvrcscreenshotsfolder" => OpenExplorerFolder(GetVrChatScreenshotsFolder()),
        "opencrashvrccrashdumps" => OpenExplorerFolder(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CrashDumps")),
        "openfolderandselectitem" => OpenFolderAndSelectItem(args),
        "openuvcphotosfolder" => OpenExplorerFolder(args.FirstOrDefault().ValueKind == JsonValueKind.String ? args[0].GetString() ?? GetVrChatPhotosFolder() : GetVrChatPhotosFolder()),
        "openfolderselectordialog" => OpenFolderSelectorDialog(args),
        "openfileselectordialog" => OpenFileSelectorDialog(args),
        "savefileselectordialog" => SaveFileSelectorDialog(args),
        _ => null
    };

    private static async Task<object?> WebApiMethod(string method, JsonElement[] args)
    {
        var arg = args.Length > 0 ? args[0] : default;
        switch (method.ToLowerInvariant())
        {
            case "executejson": return await WebApi.Instance.ExecuteJson(arg.ValueKind == JsonValueKind.String ? arg.GetString() ?? "{}" : "{}");
            case "getcookies": return WebApi.Instance.GetCookies();
            case "setcookies": WebApi.Instance.SetCookies(arg.ValueKind == JsonValueKind.String ? arg.GetString() ?? string.Empty : string.Empty); return true;
            case "clearcookies": WebApi.Instance.ClearCookies(); return true;
            case "savecookies": WebApi.Instance.SaveCookies(); return true;
            default: return true;
        }
    }

    private static bool SetStartup(JsonElement[] args)
    {
        try
        {
            using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Run", writable: true);
            if (key is null) return false;

            var enabled = args.ElementAtOrDefault(0).ValueKind == JsonValueKind.True ||
                          (args.ElementAtOrDefault(0).ValueKind == JsonValueKind.String &&
                           bool.TryParse(args.ElementAtOrDefault(0).GetString(), out var v) && v);
            if (enabled)
            {
                var app = Environment.GetEnvironmentVariable("VRCX_APP_EXE");
                if (string.IsNullOrWhiteSpace(app)) return false;
                key.SetValue("VRCX-Pro", $"\"{app}\"", Microsoft.Win32.RegistryValueKind.String);
            }
            else
            {
                key.DeleteValue("VRCX-Pro", throwOnMissingValue: false);
            }
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool StartUpdateDownload(JsonElement[] args)
    {
        var url = args.ElementAtOrDefault(0).GetString();
        var hash = args.ElementAtOrDefault(1).GetString();
        var sizeElement = args.ElementAtOrDefault(2);
        var expectedSize = sizeElement.ValueKind == JsonValueKind.Number
            ? sizeElement.GetInt64()
            : 0;
        if (string.IsNullOrWhiteSpace(url)) return false;

        lock (UpdatingLock!)
        {
            if (UpdateCts is not null) return false;
            StagedUpdaterPath = null;
            UpdateCts = new CancellationTokenSource();
            UpdateProgress = 0;
            UpdateState = "downloading";
            UpdateError = string.Empty;
        }
        var cts = UpdateCts!;
        _ = Task.Run(async () =>
        {
            var progress = 0;
            string? targetPath = null;
            try
            {
                Directory.CreateDirectory(UpdateDirectory);
                using var client = new HttpClient
                {
                    Timeout = TimeSpan.FromMinutes(15)
                };
                using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cts.Token);
                response.EnsureSuccessStatusCode();
                var total = response.Content.Headers.ContentLength ?? expectedSize;
                var fileName = Path.GetFileName(new Uri(url).AbsolutePath);
                if (string.IsNullOrWhiteSpace(fileName)) fileName = "update.exe";
                var target = Path.Combine(UpdateDirectory, fileName);
                targetPath = target;
                long totalBytesRead = 0;
                await using var source = await response.Content.ReadAsStreamAsync(cts.Token);
                await using (var destination = File.Create(target))
                {
                    var buffer = new byte[81920];
                    int bytes;
                    while ((bytes = await source.ReadAsync(buffer, cts.Token)) > 0)
                    {
                        await destination.WriteAsync(buffer.AsMemory(0, bytes), cts.Token);
                        totalBytesRead += bytes;
                        if (total > 0 && totalBytesRead < total)
                        {
                            var percent = (int)(totalBytesRead * 100 / total);
                            if (percent != progress) { progress = percent; UpdateProgress = progress; }
                        }
                        else
                        {
                            progress = 99; UpdateProgress = progress;
                        }
                    }
                }
                if (total > 0 && totalBytesRead != total)
                {
                    throw new InvalidDataException(
                        $"Incomplete update download: received {totalBytesRead} of {total} bytes");
                }
                if (expectedSize > 0 && totalBytesRead != expectedSize)
                {
                    throw new InvalidDataException(
                        $"Unexpected update size: received {totalBytesRead} of {expectedSize} bytes");
                }
                if (!string.IsNullOrWhiteSpace(hash))
                {
                    var actual = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(await File.ReadAllBytesAsync(target, cts.Token))).ToLowerInvariant();
                    if (!string.Equals(actual, hash, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Update hash mismatch");
                }
                StagedUpdaterPath = target;
                UpdateProgress = 100;
                UpdateState = "complete";
            }
            catch (OperationCanceledException)
            {
                UpdateProgress = 0;
                UpdateState = "canceled";
                UpdateError = "Update download canceled.";
            }
            catch (Exception error)
            {
                UpdateProgress = 0;
                UpdateState = "error";
                UpdateError = error.Message;
            }
            finally
            {
                try
                {
                    if (UpdateState is "error" or "canceled" &&
                        targetPath is string target && File.Exists(target))
                    {
                        File.Delete(target);
                    }
                    if (UpdateState is "error" or "canceled") StagedUpdaterPath = null;
                }
                catch { }
                if (ReferenceEquals(UpdateCts, cts)) { UpdateCts?.Dispose(); UpdateCts = null; }
            }
        });
        return true;
    }

    private static int CheckUpdateProgress() => UpdateProgress;

    private static object GetUpdateStatus() => new
    {
        state = UpdateState,
        progress = UpdateProgress,
        error = UpdateError
    };

    private static bool CancelUpdate()
    {
        lock (UpdatingLock!)
        {
            UpdateCts?.Cancel();
            UpdateState = "canceled";
            UpdateError = "Update download canceled.";
        }
        UpdateProgress = 0;
        return true;
    }


    private static string ReadVrChatConfigValue(string key)
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var appDataParent = Path.GetDirectoryName(appData) ?? appData;
        var configPath = Path.Combine(appDataParent, "LocalLow", "VRChat", "VRChat", "config.json");
        if (!File.Exists(configPath)) return string.Empty;
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(configPath));
            if (doc.RootElement.TryGetProperty(key, out var prop) && prop.ValueKind == JsonValueKind.String)
                return prop.GetString() ?? string.Empty;
        }
        catch { }
        return string.Empty;
    }

    private static string GetVrChatAppDataFolder()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var appDataParent = Path.GetDirectoryName(appData) ?? appData;
        return Path.Combine(appDataParent, "LocalLow", "VRChat", "VRChat");
    }

    private static string GetVrChatPhotosFolder()
    {
        var customPath = ReadVrChatConfigValue("picture_output_folder");
        if (!string.IsNullOrWhiteSpace(customPath))
        {
            var expanded = Environment.ExpandEnvironmentVariables(customPath);
            if (Directory.Exists(expanded)) return expanded;
        }
        var myPictures = Environment.GetFolderPath(Environment.SpecialFolder.MyPictures);
        var vrchatPictures = Path.Combine(myPictures, "VRChat");
        if (Directory.Exists(vrchatPictures)) return vrchatPictures;
        return Path.Combine(GetVrChatAppDataFolder(), "UgcPhotos");
    }

    private static string GetVrChatScreenshotsFolder()
    {
        var screenshotsDir = Path.Combine(GetVrChatAppDataFolder(), "Screenshots");
        if (Directory.Exists(screenshotsDir)) return screenshotsDir;
        return GetVrChatPhotosFolder();
    }

    private static string GetVrChatCacheFolder()
    {
        return Path.Combine(GetVrChatAppDataFolder(), "CacheW");
    }

    private static bool OpenExplorerFolder(string path)
    {
        if (!OperatingSystem.IsWindows()) return false;
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = path,
                UseShellExecute = true
            });
            return true;
        }
        catch { return false; }
    }

    private static bool OpenFolderAndSelectItem(JsonElement[] args)
    {
        if (!OperatingSystem.IsWindows()) return false;
        var path = args.FirstOrDefault().ValueKind == JsonValueKind.String ? args[0].GetString() ?? string.Empty : string.Empty;
        if (string.IsNullOrWhiteSpace(path)) return false;
        var isFolder = args.ElementAtOrDefault(1).ValueKind == JsonValueKind.True;
        if (isFolder)
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = path,
                UseShellExecute = true
            });
        }
        else
        {
            if (!File.Exists(path)) return false;
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = "explorer.exe",
                Arguments = $"/select,\"{path}\"",
                UseShellExecute = true
            });
        }
        return true;
    }

    private static string OpenFolderSelectorDialog(JsonElement[] args) => string.Empty;
    private static string OpenFileSelectorDialog(JsonElement[] args) => string.Empty;
    private static string SaveFileSelectorDialog(JsonElement[] args) => string.Empty;

    private static string ReadConfigFileSafe()
    {
        var configPath = Path.Combine(GetVrChatAppDataFolder(), "config.json");
        if (!File.Exists(configPath)) return "{}";
        try { return File.ReadAllText(configPath); } catch { return "{}"; }
    }

    private static object? RestartApplication()
    {
        if (!OperatingSystem.IsWindows()) return null;
        lock (UpdatingLock!)
        {
            if (UpdateState != "complete") return false;
            if (StagedUpdaterPath is not string staged || !File.Exists(staged)) return false;
            var process = System.Diagnostics.Process.Start(
                new System.Diagnostics.ProcessStartInfo
                {
                    UseShellExecute = true,
                    FileName = staged
                });
            if (process is null) return false;
            UpdateState = "installing";
            return true;
        }
    }

    private static string Decode(string value)
    {
        try { return System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(value)); }
        catch { return value; }
    }

    private static void LoadStorage()
    {
        if (!File.Exists(StorageFile)) return;
        try { foreach (var pair in JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(StorageFile)) ?? []) Storage[pair.Key] = pair.Value; } catch { }
    }
}
