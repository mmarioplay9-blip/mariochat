const nameInput = document.querySelector("#nameInput");
const messageInput = document.querySelector("#messageInput");
const messageForm = document.querySelector("#messageForm");
const messagesList = document.querySelector("#messages");
const connectionStatus = document.querySelector("#connectionStatus");
const onlineText = document.querySelector("#onlineText");
const profileAvatar = document.querySelector("#profileAvatar");
const members = document.querySelector("#members");
const guildName = document.querySelector("#guildName");
const channelName = document.querySelector("#channelName");
const channelTopic = document.querySelector("#channelTopic");
const textChannels = document.querySelector("#textChannels");
const voiceChannels = document.querySelector("#voiceChannels");
const addServerButton = document.querySelector("#addServerButton");
const addTextChannelButton = document.querySelector("#addTextChannelButton");
const addVoiceChannelButton = document.querySelector("#addVoiceChannelButton");
const guildMenuButton = document.querySelector("#guildMenuButton");
const inviteButton = document.querySelector("#inviteButton");
const exportJsonButton = document.querySelector("#exportJsonButton");
const exportTxtButton = document.querySelector("#exportTxtButton");
const toggleMembersButton = document.querySelector("#toggleMembersButton");
const searchInput = document.querySelector("#searchInput");
const searchOptionsButton = document.querySelector("#searchOptionsButton");
const searchPanel = document.querySelector("#searchPanel");
const searchUserInput = document.querySelector("#searchUserInput");
const searchFromInput = document.querySelector("#searchFromInput");
const searchToInput = document.querySelector("#searchToInput");
const clearSearchButton = document.querySelector("#clearSearchButton");
const loadMoreButton = document.querySelector("#loadMoreButton");
const emojiButton = document.querySelector("#emojiButton");
const muteButton = document.querySelector("#muteButton");
const deafenButton = document.querySelector("#deafenButton");
const settingsButton = document.querySelector("#settingsButton");
const settingsDialog = document.querySelector("#settingsDialog");
const settingsNameInput = document.querySelector("#settingsNameInput");
const saveSettingsButton = document.querySelector("#saveSettingsButton");
const muteStatus = document.querySelector("#muteStatus");
const deafenStatus = document.querySelector("#deafenStatus");
const chatLayout = document.querySelector(".chat-layout");
const voiceConnection = document.querySelector("#voiceConnection");
const voiceStatus = document.querySelector("#voiceStatus");
const voiceChannelName = document.querySelector("#voiceChannelName");
const leaveVoiceButton = document.querySelector("#leaveVoiceButton");
const remoteAudio = document.querySelector("#remoteAudio");
const attachButton = document.querySelector("#attachButton");
const fileInput = document.querySelector("#fileInput");
const uploadProgress = document.querySelector("#uploadProgress");
const uploadProgressBar = document.querySelector("#uploadProgressBar");
const uploadProgressText = document.querySelector("#uploadProgressText");
const settingsStatusInput = document.querySelector("#settingsStatusInput");
const settingsPresenceInput = document.querySelector("#settingsPresenceInput");
const settingsThemeInput = document.querySelector("#settingsThemeInput");
const settingsColorInput = document.querySelector("#settingsColorInput");
const settingsAvatarInput = document.querySelector("#settingsAvatarInput");
const adminDialog = document.querySelector("#adminDialog");
const adminPinInput = document.querySelector("#adminPinInput");
const adminUserInput = document.querySelector("#adminUserInput");
const adminRoleInput = document.querySelector("#adminRoleInput");
const saveRoleButton = document.querySelector("#saveRoleButton");
const toggleLockButton = document.querySelector("#toggleLockButton");

const guilds = {
  mariochat: {
    name: "MarioChat",
    short: "M",
    topic: "Chat local en tiempo real",
    text: ["general", "avisos", "proyectos"],
    voice: ["Sala 1", "Gaming"]
  },
  "game-chat": {
    name: "Game Chat",
    short: "GC",
    topic: "Partidas, clips y planes de juego",
    text: ["general", "clips", "ranked"],
    voice: ["Squad", "Lobby"]
  },
  equipo: {
    name: "Equipo",
    short: "EQ",
    topic: "Coordinacion del equipo",
    text: ["general", "tareas", "ideas"],
    voice: ["Reunion", "Trabajo"]
  }
};

const savedGuilds = JSON.parse(localStorage.getItem("savedGuilds") || "{}");
const customGuilds = JSON.parse(localStorage.getItem("customGuilds") || "{}");
Object.assign(guilds, savedGuilds);
Object.assign(guilds, customGuilds);

