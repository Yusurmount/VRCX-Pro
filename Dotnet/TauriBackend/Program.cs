using System.Text.Json;

namespace VRCX.TauriBackend;

internal sealed record RpcRequest(
    long Id,
    string ClassName,
    string MethodName,
    JsonElement[]? Args
);

internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static async Task Main()
    {
        await using var input = Console.OpenStandardInput();
        using var reader = new StreamReader(input);
        await using var output = Console.OpenStandardOutput();
        await using var writer = new StreamWriter(output) { AutoFlush = true };

        while (await reader.ReadLineAsync() is { } line)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;

            try
            {
                var request = JsonSerializer.Deserialize<RpcRequest>(line, JsonOptions)
                    ?? throw new InvalidDataException("Request is empty");
                var response = new
                {
                    id = request.Id,
                    ok = false,
                    error = $"Backend method is not migrated yet: {request.ClassName}.{request.MethodName}"
                };
                await writer.WriteLineAsync(JsonSerializer.Serialize(response, JsonOptions));
            }
            catch (Exception error)
            {
                var response = new { id = 0, ok = false, error = error.Message };
                await writer.WriteLineAsync(JsonSerializer.Serialize(response, JsonOptions));
            }
        }
    }
}
