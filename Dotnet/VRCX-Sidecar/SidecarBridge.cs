using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using VRCX;

namespace VRCX.Sidecar
{
    /// <summary>
    /// Reflection-based JSON-RPC dispatcher that mirrors the Electron
    /// `InteropApi.callMethod(className, methodName, args)` bridge, so the
    /// frontend keeps the exact same `callDotNetMethod` contract.
    /// </summary>
    public static class SidecarBridge
    {
        private static readonly Dictionary<string, object> Instances = new();

        static SidecarBridge()
        {
            // Same singleton wiring the Electron main process relies on.
            Instances["AppApi"] = Program.AppApiInstance;
            Instances["AppApiElectron"] = Program.AppApiInstance;
            Instances["WebApi"] = WebApi.Instance;
            Instances["SQLite"] = SQLite.Instance;
            Instances["VRCXStorage"] = VRCXStorage.Instance;
            Instances["LogWatcher"] = LogWatcher.Instance;
            Instances["Discord"] = Discord.Instance;
            Instances["AssetBundleManager"] = AssetBundleManager.Instance;
            Instances["AppApiVr"] = Program.VRCXVRInstance;
            Instances["AppApiVrElectron"] = Program.VRCXVRInstance;
            Instances["SystemMonitorElectron"] = SystemMonitorElectron.Instance;
        }

        public static void RegisterInstance(string className, object instance)
        {
            Instances[className] = instance;
        }

        /// <summary>
        /// Handles one line-delimited JSON-RPC request and returns the response
        /// object ready for serialization. Async method calls are awaited
        /// without blocking a thread-pool thread (a slow network request must
        /// not stall unrelated requests).
        /// </summary>
        public static async Task<object> HandleRequestAsync(string jsonLine)
        {
            long id = 0;
            try
            {
                var req = JsonNode.Parse(jsonLine)?.AsObject();
                id = req?["id"]?.GetValue<long>() ?? 0;
                var className = req?["className"]?.GetValue<string>() ?? string.Empty;
                var methodName = req?["methodName"]?.GetValue<string>() ?? string.Empty;
                var args = req?["args"] as JsonArray ?? new JsonArray();

                var result = await InvokeAsync(className, methodName, args);
                return new { id, result };
            }
            catch (Exception e)
            {
                return new { id, error = e.ToString() };
            }
        }

        private static async Task<object> InvokeAsync(string className, string methodName, JsonArray args)
        {
            if (!Instances.TryGetValue(className, out var instance))
                throw new InvalidOperationException($"Unknown class: {className}");

            var type = instance.GetType();
            var candidates = type
                .GetMethods(BindingFlags.Public | BindingFlags.Instance)
                .Where(m => m.Name == methodName && !m.IsSpecialName)
                .Where(m => MatchesArgCount(m, args.Count))
                .ToList();

            if (candidates.Count == 0)
                throw new MissingMethodException(
                    $"{className}.{methodName} with {args.Count} arg(s) not found"
                );

            var method = SelectMethod(candidates, args);
            var parameters = method.GetParameters();
            var converted = new object?[parameters.Length];
            for (var i = 0; i < parameters.Length; i++)
            {
                converted[i] = i < args.Count
                    ? ConvertArg(args[i], parameters[i].ParameterType)
                    : GetDefaultValue(parameters[i]);
            }

            var result = method.Invoke(instance, converted);
            if (result is Task task)
            {
                // Await instead of .GetAwaiter().GetResult() so a slow async
                // call (e.g. network) does not hold a thread-pool thread.
                await task;
                result = task.GetType().GetProperty("Result")?.GetValue(task);
            }

            return result;
        }

        /// <summary>
        /// Matches a method signature against the number of provided args,
        /// allowing trailing optional (default-value) parameters to be omitted.
        /// </summary>
        private static bool MatchesArgCount(MethodInfo method, int argCount)
        {
            var parameters = method.GetParameters();
            if (argCount == parameters.Length)
                return true;

            var optional = parameters.Count(p => p.IsOptional);
            return argCount >= parameters.Length - optional && argCount <= parameters.Length;
        }

        private static object? GetDefaultValue(ParameterInfo parameter)
        {
            if (parameter.HasDefaultValue)
                return parameter.DefaultValue;
            return parameter.ParameterType.IsValueType
                ? Activator.CreateInstance(parameter.ParameterType)
                : null;
        }

        private static MethodInfo SelectMethod(List<MethodInfo> candidates, JsonArray args)
        {
            if (candidates.Count == 1)
                return candidates[0];

            foreach (var candidate in candidates)
            {
                try
                {
                    var parameters = candidate.GetParameters();
                    for (var i = 0; i < parameters.Length; i++)
                    {
                        if (args[i] != null &&
                            !CanConvert(args[i], parameters[i].ParameterType))
                            throw new InvalidOperationException();
                    }

                    return candidate;
                }
                catch
                {
                    // Try next overload.
                }
            }

            return candidates[0];
        }