const savedName = localStorage.getItem("chatName") || "";
const userId = localStorage.getItem("userId") || (
  window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
);
let currentGuild = localStorage.getItem("currentGuild") || "mariochat";
let currentChannel = localStorage.getItem("currentChannel") || "general";
let currentMode = "channel";
let dmPeer = null;
let messageHistory = [];
let conversations = [];
let isLoadingHistory = false;
let historyCursor = "";
let hasMoreHistory = false;
let activeConversationId = "";
let editingMessageId = "";
let pendingAttachment = null;
let appState = { roles: {}, lockedChannels: {}, turn: null };
let profile = {
  name: savedName || "Usuario",
  status: localStorage.getItem("profileStatus") || "Disponible",
  presence: localStorage.getItem("profilePresence") || "online",
  color: localStorage.getItem("profileColor") || "#949cf7",
  avatar: localStorage.getItem("profileAvatar") || "",
  theme: localStorage.getItem("theme") || "dark",
  role: "member"
};
let isMuted = localStorage.getItem("isMuted") === "true";
let isDeafened = localStorage.getItem("isDeafened") === "true";
let currentVoiceChannel = "";
let localVoiceStream = null;
let latestUsers = [];
let lastVoiceSignalId = 0;
const handledVoiceSignals = new Set();
const peers = new Map();
let peerConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

if (!guilds[currentGuild]) currentGuild = "mariochat";

localStorage.setItem("userId", userId);
nameInput.value = savedName;

function formatTime(isoTime) {
  return new Intl.DateTimeFormat("es", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoTime));
}

function currentName() {
  return nameInput.value.trim();
}

function displayName() {
  return currentName() || profile.name || "Usuario";
}

function initials(name) {
  const cleanName = String(name || "Usuario").trim();
  return cleanName
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "U";
}

function messageGuild(message) {
  return message.guild || "mariochat";
}

function messageChannel(message) {
  return message.channel || "general";
}

function conversationKeyFor(type, options = {}) {
  if (type === "dm") {
    return `dm:${[userId, options.peerId].filter(Boolean).sort().join(":")}`;
  }
  return `channel:${options.guild || currentGuild}:${options.channel || currentChannel}`;
}

function currentConversationId() {
  return currentMode === "dm" && dmPeer
    ? conversationKeyFor("dm", { peerId: dmPeer.id })
    : conversationKeyFor("channel", { guild: currentGuild, channel: currentChannel });
}

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  profile.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("theme", nextTheme);
}

function searchParams() {
  return {
    q: searchInput.value.trim(),
    user: searchUserInput.value.trim(),
    from: searchFromInput.value,
    to: searchToInput.value
  };
}

function debounce(callback, delay = 250) {
  let timeoutId = 0;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (value >= 1024 * 1024) return `${Math.round(value / 1024 / 1024)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} bytes`;
}

function setUploadProgress(percent, label = "") {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  uploadProgress.hidden = false;
  uploadProgressBar.style.width = `${safePercent}%`;
  uploadProgressText.textContent = label || `${safePercent}%`;
}

function resetUploadProgress() {
  uploadProgress.hidden = true;
  uploadProgressBar.style.width = "0%";
  uploadProgressText.textContent = "0%";
}

function lastMessageForChannel(channel) {
  const conversation = conversations.find(item => item.id === conversationKeyFor("channel", {
    guild: currentGuild,
    channel
  }));
  return conversation?.lastMessage?.text || "";
}

function updateProfile() {
  const name = displayName();
  const shortName = initials(name);
  profile.name = name;
  profileAvatar.replaceChildren();
  if (profile.avatar) {
    const image = document.createElement("img");
    image.src = profile.avatar;
    image.alt = name;
    profileAvatar.append(image);
  } else {
    profileAvatar.textContent = shortName;
  }
}

function updateAudioButtons() {
  muteButton.classList.toggle("active", isMuted);
  deafenButton.classList.toggle("active", isDeafened);
  muteStatus.textContent = isMuted ? "Silenciado" : "Activo";
  deafenStatus.textContent = isDeafened ? "Desactivado" : "Activo";
  if (localVoiceStream) {
    localVoiceStream.getAudioTracks().forEach(track => {
      track.enabled = !isMuted;
    });
  }
  remoteAudio.querySelectorAll("audio").forEach(audio => {
    audio.muted = isDeafened;
  });
}

function renderMembers(users) {
  const activeUsers = users.length ? users : [{ id: userId, name: displayName() }];
  latestUsers = activeUsers;
  onlineText.textContent = String(activeUsers.length);
  members.replaceChildren();

  activeUsers.forEach(user => {
    const item = document.createElement("div");
    item.className = "member";

    const avatar = document.createElement("div");
    avatar.className = `avatar ${user.presence || "online"}`;
    if (user.avatar) {
      const image = document.createElement("img");
      image.src = user.avatar;
      image.alt = user.name;
      avatar.append(image);
    } else {
      avatar.textContent = initials(user.name);
    }

    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = user.name;
    name.style.color = user.roleColor || user.color || "#dbdee1";

    const status = document.createElement("span");
    if (user.voiceChannel && user.voiceGuild === currentGuild) {
      status.textContent = `Voz: ${user.voiceChannel}`;
    } else {
      const presenceLabel = user.presence === "away" ? "Ausente" : user.presence === "offline" ? "Desconectado" : "En linea";
      status.textContent = user.id === userId ? `Tu cuenta - ${presenceLabel}` : (user.status || presenceLabel);
    }

    details.append(name, status);
    item.append(avatar, details);
    item.dataset.userId = user.id;
    item.dataset.name = user.name;
    members.append(item);
  });
  syncVoicePeers();
}

