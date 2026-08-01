const http = require('http');
const payload = JSON.stringify({
    sessionId: 'dialog-blur-lag',
    runId: 'probe',
    hypothesisId: 'A',
    location: 'probe.js',
    msg: '[DEBUG] probe from node with content-length',
    data: { ok: true },
    ts: Date.now()
});
const req = http.request(
    {
        hostname: '127.0.0.1',
        port: 7777,
        path: '/event',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    },
    (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => console.log('status', res.statusCode, 'body', body));
    }
);
req.on('error', (e) => console.log('ERR', e.message));
req.write(payload);
req.end();
