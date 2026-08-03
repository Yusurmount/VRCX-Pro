using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using VRCX;

namespace VRCX.Sidecar
{
    /// <summary>
    /// VRCX-Pro Tauri sidecar entry point.
    ///
    /// Runs the existing VRCX .NET backend as an independent process and
    /// exposes it over a line-delimited JSON-RPC protocol on stdin/stdout:
    ///
    ///   Request:  {"id":1,"className":"SQLite","methodName":"ExecuteJson","args":["SELECT 1",{}]}
    ///   Response: {"id":1,"result":"..."}   or   {"id":1,"error":"..."}
    ///
    /// Events are intentionally NOT pushed here: LogWatcher / VR overlay queues
    /// are consumed by the frontend via polling (same as the Electron build),
    /// while window/tray/system events are emitted by the Tauri host process.
    /// </summary>
    public static class SidecarProgram
    {
        public static int Main(string[] args)
        {
            try
            {
                var program = new ProgramElectron();
                program.PreInit(GetVersion(), args);

                // Mirrors src-electron/main.js startup sequence:
                // VRCXStorage.Load -> Program.Init (AppApi + VR) -> SQLite -> AppApi.Init
                // -> Discord -> WebApi -> LogWatcher
                VRCXStorage.Instance.Load();
                program.Init();
                SQLite.Instance.Init();
                Program.AppApiInstance.Init();
                Discord.Instance.Init();
                WebApi.Instance.Init();
                LogWatcher.Instance.Init();

                // Register the ProgramElectron instance used above so that
                // callDotNetMethod('ProgramElectron', ...) keeps working.
                SidecarBridge.RegisterInstance("ProgramElectron", program);

                using (var stdin = Console.OpenStandardInput())
                using (var stdout = Console.OpenStandardOutput())
                using (var reader = new StreamReader(stdin, new UTF8Encoding(false), false, 1 << 16))
                using (var writer = new StreamWriter(stdout, new UTF8Encoding(false)) { AutoFlush = true })
                {
                    // Process each request concurrently so a slow call (e.g. a
                    // blocking network request in WebApi) never stalls the rest
                    // of the queue. Responses are matched by "id" on the Rust
                    // side, so out-of-order replies are fine (same concurrent
                    // model the Electron build had via async .NET bridging).
                    var writeLock = new object();
                    string? line;
                    while ((line = reader.ReadLine()) != null)
                    {
                        if (string.IsNullOrWhiteSpace(line))
                            continue;

                        var request = line;
                        Task.Run(async () =>
                        {
                            var response = await SidecarBridge.HandleRequestAsync(request);
                            var json = JsonSerializer.Serialize(response);
                            lock (writeLock)
                            {
                                writer.WriteLine(json);
                            }
                        });
                    }
                }

                // Shutdown sequence (mirrors Electron main.js on-exit cleanup).
                WebApi.Instance.SaveCookies();
                LogWatcher.Instance.Exit();
                WebApi.Instance.Exit();
                Discord.Instance.Exit();
                VRCXStorage.Instance.Save();
                SQLite.Instance.Exit();
                return 0;
            }
            catch (Exception e)
            {
                Console.Error.WriteLine(e);
                return 1;
            }
        }

        private static string GetVersion()
        {
            try
            {
                var versionFile = File.ReadAllText(
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Version")
                ).Trim();
                return $"VRCX-Pro {versionFile}";
            }
            catch
            {
                return "VRCX-Pro";
            }
        }
    }
}
