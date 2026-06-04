const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const LOGS_DIR = path.join(DATA_DIR, "logs");
const DB_FILE = path.join(DATA_DIR, "mariochat.json");
const DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = Number(process.env.MAX_ATTACHMENT_BYTES || process.env.MAX_UPLOAD_BYTES || DEFAULT_MAX_UPLOAD_BYTES);
const MAX_BODY = Number(process.env.MAX_BODY_BYTES || Math.ceil(MAX_ATTACHMENT_BYTES * 1.45) + 1_000_000);
const MAX_AVATAR_BYTES = Number(process.env.MAX_AVATAR_BYTES || 10 * 1024 * 1024);
const MAX_BANNER_BYTES = Number(process.env.MAX_BANNER_BYTES || 20 * 1024 * 1024);
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const BACKUP_INTERVAL_MS = 5 * 60_000;
const MAX_BACKUPS = 30;
const PRESENCE_TIMEOUT_MS = 15_000;
const SIGNAL_TTL_MS = 30_000;
const ORPHAN_CLEANUP_INTERVAL_MS = 60 * 60_000;
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";

const clients = new Set();
const presence = new Map();
const voiceSignals = [];
const typingStates = new Map();

const db = {
  schemaVersion: 2,
  messages: [],
  conversations: {},
  contacts: {},
  files: {},
  readReceipts: {},
  settings: {},
  friends: {},
  friendRequests: [],
  blockedUsers: {},
  guilds: {},
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
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".rar": "application/vnd.rar",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv"
};

const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "application/zip",
  "application/vnd.rar",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "application/octet-stream"
]);

let lastBackupAt = 0;
let messagesByConversation = new Map();

function loadDb() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    Object.assign(db, parsed);
  } catch (_) {
    saveDb({ backup: false });
  }

  migrateDb();
}

function ensureStorageDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function appendLog(fileName, entry) {
  try {
    ensureStorageDirs();
    const line = JSON.stringify({ time: new Date().toISOString(), ...entry }) + "\n";
    fs.appendFileSync(path.join(LOGS_DIR, fileName), line);
  } catch (_) {
    // Logging must never make the chat unavailable.
  }
}

function logError(error, context = {}) {
  appendLog("errors.log", {
    level: "error",
    message: error?.message || String(error),
    stack: error?.stack || "",
    ...context
  });
}

function logEvent(type, details = {}) {
  appendLog("events.log", { level: "info", type, ...details });
}

function createBackup(force = false) {
  if (!fs.existsSync(DB_FILE)) return;
  const now = Date.now();
  if (!force && now - lastBackupAt < BACKUP_INTERVAL_MS) return;
  lastBackupAt = now;

  try {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(DB_FILE, path.join(BACKUPS_DIR, `mariochat-${stamp}.json`));
    const backups = fs.readdirSync(BACKUPS_DIR)
      .filter(file => file.endsWith(".json"))
      .map(file => ({ file, time: fs.statSync(path.join(BACKUPS_DIR, file)).mtimeMs }))
      .sort((left, right) => right.time - left.time);
    backups.slice(MAX_BACKUPS).forEach(item => fs.unlinkSync(path.join(BACKUPS_DIR, item.file)));
  } catch (_) {
    // Backups are protective; a failed backup should not stop chat delivery.
  }
}

function saveDb(options = {}) {
  try {
    ensureStorageDirs();
    if (options.backup !== false) createBackup(Boolean(options.forceBackup));
    fs.writeFileSync(DB_FILE, JSON.stringify(db));
  } catch (error) {
    logError(error, { action: "saveDb" });
    // Render free instances may restart; in-memory state still keeps the app usable.
  }
}

