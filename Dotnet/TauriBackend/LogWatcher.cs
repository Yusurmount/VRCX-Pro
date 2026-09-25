using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace VRCX.TauriBackend;

internal sealed partial class LogWatcher
{
    private readonly object _lock = new();
    private readonly Dictionary<string, LogContext> _contexts = new(StringComparer.OrdinalIgnoreCase);
    private readonly Queue<string[]> _pending = new();
    private string _logDirectory = string.Empty;
    private DateTime _tillDate = DateTime.MinValue;
    private bool _dateSet;
    private bool _initialized;

    public void SetDateTill(string date)
    {
        var dateParsed = DateTime.TryParse(
            date,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal,
            out var value
        );

        lock (_lock)
        {
            _tillDate = dateParsed ? value : DateTime.MinValue;
            _dateSet = dateParsed;
            _contexts.Clear();
            _pending.Clear();
        }
    }

    public void Reset()
    {
        lock (_lock)
        {
            _contexts.Clear();
            _pending.Clear();
            _dateSet = false;
        }
    }

    public string[][] Get()
    {
        lock (_lock)
        {
            Update();

            if (_pending.Count == 0)
                return [];

            var count = Math.Min(_pending.Count, 1000);
            var items = new string[count][];
            for (var index = 0; index < count; index++)
                items[index] = _pending.Dequeue();
            return items;
        }
    }

    public bool IsProcessRunning(string processName)
    {
        try
        {
            var processes = System.Diagnostics.Process.GetProcessesByName(processName);
            var isRunning = processes.Length > 0;
            foreach (var process in processes)
                process.Dispose();
            return isRunning;
        }
        catch
        {
            return false;
        }
    }

    public void Init(string logDirectory)
    {
        lock (_lock)
        {
            _logDirectory = logDirectory;
            _initialized = true;
        }
    }

    private void Update()
    {
        if (!_dateSet || !_initialized || string.IsNullOrWhiteSpace(_logDirectory) || !Directory.Exists(_logDirectory))
            return;

        var files = new DirectoryInfo(_logDirectory)
            .GetFiles("output_log_*.txt", SearchOption.TopDirectoryOnly)
            .OrderBy(file => file.CreationTimeUtc)
            .ToArray();
        var activeFiles = new HashSet<string>(files.Select(file => file.Name), StringComparer.OrdinalIgnoreCase);

        foreach (var staleFile in _contexts.Keys.Where(name => !activeFiles.Contains(name)).ToArray())
            _contexts.Remove(staleFile);

        foreach (var file in files)
        {
            if (!_contexts.TryGetValue(file.Name, out var context))
            {
                context = new LogContext();
                _contexts[file.Name] = context;
            }

            if (file.Length < context.Position)
                context.Position = 0;
            if (file.Length == context.Position)
                continue;

            ReadNewLines(file, context);
        }
    }