function createChannelButton(channel, type) {
  const button = document.createElement("button");
  button.className = "channel";
  button.type = "button";
  button.dataset.channel = channel;
  button.dataset.type = type;
  if (type === "text" && channel === currentChannel) button.classList.add("active");
  if (type === "voice" && channel === currentVoiceChannel) button.classList.add("voice-joined");
  if (type === "text" && appState.lockedChannels?.[`${currentGuild}:${channel}`]) button.classList.add("locked-channel");

  const icon = document.createElement("span");
  icon.className = "hash";
  icon.textContent = type === "text" ? "#" : ">";

  const label = document.createElement("span");
  label.textContent = channel;
  label.className = "channel-label";

  const last = document.createElement("small");
  last.className = "channel-last";
  last.textContent = type === "text" ? lastMessageForChannel(channel).slice(0, 46) : "";

  const conversation = conversations.find(item => item.id === conversationKeyFor("channel", {
    guild: currentGuild,
    channel
  }));
  const unread = document.createElement("span");
  unread.className = "unread-badge";
  unread.hidden = !conversation?.unreadCount;
  unread.textContent = String(conversation?.unreadCount || "");

  button.append(icon, label, unread, last);
  return button;
}

function renderChannels() {
  const guild = guilds[currentGuild] || guilds.mariochat;
  textChannels.replaceChildren(...guild.text.map(channel => createChannelButton(channel, "text")));
  voiceChannels.replaceChildren(...guild.voice.map(channel => createChannelButton(channel, "voice")));
}

function updateVoiceUi() {
  voiceConnection.hidden = !currentVoiceChannel;
  voiceChannelName.textContent = currentVoiceChannel || "";
  voiceStatus.textContent = currentVoiceChannel ? "Voz conectada" : "Voz desconectada";
  document.querySelectorAll(".channel[data-type='voice']").forEach(button => {
    button.classList.toggle("voice-joined", button.dataset.channel === currentVoiceChannel);
    button.classList.toggle("active", button.dataset.channel === currentVoiceChannel);
  });
}

function renderMessage(message) {
  const item = document.createElement("li");
  item.className = "message";
  item.dataset.id = message.id;
  if (message.name === currentName()) item.classList.add("mine");

  const avatar = document.createElement("div");
  avatar.className = "avatar message-avatar";
  if (message.profile?.avatar) {
    const image = document.createElement("img");
    image.src = message.profile.avatar;
    image.alt = message.name;
    avatar.append(image);
  } else {
    avatar.textContent = initials(message.name);
  }

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const name = document.createElement("span");
  name.className = "message-name";
  name.textContent = message.name;
  name.style.color = message.profile?.roleColor || message.profile?.color || "";

  if (message.profile?.roleName) {
    const role = document.createElement("span");
    role.className = "role-pill";
    role.textContent = message.profile.roleName;
    role.style.color = message.profile.roleColor;
    name.append(role);
  }

  const time = document.createElement("time");
  time.dateTime = message.time;
  time.textContent = `${formatTime(message.time)}${message.editedAt ? " editado" : ""}`;

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = message.text;

  meta.append(name, time);
  item.append(avatar, meta, text);
  if (message.attachment) {
    const attachment = document.createElement("div");
    attachment.className = "message-attachment";
    const source = message.attachment.url || message.attachment.data || "";
    const fileName = message.attachment.originalName || message.attachment.name || "archivo";

    if (source && message.attachment.mime?.startsWith("image/")) {
      const image = document.createElement("img");
      image.src = source;
      image.alt = fileName;
      attachment.append(image);
    } else if (source && message.attachment.mime?.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = source;
      video.controls = true;
      attachment.append(video);
    } else if (source && message.attachment.mime?.startsWith("audio/")) {
      const audio = document.createElement("audio");
      audio.src = source;
      audio.controls = true;
      attachment.append(audio);
    } else {
      const link = document.createElement("a");
      link.href = source || "#";
      link.download = fileName;
      link.textContent = fileName;
      attachment.append(link);
    }
    item.append(attachment);
  }

  const actions = document.createElement("div");
  actions.className = "message-actions";
  ["like", "fire", "haha"].forEach(emoji => {
    const button = document.createElement("button");
    button.className = "reaction-button";
    button.type = "button";
    button.dataset.messageId = message.id;
    button.dataset.emoji = emoji;
    const users = message.reactions?.[emoji] || [];
    button.classList.toggle("active", users.includes(userId));
    button.textContent = `${emoji} ${users.length || ""}`.trim();
    actions.append(button);
  });
  if (message.userId === userId || ["admin", "mod"].includes(profile.role)) {
    const editButton = document.createElement("button");
    editButton.className = "message-tool";
    editButton.type = "button";
    editButton.dataset.action = "edit";
    editButton.dataset.messageId = message.id;
    editButton.textContent = "Editar";

    const deleteButton = document.createElement("button");
    deleteButton.className = "message-tool danger";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.messageId = message.id;
    deleteButton.textContent = "Eliminar";
    actions.append(editButton, deleteButton);
  }
  const readInfo = document.createElement("span");
  readInfo.className = "read-state";
  readInfo.textContent = message.userId === userId ? ((message.readBy || []).length > 1 ? "Leido" : "Enviado") : "";
  actions.append(readInfo);
  item.append(actions);
  messagesList.append(item);
}