function sanitizeFileName(fileName) {
  const parsed = path.parse(String(fileName || "archivo").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_"));
  const base = (parsed.name || "archivo").replace(/\s+/g, "_").slice(0, 60);
  const ext = (parsed.ext || "").toLowerCase().slice(0, 12);
  return `${base}${ext}`;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (value >= 1024 * 1024) return `${Math.round(value / 1024 / 1024)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} bytes`;
}

function dataUrlByteLength(dataUrl) {
  const value = String(dataUrl || "");
  const commaIndex = value.indexOf(",");
  if (commaIndex === -1) return 0;
  const payload = value.slice(commaIndex + 1);
  if (value.slice(0, commaIndex).includes(";base64")) {
    return Math.floor(payload.length * 3 / 4);
  }
  return Buffer.byteLength(decodeURIComponent(payload));
}

function limitProfileImage(dataUrl, maxBytes, label) {
  const value = String(dataUrl || "");
  if (!value) return "";
  if (!value.startsWith("data:image/")) throw new Error(`${label} debe ser una imagen valida.`);
  if (dataUrlByteLength(value) > maxBytes) {
    throw new Error(`${label} supera el limite permitido de ${formatBytes(maxBytes)}.`);
  }
  return value;
}

function detectMime(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) return "application/x-msdownload";
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x7F, 0x45, 0x4C, 0x46]))) return "application/x-elf";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "image/jpeg";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1A, 0x45, 0xDF, 0xA3]))) return "video/webm";
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString("ascii") === "ID3") return "audio/mpeg";
  if (buffer.length >= 2 && buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) return "audio/mpeg";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE") return "audio/wav";
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B) return "application/zip";
  if (buffer.length >= 7 && buffer.subarray(0, 7).equals(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00]))) return "application/vnd.rar";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00]))) return "application/vnd.rar";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]))) return "application/vnd.ms-office";
  if (!buffer.includes(0) && buffer.subarray(0, Math.min(buffer.length, 512)).every(byte => byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 128)) return "text/plain";
  return "application/octet-stream";
}

function validateAttachment(fileName, browserMime, buffer) {
  const safeName = sanitizeFileName(fileName);
  const ext = path.extname(safeName).toLowerCase();
  let detectedMime = detectMime(buffer);
  const officeOpenXml = new Map([
    [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
  ]);
  const officeLegacy = new Map([
    [".doc", "application/msword"],
    [".xls", "application/vnd.ms-excel"],
    [".ppt", "application/vnd.ms-powerpoint"]
  ]);
  if (detectedMime === "application/zip" && officeOpenXml.has(ext)) detectedMime = officeOpenXml.get(ext);
  if (detectedMime === "application/vnd.ms-office" && officeLegacy.has(ext)) detectedMime = officeLegacy.get(ext);
  if (detectedMime === "text/plain" && ext === ".csv") detectedMime = "text/csv";
  if (!allowedMimeTypes.has(detectedMime)) detectedMime = "application/octet-stream";
  const browserCompatible = browserMime && (
    browserMime === detectedMime ||
    (browserMime === "application/octet-stream") ||
    (browserMime === "application/zip" && officeOpenXml.has(ext)) ||
    (browserMime === "application/vnd.ms-office" && officeLegacy.has(ext))
  );
  if (browserMime && !browserCompatible && detectedMime !== "application/octet-stream") {
    throw new Error(`El archivo no coincide con su tipo declarado (${browserMime} != ${detectedMime}).`);
  }
  return { safeName, detectedMime };
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const data = isBase64 ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]));
  return { mime, data };
}

