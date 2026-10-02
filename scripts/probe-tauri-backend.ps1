param(
    [string]$Project = "Dotnet/TauriBackend/VRCX-TauriBackend.csproj"
)

$requests = @(
    '{"id":1,"className":"VRCXStorage","methodName":"Set","args":["tauri_probe","ok"]}',
    '{"id":2,"className":"VRCXStorage","methodName":"Get","args":["tauri_probe"]}',
    '{"id":3,"className":"SQLite","methodName":"ExecuteNonQuery","args":["CREATE TABLE IF NOT EXISTS tauri_probe (value TEXT)",null]}',
    '{"id":4,"className":"WebApi","methodName":"ExecuteJson","args":["{}"]}'
)

$output = $requests | dotnet run --project $Project --no-restore
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
# Responses may arrive out of order now that requests dispatch concurrently;
# normalize by id before asserting. Assert on Set's own result rather than Get
# observing Set's write — concurrent dispatch does not guarantee their order.
$responses = @($output | ForEach-Object { $_ | ConvertFrom-Json } | Sort-Object id)
if ($responses.Count -ne 4 -or $responses[0].result -ne $true -or $responses[1].ok -ne $true -or $responses[2].ok -ne $true) {
    throw "Tauri backend probe failed"
}
Write-Output "Tauri backend probe passed."