function renderMessages() {
  messagesList.replaceChildren();
  const filters = searchParams();
  const query = filters.q.toLowerCase();
  const userQuery = filters.user.toLowerCase();
  const fromTime = filters.from ? new Date(filters.from).getTime() : 0;
  const toTime = filters.to ? new Date(filters.to).getTime() + 86_399_999 : 0;
  const visibleMessages = messageHistory
    .filter(message => {
      if (currentMode === "dm" && dmPeer) {
        return message.type === "dm" &&
          ((message.userId === userId && message.to === dmPeer.id) || (message.userId === dmPeer.id && message.to === userId));
      }
      return message.type !== "dm" && messageGuild(message) === currentGuild && messageChannel(message) === currentChannel;
    })
    .filter(message => {
      if (!query) return true;
      return `${message.name} ${message.text} ${message.attachment?.originalName || ""}`.toLowerCase().includes(query);
    })
    .filter(message => {
      if (!userQuery) return true;
      return message.name.toLowerCase().includes(userQuery) || message.userId.toLowerCase().includes(userQuery);
    })
    .filter(message => {
      const messageTime = new Date(message.time).getTime();
      return (!fromTime || messageTime >= fromTime) && (!toTime || messageTime <= toTime);
    });

  if (!visibleMessages.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = query ? "No se encontraron mensajes." :
      currentMode === "dm" ? `No hay mensajes privados con ${dmPeer?.name || "usuario"}.` : `No hay mensajes en #${currentChannel}.`;
    messagesList.append(emptyItem);
  } else {
    visibleMessages.forEach(renderMessage);
  }

  loadMoreButton.hidden = !hasMoreHistory;
  messagesList.scrollTop = messagesList.scrollHeight;
}

function persistCustomGuilds() {
  localStorage.setItem("savedGuilds", JSON.stringify(guilds));
}

function addChannel(type) {
  const label = type === "text" ? "texto" : "voz";
  const channelNamePrompt = window.prompt(`Nombre del canal de ${label}`);
  if (!channelNamePrompt) return;

  const channel = channelNamePrompt
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/\s+/g, "-")
    .slice(0, 24);
  const guild = guilds[currentGuild];
  if (!guild || !channel) return;

  const list = type === "text" ? guild.text : guild.voice;
  if (list.includes(channel)) return;

  list.push(channel);
  persistCustomGuilds();
  renderChannels();
  if (type === "text") setCurrentChannel(channel);
}

function mergeMessages(nextMessages) {
  const messagesById = new Map(messageHistory.map(message => [message.id, message]));
  nextMessages.forEach(message => messagesById.set(message.id, message));
  messageHistory = Array.from(messagesById.values())
    .sort((left, right) => new Date(left.time) - new Date(right.time));
}

function applyConversations(nextConversations) {
  conversations = Array.isArray(nextConversations) ? nextConversations : [];
  renderChannels();
}

async function loadMessages(options = {}) {
  if (isLoadingHistory) return;
  isLoadingHistory = true;
  const appendOlder = Boolean(options.before);
  const targetConversationId = currentConversationId();

  try {
    if (!appendOlder && targetConversationId !== activeConversationId) {
      messageHistory = [];
      historyCursor = "";
      hasMoreHistory = false;
      activeConversationId = targetConversationId;
    }
    const params = new URLSearchParams(
      currentMode === "dm" && dmPeer
        ? { type: "dm", userId, peerId: dmPeer.id }
        : { type: "channel", guild: currentGuild, channel: currentChannel }
    );
    Object.entries(searchParams()).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set("limit", "50");
    if (options.before) params.set("before", options.before);
    const response = await fetch(`/messages?${params.toString()}`, {
      cache: "no-store"
    });
    if (!response.ok) return;

    const result = await response.json();
    if (!appendOlder) messageHistory = [];
    mergeMessages(result.messages || []);
    historyCursor = result.nextCursor || "";
    hasMoreHistory = Boolean(result.hasMore);
    renderMessages();
    if (!appendOlder) markCurrentConversationRead();
  } finally {
    isLoadingHistory = false;
  }
}

async function loadConversations() {
  const response = await fetch(`/conversations?userId=${encodeURIComponent(userId)}`, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return;
  applyConversations(await response.json());
}

async function markCurrentConversationRead() {
  const conversationId = currentConversationId();
  if (!conversationId) return;
  await fetch("/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, conversationId, readAt: new Date().toISOString() })
  }).catch(() => {});
  loadConversations();
}

function applyState(state) {
  appState = state || appState;
  peerConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      ...(appState.turn ? [appState.turn] : [])
    ]
  };
  renderChannels();
  renderMessages();
}