function saveAttachmentFile(attachment) {
  const decoded = dataUrlToBuffer(attachment?.data);
  if (!decoded || decoded.data.length > MAX_ATTACHMENT_BYTES) {
    throw new Error(`El archivo es demasiado grande o invalido. Limite actual: ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
  }

  ensureStorageDirs();
  const { safeName, detectedMime } = validateAttachment(attachment.name, attachment.mime || decoded.mime, decoded.data);
  const hash = crypto.createHash("sha256").update(decoded.data).digest("hex");
  const existing = db.files[hash];
  if (existing?.path && fs.existsSync(path.join(__dirname, existing.path))) {
    return { ...existing, duplicate: true };
  }

  const ext = path.extname(safeName) || "";
  const base = path.basename(safeName, ext);
  let storedName = `${base}-${hash.slice(0, 10)}${ext}`;
  let storedPath = path.join(UPLOADS_DIR, storedName);
  let index = 1;
  while (fs.existsSync(storedPath)) {
    storedName = `${base}-${hash.slice(0, 10)}-${index}${ext}`;
    storedPath = path.join(UPLOADS_DIR, storedName);
    index += 1;
  }

  fs.writeFileSync(storedPath, decoded.data);
  const fileRecord = {
    originalName: String(attachment.name || "archivo").slice(0, 120),
    name: storedName,
    mime: detectedMime,
    size: decoded.data.length,
    hash,
    path: `uploads/${storedName}`,
    url: `/uploads/${encodeURIComponent(storedName)}`,
    createdAt: new Date().toISOString()
  };
  db.files[hash] = fileRecord;
  return fileRecord;
}

function normalizeAttachment(attachment) {
  if (!attachment) return null;
  if (attachment.url || attachment.path) return attachment;
  if (!attachment.data) return null;
  return saveAttachmentFile(attachment);
}

function conversationIdFor(message) {
  if (message.type === "dm") {
    const users = [message.userId, message.to].filter(Boolean).sort();
    return `dm:${users.join(":")}`;
  }
  return `channel:${message.guild || "mariochat"}:${message.channel || "general"}`;
}

function contactFromProfile(id, fallbackName = "Usuario") {
  const profile = visibleProfile(profileFor(id, fallbackName));
  return {
    id,
    name: profile.name,
    status: profile.status,
    presence: profile.presence,
    color: profile.color,
    avatar: profile.avatar,
    banner: profile.banner,
    bio: profile.bio,
    registeredAt: profile.registeredAt,
    badges: profile.badges,
    role: profile.role,
    roleName: profile.roleName,
    roleColor: profile.roleColor,
    updatedAt: new Date().toISOString()
  };
}

function upsertContact(id, fallbackName) {
  if (!id) return;
  db.contacts[id] = { ...(db.contacts[id] || {}), ...contactFromProfile(id, fallbackName) };
}

function upsertConversation(message) {
  if (message.deletedAt) return rebuildConversation(conversationIdFor(message));
  const id = conversationIdFor(message);
  const existing = db.conversations[id] || {};
  const isDm = message.type === "dm";
  db.conversations[id] = {
    id,
    type: isDm ? "dm" : "channel",
    guild: message.guild || "mariochat",
    channel: isDm ? "" : (message.channel || "general"),
    participants: isDm ? [message.userId, message.to].filter(Boolean).sort() : [],
    createdAt: existing.createdAt || message.time,
    updatedAt: message.time,
    lastMessage: {
      id: message.id,
      userId: message.userId,
      name: message.name,
      text: message.text || (message.attachment ? `Archivo: ${message.attachment.name || message.attachment.originalName || "archivo"}` : ""),
      time: message.time
    }
  };
}

function rebuildMessageIndexes() {
  messagesByConversation = new Map();
  db.messages.forEach(message => {
    const id = conversationIdFor(message);
    if (!messagesByConversation.has(id)) messagesByConversation.set(id, []);
    messagesByConversation.get(id).push(message);
  });
  for (const messages of messagesByConversation.values()) {
    messages.sort((left, right) => new Date(left.time) - new Date(right.time));
  }
}

function rebuildConversation(conversationId) {
  const messages = (messagesByConversation.get(conversationId) || [])
    .filter(message => !message.deletedAt)
    .sort((left, right) => new Date(left.time) - new Date(right.time));
  const last = messages[messages.length - 1];
  if (!last) {
    delete db.conversations[conversationId];
    return;
  }
  upsertConversation(last);
}

function rebuildAllConversations() {
  db.conversations = {};
  db.messages.forEach(message => {
    if (!message.deletedAt) upsertConversation(message);
  });
}

function migrateDb() {
  ensureStorageDirs();
  const previousConversationCount = Object.keys(db.conversations || {}).length;
  const previousContactCount = Object.keys(db.contacts || {}).length;
  db.schemaVersion = 2;
  db.messages = Array.isArray(db.messages) ? db.messages : [];
  db.profiles = db.profiles || {};
  db.conversations = db.conversations || {};
  db.contacts = db.contacts || {};
  db.files = db.files || {};
  db.readReceipts = db.readReceipts || {};
  db.settings = db.settings || {};
  db.friends = db.friends || {};
  db.friendRequests = Array.isArray(db.friendRequests) ? db.friendRequests : [];
  db.blockedUsers = db.blockedUsers || {};
  db.guilds = db.guilds || {};
  db.roles = db.roles || {};
  db.lockedChannels = db.lockedChannels || {};
  db.invites = Array.isArray(db.invites) ? db.invites : [];

  let changed = false;
  db.messages.forEach(message => {
    if (!message.time) {
      message.time = new Date().toISOString();
      changed = true;
    }
    if (message.attachment?.data) {
      try {
        message.attachment = normalizeAttachment(message.attachment);
        changed = true;
      } catch (_) {
        message.attachment = {
          name: String(message.attachment.name || "archivo").slice(0, 120),
          mime: String(message.attachment.mime || "application/octet-stream").slice(0, 120),
          error: "No se pudo migrar el archivo embebido."
        };
        changed = true;
      }
    }
    upsertContact(message.userId, message.name);
    if (message.to) upsertContact(message.to, message.to);
    message.reactions = message.reactions || {};
    message.readBy = message.readBy || [];
    message.attachments = Array.isArray(message.attachments) ? message.attachments : (message.attachment ? [message.attachment] : []);
    if (!message.deletedAt) upsertConversation(message);
  });

  db.messages.sort((left, right) => new Date(left.time) - new Date(right.time));
  rebuildMessageIndexes();
  rebuildAllConversations();
  if (db.messages.length && (
    Object.keys(db.conversations).length !== previousConversationCount ||
    Object.keys(db.contacts).length !== previousContactCount
  )) {
    changed = true;
  }
  if (changed) saveDb({ forceBackup: true });
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
    const contentLength = Number(req.headers["content-length"] || 0);
    if (contentLength > MAX_BODY) {
      reject(new Error(`La solicitud es demasiado grande. Limite actual: ${formatBytes(MAX_ATTACHMENT_BYTES)} por archivo.`));
      req.destroy();
      return;
    }
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > MAX_BODY) {
        reject(new Error(`La solicitud es demasiado grande. Limite actual: ${formatBytes(MAX_ATTACHMENT_BYTES)} por archivo.`));
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
  const registeredAt = profile.registeredAt || new Date().toISOString();
  return {
    id,
    name: String(profile.name || fallbackName || "Usuario").slice(0, 32),
    status: String(profile.status || "Disponible").slice(0, 80),
    presence: ["online", "away", "dnd", "invisible", "offline"].includes(profile.presence) ? profile.presence : "online",
    color: String(profile.color || "#949cf7").slice(0, 16),
    avatar: String(profile.avatar || ""),
    banner: String(profile.banner || ""),
    bio: String(profile.bio || "").slice(0, 240),
    registeredAt,
    badges: Array.isArray(profile.badges) ? profile.badges.slice(0, 8).map(item => String(item).slice(0, 24)) : [],
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

function updatePresence(id, name, voiceChannel, voiceGuild, presenceState) {
  const existing = profileFor(id, name);
  db.profiles[id] = {
    ...existing,
    name: String(name || existing.name).slice(0, 32),
    presence: ["online", "away", "dnd", "invisible", "offline"].includes(presenceState) ? presenceState : existing.presence
  };
  upsertContact(id, db.profiles[id].name);
  presence.set(id, {
    id,
    name: db.profiles[id].name,
    voiceChannel: voiceChannel ? String(voiceChannel).slice(0, 48) : "",
    voiceGuild: voiceGuild ? String(voiceGuild).slice(0, 48) : "",
    presence: db.profiles[id].presence || "online",
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
  const incomingAttachments = Array.isArray(body.attachments)
    ? body.attachments
    : (body.attachment ? [body.attachment] : []);
  const attachments = [];
  if (incomingAttachments.length) {
    incomingAttachments.slice(0, 10).forEach(item => {
      if (!item || typeof item !== "object") return;
      const saved = normalizeAttachment({
        name: String(item.name || "archivo").slice(0, 120),
        mime: String(item.mime || "application/octet-stream").slice(0, 120),
        data: String(item.data || "")
      });
      if (saved) attachments.push(saved);
    });
  }

  if (!userId || !name || (!text && !attachments.length)) {
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
    attachment: attachments[0] || null,
    attachments,
    reactions: {},
    profile,
    time: new Date().toISOString()
  };

  db.messages.push(message);
  const conversationId = conversationIdFor(message);
  if (!messagesByConversation.has(conversationId)) messagesByConversation.set(conversationId, []);
  messagesByConversation.get(conversationId).push(message);
  messagesByConversation.get(conversationId).sort((left, right) => new Date(left.time) - new Date(right.time));
  db.messages.sort((left, right) => new Date(left.time) - new Date(right.time));
  upsertContact(userId, name);
  if (to) upsertContact(to, to);
  upsertConversation(message);
  saveDb();
  logEvent("message.created", { messageId: message.id, conversationId, userId });
  broadcast("message", message);
  broadcast("conversations", publicConversations());
  return { message };
}

function getConversationIdFromUrl(url) {
  const type = url.searchParams.get("type") || "channel";
  const userId = url.searchParams.get("userId") || "";
  const peerId = url.searchParams.get("peerId") || "";
  const guild = url.searchParams.get("guild") || "mariochat";
  const channel = url.searchParams.get("channel") || "general";
  return type === "dm"
    ? `dm:${[userId, peerId].filter(Boolean).sort().join(":")}`
    : `channel:${guild}:${channel}`;
}

function filterMessages(url) {
  const conversationId = getConversationIdFromUrl(url);
  const requestedLimit = Number(url.searchParams.get("limit") || DEFAULT_PAGE_SIZE);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  const before = url.searchParams.get("before") || "";
  const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const user = String(url.searchParams.get("user") || "").trim().toLowerCase();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromTime = from ? new Date(from).getTime() : 0;
  const toTime = to ? new Date(to).getTime() : 0;

  let messages = (messagesByConversation.get(conversationId) || []).filter(message => !message.deletedAt);

  if (before) {
    messages = messages.filter(message => new Date(message.time).getTime() < new Date(before).getTime());
  }

  if (query) {
    messages = messages.filter(message => `${message.name} ${message.text} ${message.attachment?.originalName || message.attachment?.name || ""}`.toLowerCase().includes(query));
  }

  if (user) {
    messages = messages.filter(message => message.userId.toLowerCase().includes(user) || message.name.toLowerCase().includes(user));
  }

  if (fromTime) messages = messages.filter(message => new Date(message.time).getTime() >= fromTime);
  if (toTime) messages = messages.filter(message => new Date(message.time).getTime() <= toTime + 86_399_999);

  const total = messages.length;
  const page = messages.slice(Math.max(0, messages.length - limit));

  return {
    messages: page,
    total,
    limit,
    hasMore: messages.length > page.length,
    nextCursor: page[0]?.time || ""
  };
}

function publicConversations(userId = "") {
  return Object.values(db.conversations || {})
    .map(conversation => ({
      ...conversation,
      unreadCount: unreadCount(conversation, userId),
      readAt: db.readReceipts?.[conversation.id]?.[userId] || ""
    }))
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));
}

function exportMessages(url) {
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const exportUrl = new URL(url.toString());
  exportUrl.searchParams.set("limit", String(MAX_PAGE_SIZE));
  const messages = (messagesByConversation.get(getConversationIdFromUrl(exportUrl)) || [])
    .filter(message => !message.deletedAt);
  if (format === "txt") {
    return {
      contentType: "text/plain; charset=utf-8",
      extension: "txt",
      body: messages.map(message => {
        const file = message.attachment ? ` [${message.attachment.originalName || message.attachment.name || "archivo"}: ${message.attachment.url || ""}]` : "";
        return `[${message.time}] ${message.name}: ${message.text || ""}${file}`;
      }).join("\n")
    };
  }

  return {
    contentType: "application/json; charset=utf-8",
    extension: "json",
    body: JSON.stringify({
      exportedAt: new Date().toISOString(),
      count: messages.length,
      messages
    }, null, 2)
  };
}

function canModifyMessage(message, userId) {
  const profile = profileFor(userId);
  return message.userId === userId || ["admin", "mod"].includes(profile.role);
}

function editMessage(body) {
  const messageId = String(body.messageId || "");
  const userId = String(body.userId || "");
  const text = String(body.text || "").trim().slice(0, 500);
  const message = db.messages.find(item => item.id === messageId);
  if (!message || message.deletedAt) return { status: 404, error: "Mensaje no encontrado." };
  if (!canModifyMessage(message, userId)) return { status: 403, error: "No puedes editar este mensaje." };
  if (!text) return { status: 400, error: "El mensaje no puede quedar vacio." };

  message.text = text;
  message.editedAt = new Date().toISOString();
  upsertConversation(message);
  saveDb();
  logEvent("message.edited", { messageId, userId });
  broadcast("message-update", message);
  broadcast("conversations", publicConversations(userId));
  return { status: 200, message };
}

function deleteMessage(body) {
  const messageId = String(body.messageId || "");
  const userId = String(body.userId || "");
  const message = db.messages.find(item => item.id === messageId);
  if (!message || message.deletedAt) return { status: 404, error: "Mensaje no encontrado." };
  if (!canModifyMessage(message, userId)) return { status: 403, error: "No puedes eliminar este mensaje." };

  message.deletedAt = new Date().toISOString();
  message.deletedBy = userId;
  const conversationId = conversationIdFor(message);
  rebuildConversation(conversationId);
  saveDb();
  cleanupOrphanFiles();
  logEvent("message.deleted", { messageId, userId, conversationId });
  broadcast("message-delete", { id: messageId, conversationId });
  broadcast("conversations", publicConversations(userId));
  return { status: 200, ok: true };
}

function markRead(body) {
  const userId = String(body.userId || "");
  const conversationId = String(body.conversationId || "");
  const readAt = String(body.readAt || new Date().toISOString());
  if (!userId || !conversationId) return { status: 400, error: "Usuario y conversacion son obligatorios." };
  db.readReceipts[conversationId] = db.readReceipts[conversationId] || {};
  db.readReceipts[conversationId][userId] = readAt;
  const readTime = new Date(readAt).getTime();
  (messagesByConversation.get(conversationId) || []).forEach(message => {
    if (message.userId !== userId && new Date(message.time).getTime() <= readTime) {
      message.readBy = Array.isArray(message.readBy) ? message.readBy : [];
      if (!message.readBy.includes(userId)) message.readBy.push(userId);
    }
  });
  saveDb();
  broadcast("read-receipt", { conversationId, userId, readAt });
  return { status: 200, conversationId, userId, readAt };
}

function unreadCount(conversation, userId) {
  if (!userId) return 0;
  const readAt = db.readReceipts?.[conversation.id]?.[userId] || "";
  const readTime = readAt ? new Date(readAt).getTime() : 0;
  return (messagesByConversation.get(conversation.id) || []).filter(message => {
    return !message.deletedAt && message.userId !== userId && new Date(message.time).getTime() > readTime;
  }).length;
}

function cleanupOrphanFiles() {
  try {
    ensureStorageDirs();
    const usedHashes = new Set(db.messages
      .filter(message => !message.deletedAt && message.attachment?.hash)
      .map(message => message.attachment.hash));

    for (const [hash, file] of Object.entries(db.files || {})) {
      if (usedHashes.has(hash)) continue;
      const filePath = path.join(__dirname, file.path || "");
      if (file.path?.startsWith("uploads/") && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      delete db.files[hash];
      logEvent("file.orphan_removed", { hash, path: file.path });
    }

    const knownNames = new Set(Object.values(db.files || {}).map(file => file.name));
    fs.readdirSync(UPLOADS_DIR).forEach(fileName => {
      if (knownNames.has(fileName)) return;
      const filePath = path.join(UPLOADS_DIR, fileName);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        logEvent("file.untracked_removed", { fileName });
      }
    });
  } catch (error) {
    logError(error, { action: "cleanupOrphanFiles" });
  }
}

function sharedFiles(url) {
  const conversationId = getConversationIdFromUrl(url);
  const q = String(url.searchParams.get("q") || "").toLowerCase();
  return (messagesByConversation.get(conversationId) || [])
    .filter(message => !message.deletedAt)
    .flatMap(message => (message.attachments || (message.attachment ? [message.attachment] : [])).map(file => ({
      ...file,
      messageId: message.id,
      userId: message.userId,
      userName: message.name,
      conversationId,
      uploadedAt: file.createdAt || message.time
    })))
    .filter(file => !q || `${file.originalName || file.name}`.toLowerCase().includes(q))
    .sort((left, right) => new Date(right.uploadedAt) - new Date(left.uploadedAt));
}

function publicGuilds() {
  return db.guilds || {};
}

function saveGuild(body) {
  const id = String(body.id || body.name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  if (!id) return { status: 400, error: "Nombre de servidor obligatorio." };
  const existing = db.guilds[id] || {};
  db.guilds[id] = {
    id,
    name: String(body.name || existing.name || id).slice(0, 40),
    short: String(body.short || existing.short || id.slice(0, 2)).slice(0, 4).toUpperCase(),
    topic: String(body.topic || existing.topic || "").slice(0, 120),
    icon: limitProfileImage(body.icon || existing.icon || "", MAX_AVATAR_BYTES, "El icono"),
    banner: limitProfileImage(body.banner || existing.banner || "", MAX_BANNER_BYTES, "El banner"),
    color: String(body.color || existing.color || "#5865f2").slice(0, 16),
    text: Array.isArray(body.text) ? body.text.slice(0, 50) : (existing.text || ["general"]),
    voice: Array.isArray(body.voice) ? body.voice.slice(0, 50) : (existing.voice || ["Sala 1"]),
    roles: existing.roles || {},
    permissions: existing.permissions || {},
    updatedAt: new Date().toISOString()
  };
  saveDb();
  broadcast("guilds", publicGuilds());
  return { status: 200, guild: db.guilds[id] };
}

function deleteGuild(body) {
  const id = String(body.id || "");
  if (!id || id === "mariochat") return { status: 400, error: "No se puede eliminar este servidor." };
  delete db.guilds[id];
  saveDb();
  broadcast("guilds", publicGuilds());
  return { status: 200, ok: true };
}

function handleTyping(body) {
  const userId = String(body.userId || "");
  const name = String(body.name || "Usuario").slice(0, 32);
  const conversationId = String(body.conversationId || "");
  if (!userId || !conversationId) return { status: 400, error: "Typing invalido." };
  const typing = { userId, name, conversationId, expiresAt: Date.now() + 4000 };
  typingStates.set(`${conversationId}:${userId}`, typing);
  broadcast("typing", typing);
  return { status: 200, ok: true };
}

function friendsFor(userId) {
  const friends = db.friends[userId] || [];
  const blocked = db.blockedUsers[userId] || [];
  const requests = db.friendRequests.filter(request => request.to === userId || request.from === userId);
  return {
    friends: friends.map(id => contactFromProfile(id, id)),
    blocked: blocked.map(id => contactFromProfile(id, id)),
    requests
  };
}

function handleFriend(body) {
  const action = String(body.action || "");
  const from = String(body.from || "");
  const to = String(body.to || "");
  if (!from || !to || from === to) return { status: 400, error: "Usuarios invalidos." };
  db.friends[from] = db.friends[from] || [];
  db.friends[to] = db.friends[to] || [];
  db.blockedUsers[from] = db.blockedUsers[from] || [];
  if (action === "request") db.friendRequests.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, from, to, createdAt: new Date().toISOString() });
  if (action === "accept") {
    db.friendRequests = db.friendRequests.filter(request => !(request.from === to && request.to === from));
    if (!db.friends[from].includes(to)) db.friends[from].push(to);
    if (!db.friends[to].includes(from)) db.friends[to].push(from);
  }
  if (action === "block") db.blockedUsers[from].push(to);
  saveDb();
  return { status: 200, state: friendsFor(from) };
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
    maxAttachmentBytes: MAX_ATTACHMENT_BYTES,
    maxAvatarBytes: MAX_AVATAR_BYTES,
    maxBannerBytes: MAX_BANNER_BYTES,
    allowedMimeTypes: Array.from(allowedMimeTypes).filter(type => type !== "application/octet-stream"),
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
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

function serveUpload(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rawPath = decodeURIComponent(url.pathname.replace(/^\/uploads\//, ""));
  const filePath = path.normalize(path.join(UPLOADS_DIR, rawPath));

  if (!filePath.startsWith(UPLOADS_DIR)) {
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
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${path.basename(filePath).replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable"
    });
    res.end(data);
  });
}

loadDb();
setInterval(cleanupOrphanFiles, ORPHAN_CLEANUP_INTERVAL_MS);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const eventUserId = url.searchParams.get("userId") || "";

  if (req.method === "GET" && url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write(`event: state\ndata: ${JSON.stringify(publicState())}\n\n`);
    res.write(`event: conversations\ndata: ${JSON.stringify(publicConversations(eventUserId))}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (req.method === "GET" && url.pathname === "/messages") return sendJson(res, 200, filterMessages(url));
  if (req.method === "GET" && url.pathname === "/conversations") return sendJson(res, 200, publicConversations(url.searchParams.get("userId") || ""));
  if (req.method === "GET" && url.pathname === "/contacts") return sendJson(res, 200, Object.values(db.contacts || {}));
  if (req.method === "GET" && url.pathname === "/guilds") return sendJson(res, 200, publicGuilds());
  if (req.method === "GET" && url.pathname === "/shared-files") return sendJson(res, 200, sharedFiles(url));
  if (req.method === "GET" && url.pathname === "/friends") return sendJson(res, 200, friendsFor(url.searchParams.get("userId") || ""));
  if (req.method === "GET" && url.pathname === "/presence") return sendJson(res, 200, activeUsers());
  if (req.method === "GET" && url.pathname === "/state") return sendJson(res, 200, publicState());

  if (req.method === "GET" && url.pathname === "/export") {
    const exported = exportMessages(url);
    const stamp = new Date().toISOString().slice(0, 10);
    res.writeHead(200, {
      "Content-Type": exported.contentType,
      "Content-Disposition": `attachment; filename="mariochat-${stamp}.${exported.extension}"`,
      "Content-Length": Buffer.byteLength(exported.body)
    });
    res.end(exported.body);
    return;
  }

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
      return sendJson(res, 200, updatePresence(id, String(body.name || "").trim() || "Usuario", body.voiceChannel, body.voiceGuild, body.presence));
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
        presence: ["online", "away", "dnd", "invisible", "offline"].includes(body.presence) ? body.presence : profile.presence,
        color: String(body.color || profile.color).slice(0, 16),
        avatar: limitProfileImage(body.avatar || profile.avatar, MAX_AVATAR_BYTES, "La imagen"),
        banner: limitProfileImage(body.banner || profile.banner, MAX_BANNER_BYTES, "El banner"),
        bio: String(body.bio || profile.bio).slice(0, 240),
        registeredAt: profile.registeredAt || new Date().toISOString(),
        badges: Array.isArray(body.badges) ? body.badges.slice(0, 8) : profile.badges
      };
      upsertContact(id, db.profiles[id].name);
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

  if (req.method === "POST" && url.pathname === "/guilds") {
    try {
      const result = saveGuild(JSON.parse(await readBody(req)));
      return sendJson(res, result.status, result.error ? { error: result.error } : result.guild);
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
  }

  if (req.method === "DELETE" && url.pathname === "/guilds") {
    try {
      const result = deleteGuild(JSON.parse(await readBody(req)));
      return sendJson(res, result.status, result.error ? { error: result.error } : { ok: true });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
  }

  if (req.method === "POST" && url.pathname === "/typing") {
    try {
      const result = handleTyping(JSON.parse(await readBody(req)));
      return sendJson(res, result.status, result.error ? { error: result.error } : { ok: true });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
  }

  if (req.method === "POST" && url.pathname === "/friends") {
    try {
      const result = handleFriend(JSON.parse(await readBody(req)));
      return sendJson(res, result.status, result.error ? { error: result.error } : result.state);
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
  }

  if (req.method === "PUT" && url.pathname === "/messages") {
    try {
      const result = editMessage(JSON.parse(await readBody(req)));
      return sendJson(res, result.status, result.error ? { error: result.error } : result.message);
    } catch (error) {
      logError(error, { route: "PUT /messages" });
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
  }

  if (req.method === "DELETE" && url.pathname === "/messages") {
    try {
      const result = deleteMessage(JSON.parse(await readBody(req)));
      return sendJson(res, result.status, result.error ? { error: result.error } : { ok: true });
    } catch (error) {
      logError(error, { route: "DELETE /messages" });
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
  }

  if (req.method === "POST" && url.pathname === "/read") {
    try {
      const result = markRead(JSON.parse(await readBody(req)));
      return sendJson(res, result.status, result.error ? { error: result.error } : result);
    } catch (error) {
      logError(error, { route: "POST /read" });
      return sendJson(res, 400, { error: error.message || "Solicitud invalida." });
    }
  }

  if (req.method === "POST" && url.pathname === "/reaction") {
    try {
      const body = JSON.parse(await readBody(req));
      const message = db.messages.find(item => item.id === body.messageId);
      if (!message || message.deletedAt) return sendJson(res, 404, { error: "Mensaje no encontrado." });
      const emoji = String(body.emoji || "like").slice(0, 16);
      message.reactions = message.reactions || {};
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

  if (req.method === "GET" && url.pathname.startsWith("/uploads/")) return serveUpload(req, res);
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
