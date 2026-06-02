const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "mariochat.json");
const MAX_MESSAGES = 500;
const MAX_BODY = 2_500_000;
const PRESENCE_TIMEOUT_MS = 15_000;
const SIGNAL_TTL_MS = 30_000;
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";

const clients = new Set();
const presence = new Map();
const voiceSignals = [];

const db = {
  messages: [],
  profiles: {},
  roles: {
    admin: { name: "Admin", color: "#f0b232" },
    mod: { name: "Mod", color: "#23a559" },
    member: { name: "Member", color: "#949cf7" }
  },
  lockedChannels: {},
  invites: []
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function loadDb() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    Object.assign(db, parsed);
  } catch (_) {
    saveDb();
  }
}

function saveDb() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (_) {
    // Render free instances may restart; in-memory state still keeps the app usable.
  }
}

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
      if (body.length > MAX_BODY) {
        reject(new Error("La solicitud es demasiado grande."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function broadcast(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) client.write(data);
}

function profileFor(id, fallbackName = "Usuario") {
  const profile = db.profiles[id] || {};
  return {
    id,
    name: String(profile.name || fallbackName || "Usuario").slice(0, 32),
    status: String(profile.status || "Disponible").slice(0, 80),
    color: String(profile.color || "#949cf7").slice(0, 16),
    avatar: String(profile.avatar || "").slice(0, 120_000),
    role: String(profile.role || "member").slice(0, 24)
  };
}

function visibleProfile(profile) {
  const role = db.roles[profile.role] || db.roles.member;
  return {
    ...profile,
    roleName: role.name,
    roleColor: role.color
  };
}

function activeUsers() {
  const now = Date.now();
  for (const [id, user] of presence) {
    if (now - user.lastSeen > PRESENCE_TIMEOUT_MS) presence.delete(id);
  }

  return Array.from(presence.values())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(user => ({
      ...visibleProfile(profileFor(user.id, user.name)),
      voiceChannel: user.voiceChannel,
      voiceGuild: user.voiceGuild
    }));
}

function updatePresence(id, name, voiceChannel, voiceGuild) {
  const existing = profileFor(id, name);
  db.profiles[id] = { ...existing, name: String(name || existing.name).slice(0, 32) };
  presence.set(id, {
    id,
    name: db.profiles[id].name,
    voiceChannel: voiceChannel ? String(voiceChannel).slice(0, 48) : "",
    voiceGuild: voiceGuild ? String(voiceGuild).slice(0, 48) : "",
    lastSeen: Date.now()
  });

  saveDb();
  const users = activeUsers();
  broadcast("presence", users);
  return users;
}

function isChannelLocked(guild, channel) {
  return Boolean(db.lockedChannels[`${guild}:${channel}`]);
}

function canWriteChannel(userId, guild, channel) {
  const profile = profileFor(userId);
  return !isChannelLocked(guild, channel) || ["admin", "mod"].includes(profile.role);
}

function addMessage(body) {
  const userId = String(body.userId || "").trim();
  const name = String(body.name || "").trim();
  const text = String(body.text || "").trim();
  const guild = String(body.guild || "mariochat").trim();
  const channel = String(body.channel || "general").trim();
  const type = String(body.type || "channel").trim();
  const to = String(body.to || "").trim();
  const attachment = body.attachment && typeof body.attachment === "object" ? {
    name: String(body.attachment.name || "archivo").slice(0, 80),
    mime: String(body.attachment.mime || "application/octet-stream").slice(0, 80),
    data: String(body.attachment.data || "").slice(0, 1_800_000)
  } : null;

  if (!userId || !name || (!text && !attachment)) {
    return { error: "Usuario y mensaje son obligatorios." };
  }

  if (type === "channel" && !canWriteChannel(userId, guild, channel)) {
    return { error: "Este canal esta bloqueado." };
  }

  const profile = visibleProfile(profileFor(userId, name));
  const message = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId,
    name: profile.name,
    text: text.slice(0, 500),
    guild: guild.slice(0, 48),
    channel: channel.slice(0, 48),
    type: type === "dm" ? "dm" : "channel",
    to: to.slice(0, 80),
    attachment,
    reactions: {},
    profile,
    time: new Date().toISOString()
  };

  db.messages.push(message);
  if (db.messages.length > MAX_MESSAGES) db.messages.shift();
  saveDb();
  broadcast("message", message);
  return { message };
}

function filterMessages(url) {
  const type = url.searchParams.get("type") || "channel";
  const userId = url.searchParams.get("userId") || "";
  const peerId = url.searchParams.get("peerId") || "";
  const guild = url.searchParams.get("guild");
  const channel = url.searchParams.get("channel");

  if (type === "dm") {
    return db.messages.filter(message => {
      if (message.type !== "dm") return false;
      return (message.userId === userId && message.to === peerId) ||
        (message.userId === peerId && message.to === userId);
    });
  }

  return db.messages.filter(message => {
    const messageGuild = message.guild || "mariochat";
    const messageChannel = message.channel || "general";
    return message.type !== "dm" && (!guild || messageGuild === guild) && (!channel || messageChannel === channel);
  });
}

function pruneVoiceSignals() {
  const cutoff = Date.now() - SIGNAL_TTL_MS;
  while (voiceSignals.length && voiceSignals[0].createdAt < cutoff) voiceSignals.shift();
}

function handleAdmin(body) {
  if (String(body.pin || "") !== ADMIN_PIN) return { error: "PIN incorrecto." };
  const action = String(body.action || "");
  const userId = String(body.userId || "");
  const role = String(body.role || "member");
  const guild = String(body.guild || "mariochat");
  const channel = String(body.channel || "general");
  const locked = Boolean(body.locked);

  if (action === "role") {
    const profile = profileFor(userId);
    db.profiles[userId] = { ...profile, role };
  }

  if (action === "lock") {
    db.lockedChannels[`${guild}:${channel}`] = locked;
  }

  saveDb();
  const state = publicState();
  broadcast("state", state);
  broadcast("presence", activeUsers());
  return { state };
}

function publicState() {
  return {
    roles: db.roles,
    lockedChannels: db.lockedChannels,
    turn: process.env.TURN_URL ? {
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME || "",
      credential: process.env.TURN_CREDENTIAL || ""
    } : null
  };
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

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

loadDb();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write(`event: history\ndata: ${JSON.stringify(db.messages)}\n\n`);
    res.write(`event: state\ndata: ${JSON.stringify(publicState())}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (req.method === "GET" && url.pathname === "/messages") return sendJson(res, 200, filterMessages(url));
  if (req.method === "GET" && url.pathname === "/presence") return sendJson(res, 200, activeUsers());
  if (req.method === "GET" && url.pathname === "/state") return sendJson(res, 200, publicState());

  if (req.method === "GET" && url.pathname === "/voice-signals") {
    pruneVoiceSignals();
    const userId = url.searchParams.get("userId");
    const after = Number(url.searchParams.get("after") || 0);
    return sendJson(res, 200, voiceSignals.filter(signal => signal.to === userId && signal.id > after));
  }

  if (req.method === "POST" && url.pathname === "/presence") {
    try {
      const body = JSON.parse(await readBody(req));
      const id = String(body.id || "").trim();
      if (!id) return sendJson(res, 400, { error: "ID de usuario obligatorio." });
      return sendJson(res, 200, updatePresence(id, String(body.name || "").trim() || "Usuario", body.voiceChannel, body.voiceGuild));
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
  }

  if (req.method === "POST" && url.pathname === "/profile") {
    try {
      const body = JSON.parse(await readBody(req));
      const id = String(body.id || "").trim();
      if (!id) return sendJson(res, 400, { error: "ID obligatorio." });
      const profile = profileFor(id, body.name);
      db.profiles[id] = {
        ...profile,
        name: String(body.name || profile.name).slice(0, 32),
        status: String(body.status || profile.status).slice(0, 80),
        color: String(body.color || profile.color).slice(0, 16),
        avatar: String(body.avatar || profile.avatar).slice(0, 120_000)
      };
      saveDb();
      broadcast("presence", activeUsers());
      return sendJson(res, 200, visibleProfile(profileFor(id)));
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
  }

  if (req.method === "POST" && url.pathname === "/messages") {
    try {
      const result = addMessage(JSON.parse(await readBody(req)));
      if (result.error) return sendJson(res, 400, { error: result.error });
      return sendJson(res, 201, result.message);
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
  }

  if (req.method === "POST" && url.pathname === "/reaction") {
    try {
      const body = JSON.parse(await readBody(req));
      const message = db.messages.find(item => item.id === body.messageId);
      if (!message) return sendJson(res, 404, { error: "Mensaje no encontrado." });
      const emoji = String(body.emoji || "like").slice(0, 16);
      message.reactions[emoji] = message.reactions[emoji] || [];
      const userId = String(body.userId || "");
      if (message.reactions[emoji].includes(userId)) {
        message.reactions[emoji] = message.reactions[emoji].filter(id => id !== userId);
      } else {
        message.reactions[emoji].push(userId);
      }
      saveDb();
      broadcast("message-update", message);
      return sendJson(res, 200, message);
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
  }

  if (req.method === "POST" && url.pathname === "/invite") {
    const invite = { id: Math.random().toString(36).slice(2, 8), createdAt: new Date().toISOString() };
    db.invites.push(invite);
    saveDb();
    return sendJson(res, 201, invite);
  }

  if (req.method === "POST" && url.pathname === "/admin") {
    try {
      const result = handleAdmin(JSON.parse(await readBody(req)));
      return sendJson(res, result.error ? 403 : 200, result);
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
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
      if (!signal.from || !signal.to || !signal.type) return sendJson(res, 400, { error: "Senal de voz incompleta." });
      pruneVoiceSignals();
      voiceSignals.push(signal);
      broadcast("voice-signal", signal);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
  }

  if (req.method === "GET") return serveStatic(req, res);

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, "0.0.0.0", () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(item => item && item.family === "IPv4" && !item.internal)
    .map(item => `http://${item.address}:${PORT}`);

  console.log(`MarioChat listo en http://localhost:${PORT}`);
  if (addresses.length) console.log(`En tu red local: ${addresses.join(", ")}`);
});
