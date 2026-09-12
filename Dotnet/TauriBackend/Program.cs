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

    private static async Task<object?> SqliteMethod(string method, JsonElement[] args)
    {
        await using var connection = new SqliteConnection($"Data Source={DatabaseFile}");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = args.FirstOrDefault().GetString() ?? string.Empty;
        if (args.Length > 1 && args[1].ValueKind == JsonValueKind.Object)
            foreach (var parameter in args[1].EnumerateObject()) command.Parameters.AddWithValue(parameter.Name, ToClrValue(parameter.Value));
        if (method.Equals("ExecuteNonQuery", StringComparison.OrdinalIgnoreCase)) return await command.ExecuteNonQueryAsync();
        await using var rows = await command.ExecuteReaderAsync();
        var result = new List<object?[]>();
        while (await rows.ReadAsync()) { var row = new object?[rows.FieldCount]; rows.GetValues(row); result.Add(row); }
        return method.Equals("ExecuteJson", StringComparison.OrdinalIgnoreCase) ? JsonSerializer.Serialize(result, JsonOptions) : result;
    }

    private static object? AppApiMethod(string method, JsonElement[] args) => method.ToLowerInvariant() switch
    {
        "getversion" => AppVersion,
        "currentlanguage" => "en",
        "currentculture" => "en-US",
        "getzoom" => 1d,
        "setzoom" or "setuseragent" or "desktopnotification" or "flashwindow" or "focuswindow" => true,
        "setvr" or "executevroverlayfunction" => true,
        "getclipboard" => string.Empty,
        "machineencrypt" => Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(args.FirstOrDefault().ToString())),
        "machinedecrypt" => Decode(args.FirstOrDefault().ToString()),
        "setstartup" => SetStartup(args),
        "downloadupdate" => StartUpdateDownload(args),
        "checkupdateprogress" => CheckUpdateProgress(),
        "cancelupdate" => CancelUpdate(),
        "restartapplication" => RestartApplication(),
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
        if (string.IsNullOrWhiteSpace(url)) return false;

        lock (UpdatingLock!) { UpdateCts = new CancellationTokenSource(); UpdateProgress = 0; }
        var cts = UpdateCts!;
        _ = Task.Run(async () =>
        {
            var progress = 0;
            try
            {
                Directory.CreateDirectory(UpdateDirectory);
                using var client = new HttpClient();
                using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cts.Token);
                response.EnsureSuccessStatusCode();
                var total = response.Content.Headers.ContentLength ?? 0;
                var fileName = Path.GetFileName(new Uri(url).AbsolutePath);
                if (string.IsNullOrWhiteSpace(fileName)) fileName = "update.exe";
                var target = Path.Combine(UpdateDirectory, fileName);
                await using var source = await response.Content.ReadAsStreamAsync(cts.Token);
                await using (var destination = File.Create(target))
                {
                    var buffer = new byte[81920];
                    long read = 0;
                    int bytes;
                    while ((bytes = await source.ReadAsync(buffer, cts.Token)) > 0)
                    {
                        await destination.WriteAsync(buffer.AsMemory(0, bytes), cts.Token);
                        read += bytes;
                        if (total > 0 && read < total)
                        {
                            var percent = (int)(read * 100 / total);
                            if (percent != progress) { progress = percent; UpdateProgress = progress; }
                        }
                        else
                        {
                            progress = 99; UpdateProgress = progress;
                        }
                    }
                }
                if (!string.IsNullOrWhiteSpace(hash))
                {
                    var actual = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(await File.ReadAllBytesAsync(target, cts.Token))).ToLowerInvariant();
                    if (!string.Equals(actual, hash, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Update hash mismatch");
                }
                StagedUpdaterPath = target;
                UpdateProgress = 100;
            }
            catch (Exception)
            {
                try { if (StagedUpdaterPath is string staged && File.Exists(staged)) File.Delete(staged); StagedUpdaterPath = null; } catch { }
                UpdateProgress = 0;
            }
            finally
            {
                if (ReferenceEquals(UpdateCts, cts)) { UpdateCts?.Dispose(); UpdateCts = null; }
            }
        }, cts.Token);
        return true;
    }

    private static int CheckUpdateProgress() => UpdateProgress;

    private static bool CancelUpdate()
    {
        lock (UpdatingLock!) { UpdateCts?.Cancel(); }
        UpdateProgress = 0;
        return true;
    }

    private static object? RestartApplication()
    {
        if (!OperatingSystem.IsWindows()) return null;
        lock (UpdatingLock!) if (StagedUpdaterPath is string staged && File.Exists(staged))
            return System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { UseShellExecute = true, FileName = staged }) != null;
        return false;
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
