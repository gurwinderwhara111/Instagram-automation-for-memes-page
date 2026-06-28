const http = require("http");
const { parse: parseUrl } = require("querystring");

const VERIFY_TOKEN = "inkboost_verify_2024";
let sseClients = [];

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  sseClients = sseClients.filter((res) => {
    try { res.write(data); return true; }
    catch { return false; }
  });
}

function handleVerification(req, res) {
  const idx = req.url.indexOf("?");
  const qs = idx === -1 ? {} : parseUrl(req.url.slice(idx + 1));
  const mode = qs["hub.mode"];
  const challenge = qs["hub.challenge"];
  const token = qs["hub.verify_token"];

  console.log(`\nVERIFICATION: mode=${mode} token=${token} challenge=${challenge}`);
  broadcast({ type: "verification", time: new Date().toISOString(), mode, token, challenge, success: mode === "subscribe" && token === VERIFY_TOKEN });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(challenge);
  } else {
    res.writeHead(403);
    res.end("Verification failed");
  }
}

function handleEvent(req, res, rawBody) {
  const time = new Date().toISOString();
  let payload = {};
  try { payload = rawBody ? JSON.parse(rawBody) : {}; }
  catch { payload = { raw: rawBody }; }

  console.log(`\nWEBHOOK: ${req.method} ${req.url} at ${time}`);
  console.log(JSON.stringify(payload, null, 2));

  broadcast({ type: "webhook", time, method: req.method, path: req.url, headers: req.headers, payload });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "EVENT_RECEIVED", time }));
}

function handleSSE(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(":\n\n");
  sseClients.push(res);
  req.on("close", () => { sseClients = sseClients.filter((c) => c !== res); });
}

function handleDashboard(req, res) {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Webhook Live Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; }
  h1 { font-size: 1.5rem; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
  .status { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #3fb950; }
  .status.paused { background: #d29922; }
  .status.disconnected { background: #da3633; }
  .controls { margin-bottom: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .controls button { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
  .controls button:hover { background: #30363d; }
  .counter { font-size: 0.85rem; color: #8b949e; }
  .event { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px; margin-bottom: 10px; animation: slideIn 0.2s ease-out; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  .event-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.8rem; }
  .event-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; }
  .badge-webhook { background: #1f6feb; color: #fff; }
  .badge-verification { background: #8957e5; color: #fff; }
  .badge-success { background: #238636; color: #fff; margin-left: 4px; }
  .badge-fail { background: #da3633; color: #fff; margin-left: 4px; }
  .event-time { color: #8b949e; }
  .event-path { color: #58a6ff; font-family: monospace; font-size: 0.85rem; margin-bottom: 6px; }
  pre { background: #0d1117; padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 0.78rem; color: #7ee787; max-height: 300px; }
  .empty { color: #484f58; text-align: center; padding: 40px; font-size: 0.9rem; }
  .info { color: #8b949e; font-size: 0.8rem; margin-bottom: 16px; padding: 8px 12px; background: #161b22; border-radius: 6px; border: 1px solid #30363d; }
  .info code { background: #21262d; padding: 1px 6px; border-radius: 3px; color: #58a6ff; }
</style>
</head>
<body>
<h1><span class="status" id="statusDot"></span> Webhook Live Dashboard</h1>
<div class="info">
  Listening on port 3000. Tunnel: <code>bot.mymua.in</code> → <code>localhost:3000</code>.
  Webhook path: <code>/api/webhook</code>.
</div>
<div class="controls">
  <button onclick="togglePause()" id="pauseBtn">Pause</button>
  <button onclick="clearEvents()">Clear</button>
  <span class="counter" id="counter">0 events</span>
</div>
<div id="events"><div class="empty">Waiting for webhooks...</div></div>
<script>
  let paused = false, count = 0;
  const eventsDiv = document.getElementById("events");
  const counter = document.getElementById("counter");
  const statusDot = document.getElementById("statusDot");

  function connect() {
    const es = new EventSource("/events");
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      count++;
      counter.textContent = count + " events";
      if (!paused) addEvent(data);
    };
    es.onerror = () => { statusDot.className = "status disconnected"; };
    es.onopen = () => { statusDot.className = "status"; };
  }

  function addEvent(data) {
    const div = document.createElement("div");
    div.className = "event";
    const badge = data.type === "verification" ? "badge-verification" : "badge-webhook";
    const ok = data.type === "verification" ? '<span class="event-badge ' + (data.success ? "badge-success" : "badge-fail") + '">' + (data.success ? "OK" : "FAIL") + "</span>" : "";
    div.innerHTML = '<div class="event-header"><span><span class="event-badge ' + badge + '">' + data.type + "</span>" + ok + '</span><span class="event-time">' + new Date(data.time).toLocaleTimeString() + "</span></div>" + '<div class="event-path">' + (data.method || "GET") + " " + (data.path || "/") + "</div>" + "<pre>" + syntaxHighlight(data.payload || data) + "</pre>";
    eventsDiv.prepend(div);
    while (eventsDiv.children.length > 50) eventsDiv.removeChild(eventsDiv.lastChild);
  }

  function syntaxHighlight(obj) {
    return JSON.stringify(obj, null, 2)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"((?:[^"\\]|\\.)*)"\s*:/g, '<span style="color:#79c0ff">$1</span>:')
      .replace(/: "((?:[^"\\]|\\.)*)"/g, ': <span style="color:#a5d6ff">"$1"</span>')
      .replace(/: (true|false|null)/g, ': <span style="color:#ff7b72">$1</span>')
      .replace(/: (\d+)/g, ': <span style="color:#79c0ff">$1</span>');
  }

  function togglePause() {
    paused = !paused;
    document.getElementById("pauseBtn").textContent = paused ? "Resume" : "Pause";
    statusDot.className = paused ? "status paused" : "status";
  }

  function clearEvents() {
    eventsDiv.innerHTML = '<div class="empty">Waiting for webhooks...</div>';
    count = 0;
    counter.textContent = "0 events";
  }

  connect();
</script>
</body>
</html>`);
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  if (req.method === "GET" && req.url.includes("hub.challenge")) {
    return handleVerification(req, res);
  }
  if (req.method === "GET" && req.url === "/events") {
    return handleSSE(req, res);
  }
  if (req.method === "GET" && (req.url === "/" || req.url === "")) {
    return handleDashboard(req, res);
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => handleEvent(req, res, body));
});

const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\nWebhook listener on http://0.0.0.0:${PORT}`);
  console.log(`Dashboard: https://bot.mymua.in`);
  console.log(`Webhook:   https://bot.mymua.in/api/webhook\n`);
});
