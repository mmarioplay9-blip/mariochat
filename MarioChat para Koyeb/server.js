const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_MESSAGES = 100;

const clients = new Set();
const messages = [];
const presence = new Map();
const voiceSignals = [];
const PRESENCE_TIMEOUT_MS = 15_000;
const SIGNAL_TTL_MS = 30_000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 65_536) {
        reject(new Error("El mensaje es demasiado grande."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function broadcast(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    client.write(data);
  }
}

function pruneVoiceSignals() {
  const cutoff = Date.now() - SIGNAL_TTL_MS;
  while (voiceSignals.length && voiceSignals[0].createdAt < cutoff) {
    voiceSignals.shift();
  }
}

function activeUsers() {
  const now = Date.now();
  for (const [id, user] of presence) {
    if (now - user.lastSeen > PRESENCE_TIMEOUT_MS) {
      presence.delete(id);
    }
  }

  return Array.from(presence.values())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(user => ({
      id: user.id,
      name: user.name,
      voiceChannel: user.voiceChannel,
      voiceGuild: user.voiceGuild
    }));
}

function updatePresence(id, name, voiceChannel, voiceGuild) {
  presence.set(id, {
    id,
    name: name.slice(0, 32),
    voiceChannel: voiceChannel ? String(voiceChannel).slice(0, 48) : "",
    voiceGuild: voiceGuild ? String(voiceGuild).slice(0, 48) : "",
    lastSeen: Date.now()
  });

  const users = activeUsers();
  broadcast("presence", users);
  return users;
}

function addMessage(name, text, guild, channel) {
  const message = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.slice(0, 32),
    text: text.slice(0, 500),
    guild: guild.slice(0, 48),
    channel: channel.slice(0, 48),
    time: new Date().toISOString()
  };

  messages.push(message);
  if (messages.length > MAX_MESSAGES) messages.shift();
  broadcast("message", message);
  return message;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rawPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rawPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write(`event: history\ndata: ${JSON.stringify(messages)}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (req.method === "GET" && url.pathname === "/messages") {
    const guild = url.searchParams.get("guild");
    const channel = url.searchParams.get("channel");
    const filteredMessages = messages.filter(message => {
      const messageGuild = message.guild || "mariochat";
      const messageChannel = message.channel || "general";
      return (!guild || messageGuild === guild) && (!channel || messageChannel === channel);
    });

    sendJson(res, 200, filteredMessages);
    return;
  }

  if (req.method === "GET" && url.pathname === "/presence") {
    sendJson(res, 200, activeUsers());
    return;
  }

  if (req.method === "GET" && url.pathname === "/voice-signals") {
    pruneVoiceSignals();
    const userId = url.searchParams.get("userId");
    const after = Number(url.searchParams.get("after") || 0);
    const signals = voiceSignals.filter(signal => signal.to === userId && signal.id > after);
    sendJson(res, 200, signals);
    return;
  }

  if (req.method === "POST" && url.pathname === "/presence") {
    try {
      const body = JSON.parse(await readBody(req));
      const id = String(body.id || "").trim();
      const name = String(body.name || "").trim() || "Usuario";
      const voiceChannel = String(body.voiceChannel || "").trim();
      const voiceGuild = String(body.voiceGuild || "").trim();

      if (!id) {
        sendJson(res, 400, { error: "ID de usuario obligatorio." });
        return;
      }

      sendJson(res, 200, updatePresence(id, name, voiceChannel, voiceGuild));
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/voice-signal") {
    try {
      const body = JSON.parse(await readBody(req));
      const signal = {
        id: Date.now() + Math.random(),
        createdAt: Date.now(),
        from: String(body.from || "").trim(),
        to: String(body.to || "").trim(),
        guild: String(body.guild || "").trim(),
        channel: String(body.channel || "").trim(),
        type: String(body.type || "").trim(),
        payload: body.payload || null
      };

      if (!signal.from || !signal.to || !signal.type) {
        sendJson(res, 400, { error: "Senal de voz incompleta." });
        return;
      }

      pruneVoiceSignals();
      voiceSignals.push(signal);
      broadcast("voice-signal", signal);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/messages") {
    try {
      const body = JSON.parse(await readBody(req));
      const name = String(body.name || "").trim();
      const text = String(body.text || "").trim();
      const guild = String(body.guild || "mariochat").trim();
      const channel = String(body.channel || "general").trim();

      if (!name || !text || !guild || !channel) {
        sendJson(res, 400, { error: "Nombre, mensaje, servidor y canal son obligatorios." });
        return;
      }

      const message = addMessage(name, text, guild, channel);
      sendJson(res, 201, message);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, "0.0.0.0", () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(item => item && item.family === "IPv4" && !item.internal)
    .map(item => `http://${item.address}:${PORT}`);

  console.log(`MarioChat listo en http://localhost:${PORT}`);
  if (addresses.length) {
    console.log(`En tu red local: ${addresses.join(", ")}`);
  }
});