async function loadState() {
  const response = await fetch("/state", { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return;
  applyState(await response.json());
}

function updateServerButtons() {
  document.querySelectorAll(".server-button[data-guild]").forEach(button => {
    button.classList.toggle("active", button.dataset.guild === currentGuild);
  });
}

function addGuildButton(guildId) {
  const guild = guilds[guildId];
  if (!guild || document.querySelector(`[data-guild="${CSS.escape(guildId)}"]`)) return;

  const button = document.createElement("button");
  button.className = "server-button";
  button.type = "button";
  button.dataset.guild = guildId;
  button.ariaLabel = guild.name;
  button.textContent = guild.short;
  addServerButton.before(button);
}

function updateActiveChannel() {
  document.querySelectorAll(".channel[data-type='text']").forEach(button => {
    button.classList.toggle("active", button.dataset.channel === currentChannel);
  });
}

function setCurrentGuild(guildId) {
  const guild = guilds[guildId];
  if (!guild) return;
  if (currentVoiceChannel && currentGuild !== guildId) {
    leaveVoiceChannel();
  }

  currentGuild = guildId;
  if (!guild.text.includes(currentChannel)) currentChannel = guild.text[0];

  localStorage.setItem("currentGuild", currentGuild);
  localStorage.setItem("currentChannel", currentChannel);
  guildName.textContent = guild.name;
  channelTopic.textContent = guild.topic;

  renderChannels();
  updateServerButtons();
  setCurrentChannel(currentChannel);
}

function setCurrentChannel(channel) {
  const guild = guilds[currentGuild] || guilds.mariochat;
  if (!guild.text.includes(channel)) return;

  currentChannel = channel;
  currentMode = "channel";
  dmPeer = null;
  localStorage.setItem("currentChannel", currentChannel);
  channelName.textContent = currentChannel;
  messageInput.placeholder = `Enviar mensaje a #${currentChannel}`;
  updateActiveChannel();
  activeConversationId = "";
  renderMessages();
  loadMessages();
}

function openDirectMessage(user) {
  if (!user?.id || user.id === userId) return;
  currentMode = "dm";
  dmPeer = user;
  channelName.textContent = `@${user.name}`;
  channelTopic.textContent = "Mensaje privado";
  messageInput.placeholder = `Enviar mensaje privado a ${user.name}`;
  activeConversationId = "";
  renderMessages();
  loadMessages();
}

function setConnected(isConnected) {
  connectionStatus.textContent = isConnected ? "Conectado" : "Reconectando...";
}

function showVisualNotification(message) {
  const notice = document.createElement("div");
  notice.className = "toast";
  notice.textContent = `${message.name}: ${message.text || message.attachment?.originalName || "Archivo"}`;
  document.body.append(notice);
  window.setTimeout(() => notice.remove(), 3500);
}

async function sendPresence() {
  try {
    const response = await fetch("/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: userId,
        name: displayName(),
        presence: profile.presence,
        voiceChannel: currentVoiceChannel,
        voiceGuild: currentVoiceChannel ? currentGuild : ""
      })
    });
    if (!response.ok) return;

    renderMembers(await response.json());
  } catch (error) {
    renderMembers([{ id: userId, name: displayName() }]);
  }
}

function playNotifySound() {
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 740;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);
  } catch (_) {}
}

function readFileAsDataUrl(file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.onprogress = event => {
      if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
    };
    reader.readAsDataURL(file);
  });
}

function requestJson(method, url, payload, onUploadProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onUploadProgress((event.loaded / event.total) * 100);
    };
    xhr.onload = () => {
      const body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        reject(new Error(body?.error || "No se pudo completar la solicitud."));
      }
    };
    xhr.onerror = () => reject(new Error("Error de red durante la subida."));
    xhr.send(JSON.stringify(payload));
  });
}

async function postVoiceSignal(to, type, payload) {
  await fetch("/voice-signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: userId,
      to,
      guild: currentGuild,
      channel: currentVoiceChannel,
      type,
      payload
    })
  }).catch(() => {});
}

function removePeer(peerId) {
  const peer = peers.get(peerId);
  if (peer) peer.close();
  peers.delete(peerId);
  remoteAudio.querySelector(`[data-peer="${CSS.escape(peerId)}"]`)?.remove();
}

function createPeer(peerId) {
  if (peers.has(peerId)) return peers.get(peerId);

  const peer = new RTCPeerConnection(peerConfig);
  peers.set(peerId, peer);

  if (localVoiceStream) {
    localVoiceStream.getTracks().forEach(track => {
      peer.addTrack(track, localVoiceStream);
    });
  }

  peer.addEventListener("icecandidate", event => {
    if (event.candidate) {
      postVoiceSignal(peerId, "candidate", event.candidate);
    }
  });

  peer.addEventListener("track", event => {
    let audio = remoteAudio.querySelector(`[data-peer="${CSS.escape(peerId)}"]`);
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      audio.dataset.peer = peerId;
      remoteAudio.append(audio);
    }
    audio.srcObject = event.streams[0];
    audio.muted = isDeafened;
  });

  peer.addEventListener("connectionstatechange", () => {
    if (peer.connectionState === "connected") {
      voiceStatus.textContent = "Voz conectada";
    }
    if (["closed", "failed", "disconnected"].includes(peer.connectionState)) {
      removePeer(peerId);
      if (currentVoiceChannel && latestUsers.some(user => user.id === peerId && user.voiceChannel === currentVoiceChannel)) {
        window.setTimeout(syncVoicePeers, 1000);
      }
    }
  });

  return peer;
}

async function callPeer(peerId) {
  const peer = createPeer(peerId);
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  await postVoiceSignal(peerId, "offer", peer.localDescription);
}