    private void ReadNewLines(FileInfo file, LogContext context)
    {
        try
        {
            using var stream = new FileStream(
                file.FullName,
                FileMode.Open,
                FileAccess.Read,
                FileShare.ReadWrite,
                65536,
                FileOptions.SequentialScan
            );
            stream.Position = context.Position;
            using var reader = new StreamReader(stream, Encoding.UTF8);

            while (reader.ReadLine() is { } line)
            {
                if (!TryParseLogLine(line, out var lineDate))
                    continue;
                if (lineDate <= _tillDate || DateTime.UtcNow.AddMinutes(61) < lineDate)
                    continue;
                if (line.Length <= 34)
                    continue;

                ParseLogLine(file.Name, line, context, lineDate);
            }

            context.Position = stream.Position;
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private void ParseLogLine(string fileName, string line, LogContext context, DateTime lineDate)
    {
        if (line.Contains("[Behaviour] Entering Room: ", StringComparison.Ordinal))
        {
            var marker = "] Entering Room: ";
            var markerIndex = line.LastIndexOf(marker, StringComparison.Ordinal);
            if (markerIndex >= 0)
                context.RecentWorldName = line[(markerIndex + marker.Length)..];
            return;
        }

        if (line.Contains("[Behaviour] Joining ", StringComparison.Ordinal) &&
            !line.Contains("] Joining or Creating Room: ", StringComparison.Ordinal) &&
            !line.Contains("] Joining friend: ", StringComparison.Ordinal))
        {
            var marker = "] Joining ";
            var markerIndex = line.LastIndexOf(marker, StringComparison.Ordinal);
            if (markerIndex < 0)
                return;
            var location = CleanLocation().Replace(line[(markerIndex + marker.Length)..], string.Empty);
            Enqueue(fileName, lineDate, "location", location, context.RecentWorldName);
            return;
        }

        if (line.Contains("[Behaviour] Destination fetching: ", StringComparison.Ordinal))
        {
            var marker = "] Destination fetching: ";
            var markerIndex = line.LastIndexOf(marker, StringComparison.Ordinal);
            if (markerIndex >= 0)
                context.LocationDestination = CleanLocation().Replace(
                    line[(markerIndex + marker.Length)..],
                    string.Empty
                );
            return;
        }

        if (line.Contains("[Behaviour] OnLeftRoom", StringComparison.Ordinal))
        {
            if (!string.IsNullOrEmpty(context.LocationDestination))
            {
                Enqueue(
                    fileName,
                    lineDate,
                    "location-destination",
                    context.LocationDestination
                );
                context.LocationDestination = string.Empty;
            }
            return;
        }

        if (line.Contains("[Behaviour] OnPlayerJoined", StringComparison.Ordinal) &&
            !line.Contains("] OnPlayerJoined:", StringComparison.Ordinal))
        {
            var (displayName, userId) = ParsePlayerEvent(line, "] OnPlayerJoined");
            if (!string.IsNullOrEmpty(displayName) || !string.IsNullOrEmpty(userId))
                Enqueue(fileName, lineDate, "player-joined", displayName, userId);
            return;
        }

        if (line.Contains("[Behaviour] OnPlayerLeft", StringComparison.Ordinal) &&
            !line.Contains("] OnPlayerLeftRoom", StringComparison.Ordinal) &&
            !line.Contains("] OnPlayerLeft:", StringComparison.Ordinal))
        {
            var (displayName, userId) = ParsePlayerEvent(line, "] OnPlayerLeft");
            if (!string.IsNullOrEmpty(displayName) || !string.IsNullOrEmpty(userId))
                Enqueue(fileName, lineDate, "player-left", displayName, userId);
            return;
        }

        if (line.Contains("VRCApplication: OnApplicationQuit at ", StringComparison.Ordinal) ||
            line.Contains("VRCApplication: HandleApplicationQuit at ", StringComparison.Ordinal))
        {
            Enqueue(fileName, lineDate, "vrc-quit");
        }
    }

    private void Enqueue(string fileName, DateTime lineDate, params string[] values)
    {
        var item = new string[values.Length + 2];
        item[0] = fileName;
        item[1] = lineDate.ToString(
            "yyyy'-'MM'-'dd'T'HH':'mm':'ss'.'fff'Z'",
            CultureInfo.InvariantCulture
        );
        values.CopyTo(item, 2);
        _pending.Enqueue(item);
    }

    private static bool TryParseLogLine(string line, out DateTime lineDate)
    {
        lineDate = default;
        if (line.Length < 19)
            return false;
        if (!DateTime.TryParseExact(
                line[..19],
                "yyyy.MM.dd HH:mm:ss",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var localDate
            ))
        {
            return false;
        }

        lineDate = localDate.ToUniversalTime();
        return true;
    }

    private static (string DisplayName, string UserId) ParsePlayerEvent(string line, string marker)
    {
        var markerIndex = line.LastIndexOf(marker, StringComparison.Ordinal);
        if (markerIndex < 0)
            return (string.Empty, string.Empty);

        var userInfo = line[(markerIndex + marker.Length)..].TrimStart();
        var userIdStart = userInfo.LastIndexOf(" (", StringComparison.Ordinal);
        if (userIdStart < 0)
            return (userInfo, string.Empty);

        var userIdEnd = userInfo.LastIndexOf(')');
        if (userIdEnd <= userIdStart + 2)
            return (userInfo, string.Empty);

        var userId = CleanId().Replace(userInfo[(userIdStart + 2)..userIdEnd], string.Empty);
        return (userInfo[..userIdStart], userId);
    }

    [GeneratedRegex("[^a-zA-Z0-9_\\-~:()]")]
    private static partial Regex CleanId();

    [GeneratedRegex("[/]")]
    private static partial Regex CleanLocation();

    private sealed class LogContext
    {
        public long Position;
        public string LocationDestination = string.Empty;
        public string RecentWorldName = string.Empty;
    }
}
