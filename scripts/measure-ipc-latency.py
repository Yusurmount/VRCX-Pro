#!/usr/bin/env python3
"""measure-ipc-latency.py — key IPC concurrency experiment (stdlib only).

Spawns the .NET sidecar directly over stdin/stdout JSON-RPC and measures
local SQLite latency while a slow WebApi HTTP request is in flight, plus a
parallel-burst probe. Used for before/after comparison of the IPC
multiplexing work (docs/规格/全栈性能.md S2 §5).

Usage:
  python scripts/measure-ipc-latency.py [--backend build/TauriBackend/VRCX-Pro.Backend.exe]
                                        [--delay-ms 5000] [--repeat 3]
                                        [--out <json-path>]
"""
import argparse
import json
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_BACKEND = os.path.join(REPO, "build", "TauriBackend", "VRCX-Pro.Backend.exe")


class DelayServer:
    """Local HTTP server with /delay?ms=N so slow requests work offline."""

    def __init__(self, port=0):
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                query = parse_qs(urlparse(self.path).query)
                ms = int(query.get("ms", ["1000"])[0])
                time.sleep(ms / 1000.0)
                body = b"ok"
                self.send_response(200)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def url(self, ms):
        return f"http://127.0.0.1:{self.port}/delay?ms={ms}"


class Sidecar:
    """Minimal JSON-RPC client: response routing by id (works pre/post mux)."""

    def __init__(self, exe):
        self.proc = subprocess.Popen(
            [exe],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            bufsize=1,
        )
        self.pending = {}
        self.lock = threading.Lock()
        self.reader = threading.Thread(target=self._read_loop, daemon=True)
        self.reader.start()

    def _read_loop(self):
        for line in self.proc.stdout:
            try:
                response = json.loads(line)
            except ValueError:
                continue
            with self.lock:
                future = self.pending.pop(response.get("id"), None)
            if future is not None:
                future.set_result(response)

    def call(self, class_name, method, args, timeout=60):
        future = threading.Event()
        result = {}
        with self.lock:
            call_id = Sidecar._next_id
            Sidecar._next_id += 1
            self.pending[call_id] = _FutureHolder(result, future)
        payload = json.dumps(
            {"id": call_id, "className": class_name, "methodName": method, "args": args}
        )
        self.proc.stdin.write(payload + "\n")
        self.proc.stdin.flush()
        if not future.wait(timeout):
            raise TimeoutError(f"{class_name}.{method} timed out after {timeout}s")
        return result.get("response")

    def close(self):
        try:
            self.proc.stdin.close()
        except Exception:
            pass
        try:
            self.proc.wait(timeout=5)
        except Exception:
            self.proc.kill()

    _next_id = 1


class _FutureHolder:
    def __init__(self, result, event):
        self.result = result
        self.event = event

    def set_result(self, response):
        self.result["response"] = response
        self.event.set()


def run(exe, delay_ms, repeat):
    delay = DelayServer()
    sidecar = Sidecar(exe)
    report = {"backend": exe, "delay_ms": delay_ms, "runs": []}
    try:
        # warmup: process start + first query (includes Sqlite.Init)
        t0 = time.perf_counter()
        sidecar.call("SQLite", "Execute", ["SELECT 1"])
        report["warmup_ms"] = round((time.perf_counter() - t0) * 1000, 1)

        for i in range(repeat):
            run_row = {}
            # 1) key experiment: slow HTTP in flight, measure local read latency
            http_done = threading.Event()
            http_result = {}

            def http_call():
                t = time.perf_counter()
                http_result["response"] = sidecar.call(
                    "WebApi",
                    "ExecuteJson",
                    [json.dumps({"url": delay.url(delay_ms), "method": "GET"})],
                    timeout=delay_ms / 1000 + 30,
                )
                http_result["ms"] = round((time.perf_counter() - t) * 1000, 1)
                http_done.set()

            thread = threading.Thread(target=http_call, daemon=True)
            thread.start()
            time.sleep(0.1)  # let the HTTP request reach the sidecar first

            t = time.perf_counter()
            sidecar.call("SQLite", "Execute", ["SELECT 1"])
            run_row["local_read_during_http_ms"] = round((time.perf_counter() - t) * 1000, 1)
            http_done.wait(delay_ms / 1000 + 30)
            run_row["slow_http_total_ms"] = http_result.get("ms")

            # 2) parallel burst: 10 concurrent local reads
            burst_latencies = []
            burst_lock = threading.Lock()

            def burst_call():
                t = time.perf_counter()
                sidecar.call("SQLite", "Execute", ["SELECT 1"], timeout=30)
                with burst_lock:
                    burst_latencies.append(round((time.perf_counter() - t) * 1000, 1))

            threads = [threading.Thread(target=burst_call, daemon=True) for _ in range(10)]
            t = time.perf_counter()
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(30)
            run_row["parallel_burst_10_total_ms"] = round((time.perf_counter() - t) * 1000, 1)
            run_row["parallel_burst_10_each_ms"] = sorted(burst_latencies)

            report["runs"].append(run_row)
            print(json.dumps(run_row), flush=True)
    finally:
        sidecar.close()
        delay.server.shutdown()
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", default=DEFAULT_BACKEND)
    parser.add_argument("--delay-ms", type=int, default=5000)
    parser.add_argument("--repeat", type=int, default=3)
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    if not os.path.exists(args.backend):
        print(f"backend not found: {args.backend}", file=sys.stderr)
        sys.exit(2)

    report = run(args.backend, args.delay_ms, args.repeat)
    payload = json.dumps(report, indent=2)
    print(payload)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            handle.write(payload)


if __name__ == "__main__":
    main()