function syncVoicePeers() {
  if (!currentVoiceChannel || !localVoiceStream) return;

  const voiceUserIds = latestUsers
    .filter(user => user.id !== userId && user.voiceChannel === currentVoiceChannel && user.voiceGuild === currentGuild)
    .map(user => user.id);

  for (const peerId of peers.keys()) {
    if (!voiceUserIds.includes(peerId)) removePeer(peerId);
  }

  voiceUserIds.forEach(peerId => {
    if (!peers.has(peerId) && userId < peerId) {
      callPeer(peerId);
    }
  });
}

async function handleVoiceSignal(signal) {
  if (signal.id && handledVoiceSignals.has(signal.id)) return;
  if (signal.id) {
    handledVoiceSignals.add(signal.id);
    lastVoiceSignalId = Math.max(lastVoiceSignalId, signal.id);
  }
  if (signal.to !== userId || signal.from === userId) return;
  if (!currentVoiceChannel || signal.channel !== currentVoiceChannel) return;

  const peer = createPeer(signal.from);

  if (signal.type === "offer") {
    await peer.setRemoteDescription(new RTCSessionDescription(signal.payload));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await postVoiceSignal(signal.from, "answer", peer.localDescription);
  }

  if (signal.type === "answer") {
    await peer.setRemoteDescription(new RTCSessionDescription(signal.payload));
  }

  if (signal.type === "candidate" && signal.payload) {
    await peer.addIceCandidate(new RTCIceCandidate(signal.payload)).catch(() => {});
  }
}

async function loadVoiceSignals() {
  try {
    const params = new URLSearchParams({
      userId,
      after: String(lastVoiceSignalId)
    });
    const response = await fetch(`/voice-signals?${params.toString()}`, {
      cache: "no-store"
    });
    if (!response.ok) return;

    const signals = await response.json();
    for (const signal of signals) {
      await handleVoiceSignal(signal);
    }
  } catch (error) {
    // Polling is a fallback for voice signaling; failed polls are retried.
  }
}

async function joinVoiceChannel(channel) {
  if (currentVoiceChannel === channel) return;
  await leaveVoiceChannel(false);

  try {
    localVoiceStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localVoiceStream.getAudioTracks().forEach(track => {
      track.enabled = !isMuted;
    });
    currentVoiceChannel = channel;
    updateVoiceUi();
    await sendPresence();
    syncVoicePeers();
    loadVoiceSignals();
    connectionStatus.textContent = `Voz: ${channel}`;
  } catch (error) {
    currentVoiceChannel = "";
    localVoiceStream = null;
    updateVoiceUi();
    connectionStatus.textContent = "Permiso de microfono denegado";
  }
}

async function leaveVoiceChannel(sendUpdate = true) {
  for (const peerId of Array.from(peers.keys())) removePeer(peerId);
  if (localVoiceStream) {
    localVoiceStream.getTracks().forEach(track => track.stop());
  }
  localVoiceStream = null;
  currentVoiceChannel = "";
  updateVoiceUi();
  if (sendUpdate) await sendPresence();
}

async function loadPresence() {
  try {
    const response = await fetch("/presence", { cache: "no-store" });
    if (!response.ok) return;

    renderMembers(await response.json());
  } catch (error) {
    renderMembers([{ id: userId, name: displayName() }]);
  }
}

function connectEvents() {
  const events = new EventSource(`/events?userId=${encodeURIComponent(userId)}`);

  events.addEventListener("open", () => setConnected(true));
  events.addEventListener("error", () => setConnected(false));

  events.addEventListener("history", event => {
    mergeMessages(JSON.parse(event.data));
    renderMessages();
  });

  events.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    const belongsToCurrent = conversationKeyFor(message.type, {
      peerId: message.userId === userId ? message.to : message.userId,
      guild: message.guild,
      channel: message.channel
    }) === currentConversationId();
    if (belongsToCurrent) {
      mergeMessages([message]);
      renderMessages();
      markCurrentConversationRead();
    } else {
      showVisualNotification(message);
    }
    loadConversations();
    if (message.userId !== userId) {
      if (Notification.permission === "granted") {
        new Notification(`MarioChat - ${message.name}`, { body: message.text || "Envio un archivo" });
      }
      playNotifySound();
    }
  });

  events.addEventListener("message-update", event => {
    mergeMessages([JSON.parse(event.data)]);
    renderMessages();
  });

  events.addEventListener("message-delete", event => {
    const deleted = JSON.parse(event.data);
    messageHistory = messageHistory.filter(message => message.id !== deleted.id);
    renderMessages();
    loadConversations();
  });

  events.addEventListener("state", event => {
    applyState(JSON.parse(event.data));
  });

  events.addEventListener("conversations", event => {
    loadConversations();
  });

  events.addEventListener("read-receipt", () => {
    loadConversations();
  });

  events.addEventListener("presence", event => {
    renderMembers(JSON.parse(event.data));
  });

  events.addEventListener("voice-signal", event => {
    handleVoiceSignal(JSON.parse(event.data));
  });
}

document.querySelector(".server-rail").addEventListener("click", event => {
  const button = event.target.closest(".server-button[data-guild]");
  if (!button) return;
  setCurrentGuild(button.dataset.guild);
});

