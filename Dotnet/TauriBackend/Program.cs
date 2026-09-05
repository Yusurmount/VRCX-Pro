using Microsoft.Data.Sqlite;
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

    public static async Task Main()
    {
        var dataDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "VRCX");
        Directory.CreateDirectory(dataDirectory);
        StorageFile = Path.Combine(dataDirectory, "storage.json");
        DatabaseFile = Path.Combine(dataDirectory, "VRCX.sqlite3");
        LoadStorage();

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
        if (request.ClassName.Equals("WebApi", StringComparison.OrdinalIgnoreCase))
            return request.MethodName.Equals("ExecuteJson", StringComparison.OrdinalIgnoreCase)
                ? "{\"status\":0,\"message\":\"\"}"
                : true;
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

    private static async Task<object?> SqliteMethod(string method, JsonElement[] args)
    {
        await using var connection = new SqliteConnection($"Data Source={DatabaseFile}");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = args.FirstOrDefault().GetString() ?? string.Empty;
        if (args.Length > 1 && args[1].ValueKind == JsonValueKind.Object)
            foreach (var parameter in args[1].EnumerateObject()) command.Parameters.AddWithValue(parameter.Name, parameter.Value.ToString());
        if (method.Equals("ExecuteNonQuery", StringComparison.OrdinalIgnoreCase)) return await command.ExecuteNonQueryAsync();
        await using var rows = await command.ExecuteReaderAsync();
        var result = new List<object?[]>();
        while (await rows.ReadAsync()) { var row = new object?[rows.FieldCount]; rows.GetValues(row); result.Add(row); }
        return method.Equals("ExecuteJson", StringComparison.OrdinalIgnoreCase) ? JsonSerializer.Serialize(result, JsonOptions) : result;
    }

    private static object? AppApiMethod(string method, JsonElement[] args) => method.ToLowerInvariant() switch
    {
        "getversion" => "2.2.0",
        "currentlanguage" => "en",
        "currentculture" => "en-US",
        "getzoom" => 1d,
        "setzoom" or "setuseragent" or "desktopnotification" or "flashwindow" or "focuswindow" or "setvr" => true,
        "getclipboard" => string.Empty,
        _ => null
    };

    private static void LoadStorage()
    {
        if (!File.Exists(StorageFile)) return;
        try { foreach (var pair in JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(StorageFile)) ?? []) Storage[pair.Key] = pair.Value; } catch { }
    }
}
