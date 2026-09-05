using System.Data;
using Microsoft.Data.Sqlite;

namespace VRCX.TauriBackend;

/// <summary>
/// Shared SQLite access for the backend, mirroring the master branch's SQLite API
/// (Execute / ExecuteNonQuery) so the ported WebApi can persist cookies unchanged.
/// </summary>
public static class Sqlite
{
    private static readonly ReaderWriterLockSlim ConnectionLock = new();
    private static SqliteConnection? Connection;

    public static void Init(string dataSource)
    {
        Connection = new SqliteConnection(
            $"Data Source=\"{dataSource}\";Cache=Shared;"
        );
        Connection.Open();
        using (var command = Connection.CreateCommand())
        {
            command.CommandText = "PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;";
            command.ExecuteNonQuery();
        }
    }

    public static object?[][] Execute(string sql, IDictionary<string, object>? args = null)
    {
        var connection = Connection ?? throw new InvalidOperationException("SQLite is not initialized");
        ConnectionLock.EnterReadLock();
        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            if (args != null)
            {
                foreach (var arg in args)
                    command.Parameters.AddWithValue(arg.Key, arg.Value);
            }

            using var reader = command.ExecuteReader();
            var result = new List<object?[]>();
            while (reader.Read())
            {
                var values = new object?[reader.FieldCount];
                for (var i = 0; i < reader.FieldCount; i++)
                    values[i] = reader.GetValue(i);
                result.Add(values);
            }
            return result.ToArray();
        }
        finally
        {
            ConnectionLock.ExitReadLock();
        }
    }

    public static int ExecuteNonQuery(string sql, IDictionary<string, object>? args = null)
    {
        var connection = Connection ?? throw new InvalidOperationException("SQLite is not initialized");
        ConnectionLock.EnterWriteLock();
        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            if (args != null)
            {
                foreach (var arg in args)
                    command.Parameters.AddWithValue(arg.Key, arg.Value);
            }

            return command.ExecuteNonQuery();
        }
        finally
        {
            ConnectionLock.ExitWriteLock();
        }
    }
}