addServerButton.addEventListener("click", () => {
  const serverName = window.prompt("Nombre del servidor");
  if (!serverName) return;

  const id = serverName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!id || guilds[id]) return;

  guilds[id] = {
    name: serverName.trim().slice(0, 28),
    short: initials(serverName),
    topic: `Servidor ${serverName.trim()}`,
    text: ["general", "avisos"],
    voice: ["Sala 1"]
  };

  customGuilds[id] = guilds[id];
  persistCustomGuilds();
  addGuildButton(id);
  setCurrentGuild(id);
});

addTextChannelButton.addEventListener("click", () => addChannel("text"));
addVoiceChannelButton.addEventListener("click", () => addChannel("voice"));

inviteButton.addEventListener("click", async () => {
  const response = await fetch("/invite", { method: "POST" }).catch(() => null);
  const invite = response?.ok ? await response.json() : { id: "directo" };
  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${invite.id}`;
  await navigator.clipboard?.writeText(inviteUrl).catch(() => {});
  inviteButton.textContent = "Copiado";
  window.setTimeout(() => {
    inviteButton.textContent = "Invitar";
  }, 1400);
});

guildMenuButton.addEventListener("click", () => {
  adminDialog.showModal();
});

toggleMembersButton.addEventListener("click", () => {
  chatLayout.classList.toggle("hide-members");
});

const reloadSearch = debounce(() => {
  activeConversationId = "";
  loadMessages();
});

searchInput.addEventListener("input", reloadSearch);
searchUserInput.addEventListener("input", reloadSearch);
searchFromInput.addEventListener("change", reloadSearch);
searchToInput.addEventListener("change", reloadSearch);

searchOptionsButton.addEventListener("click", () => {
  searchPanel.hidden = !searchPanel.hidden;
});

clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  searchUserInput.value = "";
  searchFromInput.value = "";
  searchToInput.value = "";
  activeConversationId = "";
  loadMessages();
});

loadMoreButton.addEventListener("click", () => {
  if (historyCursor) loadMessages({ before: historyCursor });
});

attachButton.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const maxFileSize = appState.maxAttachmentBytes || 100 * 1024 * 1024;
  if (file.size > maxFileSize) {
    window.alert(`El archivo es muy grande. Limite actual: ${formatBytes(maxFileSize)}.`);
    fileInput.value = "";
    return;
  }
  setUploadProgress(0, "Preparando");
  pendingAttachment = {
    name: file.name,
    mime: file.type,
    data: await readFileAsDataUrl(file, percent => setUploadProgress(percent, `Preparando ${Math.round(percent)}%`))
  };
  resetUploadProgress();
  messageInput.placeholder = `Archivo listo: ${file.name}`;
});

function exportCurrentConversation(format) {
  const params = new URLSearchParams(
    currentMode === "dm" && dmPeer
      ? { format, type: "dm", userId, peerId: dmPeer.id }
      : { format, type: "channel", guild: currentGuild, channel: currentChannel }
  );
  window.location.href = `/export?${params.toString()}`;
}

exportJsonButton.addEventListener("click", () => exportCurrentConversation("json"));
exportTxtButton.addEventListener("click", () => exportCurrentConversation("txt"));

emojiButton.addEventListener("click", () => {
  const insert = " :)";
  const start = messageInput.selectionStart;
  const end = messageInput.selectionEnd;
  messageInput.value = `${messageInput.value.slice(0, start)}${insert}${messageInput.value.slice(end)}`;
  messageInput.selectionStart = start + insert.length;
  messageInput.selectionEnd = start + insert.length;
  messageInput.focus();
});

muteButton.addEventListener("click", () => {
  isMuted = !isMuted;
  localStorage.setItem("isMuted", String(isMuted));
  updateAudioButtons();
});

deafenButton.addEventListener("click", () => {
  isDeafened = !isDeafened;
  localStorage.setItem("isDeafened", String(isDeafened));
  updateAudioButtons();
});

leaveVoiceButton.addEventListener("click", () => {
  leaveVoiceChannel();
});

settingsButton.addEventListener("click", () => {
  settingsNameInput.value = displayName();
  settingsStatusInput.value = profile.status;
  settingsPresenceInput.value = profile.presence;
  settingsColorInput.value = profile.color;
  settingsThemeInput.value = profile.theme;
  settingsDialog.showModal();
});

saveSettingsButton.addEventListener("click", async () => {
  const avatarFile = settingsAvatarInput.files?.[0];
  if (avatarFile) {
    if (avatarFile.size > 120_000) {
      window.alert("La foto de perfil debe ser menor de 120 KB.");
      return;
    }
    profile.avatar = await readFileAsDataUrl(avatarFile);
    localStorage.setItem("profileAvatar", profile.avatar);
  }
  nameInput.value = settingsNameInput.value.trim();
  profile.name = displayName();
  profile.status = settingsStatusInput.value.trim() || "Disponible";
  profile.presence = settingsPresenceInput.value || "online";
  profile.color = settingsColorInput.value || "#949cf7";
  profile.theme = settingsThemeInput.value || "dark";
  localStorage.setItem("chatName", currentName());
  localStorage.setItem("profileStatus", profile.status);
  localStorage.setItem("profilePresence", profile.presence);
  localStorage.setItem("profileColor", profile.color);
  applyTheme(profile.theme);
  updateProfile();
  await fetch("/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: userId, ...profile })
  }).catch(() => {});
  sendPresence();
});

saveRoleButton.addEventListener("click", async () => {
  await fetch("/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pin: adminPinInput.value,
      action: "role",
      userId: adminUserInput.value.trim(),
      role: adminRoleInput.value
    })
  }).catch(() => {});
  loadPresence();
});

toggleLockButton.addEventListener("click", async () => {
  const key = `${currentGuild}:${currentChannel}`;
  await fetch("/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pin: adminPinInput.value,
      action: "lock",
      guild: currentGuild,
      channel: currentChannel,
      locked: !appState.lockedChannels?.[key]
    })
  }).catch(() => {});
  loadState();
});

textChannels.addEventListener("click", event => {
  const button = event.target.closest(".channel[data-type='text']");
  if (!button) return;
  setCurrentChannel(button.dataset.channel);
});

members.addEventListener("click", event => {
  const item = event.target.closest(".member");
  if (!item) return;
  adminUserInput.value = item.dataset.userId || "";
  openDirectMessage({ id: item.dataset.userId, name: item.dataset.name });
});

messagesList.addEventListener("click", async event => {
  const tool = event.target.closest(".message-tool");
  if (tool) {
    const message = messageHistory.find(item => item.id === tool.dataset.messageId);
    if (!message) return;

    if (tool.dataset.action === "edit") {
      editingMessageId = message.id;
      messageInput.value = message.text || "";
      messageInput.focus();
      messageInput.placeholder = "Editar mensaje";
      return;
    }

    if (tool.dataset.action === "delete") {
      if (!window.confirm("Eliminar este mensaje?")) return;
      const response = await fetch("/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id, userId })
      }).catch(() => null);
      if (response?.ok) {
        messageHistory = messageHistory.filter(item => item.id !== message.id);
        renderMessages();
      }
      return;
    }
  }

  const button = event.target.closest(".reaction-button");
  if (!button) return;
  const response = await fetch("/reaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messageId: button.dataset.messageId,
      emoji: button.dataset.emoji,
      userId
    })
  }).catch(() => null);
  if (response?.ok) {
    mergeMessages([await response.json()]);
    renderMessages();
  }
});

voiceChannels.addEventListener("click", event => {
  const button = event.target.closest(".channel[data-type='voice']");
  if (!button) return;
  joinVoiceChannel(button.dataset.channel);
});

window.addEventListener("beforeunload", () => {
  if (!currentVoiceChannel) return;
  const payload = JSON.stringify({
    id: userId,
    name: displayName(),
    voiceChannel: "",
    voiceGuild: ""
  });
  navigator.sendBeacon?.("/presence", new Blob([payload], { type: "application/json" }));
});

nameInput.addEventListener("input", () => {
  localStorage.setItem("chatName", currentName());
  updateProfile();
  sendPresence();
  document.querySelectorAll(".message").forEach(item => {
    const author = item.querySelector(".message-name")?.textContent;
    item.classList.toggle("mine", author === currentName());
  });
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = `${messageInput.scrollHeight}px`;
});

messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    messageForm.requestSubmit();
  }
});

messageForm.addEventListener("submit", async event => {
  event.preventDefault();

  const name = currentName();
  const text = messageInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }
  if (!text && !pendingAttachment) return;

  const submitButton = messageForm.querySelector(".send-button");
  submitButton.disabled = true;

  try {
    if (pendingAttachment) setUploadProgress(0, "Subiendo 0%");
    const result = await requestJson(editingMessageId ? "PUT" : "POST", "/messages", editingMessageId ? {
        messageId: editingMessageId,
        userId,
        text
      } : {
        userId,
        name,
        text,
        type: currentMode,
        to: dmPeer?.id || "",
        guild: currentGuild,
        channel: currentChannel,
        attachment: pendingAttachment
      }, percent => setUploadProgress(percent, `Subiendo ${Math.round(percent)}%`));

    if (editingMessageId) {
      mergeMessages([result]);
      renderMessages();
    }

    messageInput.value = "";
    editingMessageId = "";
    pendingAttachment = null;
    fileInput.value = "";
    messageInput.placeholder = currentMode === "dm" && dmPeer
      ? `Enviar mensaje privado a ${dmPeer.name}`
      : `Enviar mensaje a #${currentChannel}`;
    messageInput.style.height = "auto";
    messageInput.focus();
  } catch (error) {
    window.alert(error.message || `No se pudo subir el archivo. Limite actual: ${formatBytes(appState.maxAttachmentBytes || 100 * 1024 * 1024)}.`);
  } finally {
    submitButton.disabled = false;
    resetUploadProgress();
  }
});

applyTheme(profile.theme);
updateProfile();
updateAudioButtons();
updateVoiceUi();
renderMembers([{ id: userId, name: displayName() }]);
Object.keys(customGuilds).forEach(addGuildButton);
setCurrentGuild(currentGuild);
connectEvents();
loadState();
loadMessages();
loadConversations();
fetch("/profile", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: userId, ...profile, name: displayName() })
}).catch(() => {});
sendPresence();
loadPresence();
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission().catch(() => {});
}
setInterval(loadMessages, 3000);
setInterval(sendPresence, 5000);
setInterval(loadPresence, 7000);
setInterval(loadVoiceSignals, 1000);