        private static bool CanConvert(JsonNode node, Type targetType)
        {
            if (targetType == typeof(string)) return true;
            if (targetType == typeof(byte[])) return node is JsonValue;
            if (IsNumeric(targetType) || targetType == typeof(bool) || targetType.IsEnum)
                return node is JsonValue;
            if (targetType == typeof(object)) return true;
            if (typeof(IDictionary).IsAssignableFrom(targetType)) return node is JsonObject;
            if (targetType == typeof(DateTime)) return node is JsonValue;
            return true;
        }

        private static object? ConvertArg(JsonNode? node, Type targetType)
        {
            if (node == null || node.GetValueKind() == JsonValueKind.Null)
            {
                if (targetType.IsValueType && Nullable.GetUnderlyingType(targetType) == null)
                    return Activator.CreateInstance(targetType);
                return null;
            }

            if (targetType == typeof(object))
                return ConvertNode(node);

            if (targetType == typeof(byte[]))
                return Convert.FromBase64String(node.GetValue<string>());

            if (targetType == typeof(string))
                return node.GetValueKind() == JsonValueKind.String
                    ? node.GetValue<string>()
                    : node.ToJsonString();

            if (targetType == typeof(bool))
                return node.GetValue<bool>();

            if (targetType == typeof(DateTime))
                return node.GetValue<DateTime>();

            if (targetType.IsEnum)
                return Enum.ToObject(targetType, ConvertToInt64(node));

            if (IsNumeric(targetType))
                return ConvertNumeric(node, targetType);

            if (typeof(IDictionary).IsAssignableFrom(targetType))
                return ConvertDictionary(node, targetType);

            return ConvertNode(node);
        }

        private static bool IsNumeric(Type t)
        {
            t = Nullable.GetUnderlyingType(t) ?? t;
            return t == typeof(int) || t == typeof(long) || t == typeof(short) ||
                   t == typeof(byte) || t == typeof(float) || t == typeof(double) ||
                   t == typeof(decimal) || t == typeof(uint) || t == typeof(ulong) ||
                   t == typeof(ushort);
        }

        private static long ConvertToInt64(JsonNode node)
        {
            return node.GetValueKind() == JsonValueKind.String
                ? long.Parse(node.GetValue<string>())
                : node.GetValue<long>();
        }

        private static object ConvertNumeric(JsonNode node, Type targetType)
        {
            var underlying = Nullable.GetUnderlyingType(targetType) ?? targetType;
            if (node.GetValueKind() == JsonValueKind.String)
            {
                var text = node.GetValue<string>();
                return underlying == typeof(float) || underlying == typeof(double)
                    ? System.Convert.ChangeType(double.Parse(text), underlying)
                    : System.Convert.ChangeType(long.Parse(text), underlying);
            }

            return node.GetValueKind() == JsonValueKind.Number
                ? node.GetValue<double>() % 1 == 0 && !IsFloat(underlying)
                    ? System.Convert.ChangeType(node.GetValue<long>(), underlying)
                    : System.Convert.ChangeType(node.GetValue<double>(), underlying)
                : System.Convert.ChangeType(node.GetValue<string>(), underlying);
        }

        private static bool IsFloat(Type t)
        {
            return t == typeof(float) || t == typeof(double) || t == typeof(decimal);
        }

        private static Dictionary<string, object> ConvertDictionary(JsonNode node, Type targetType)
        {
            var dict = new Dictionary<string, object>();
            if (node is JsonObject obj)
            {
                foreach (var kv in obj)
                {
                    dict[kv.Key] = ConvertNode(kv.Value) ?? string.Empty;
                }
            }

            return dict;
        }

        private static object? ConvertNode(JsonNode? node)
        {
            if (node == null || node.GetValueKind() == JsonValueKind.Null)
                return null;
            if (node is JsonObject obj)
            {
                var dict = new Dictionary<string, object>();
                foreach (var kv in obj)
                {
                    dict[kv.Key] = ConvertNode(kv.Value) ?? string.Empty;
                }

                return dict;
            }

            if (node is JsonArray array)
            {
                var list = new List<object>();
                foreach (var item in array)
                {
                    list.Add(ConvertNode(item) ?? string.Empty);
                }

                return list.ToArray();
            }

            if (node is JsonValue value)
            {
                if (value.TryGetValue<bool>(out var b)) return b;
                if (value.TryGetValue<long>(out var l)) return l;
                if (value.TryGetValue<double>(out var d)) return d;
                return value.GetValue<string>();
            }

            return node.ToJsonString();
        }
    }
}
