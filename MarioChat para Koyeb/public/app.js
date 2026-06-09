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
const sharedFilesButton = document.querySelector("#sharedFilesButton");
const toggleMembersButton = document.querySelector("#toggleMembersButton");
const dmSearchInput = document.querySelector("#dmSearchInput");
const directMessages = document.querySelector("#directMessages");
const searchInput = document.querySelector("#searchInput");
const searchOptionsButton = document.querySelector("#searchOptionsButton");
const searchPanel = document.querySelector("#searchPanel");
const searchUserInput = document.querySelector("#searchUserInput");
const searchFromInput = document.querySelector("#searchFromInput");
const searchToInput = document.querySelector("#searchToInput");
const clearSearchButton = document.querySelector("#clearSearchButton");
const loadMoreButton = document.querySelector("#loadMoreButton");
const typingIndicator = document.querySelector("#typingIndicator");
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
const voiceCallPanel = document.querySelector("#voiceCallPanel");
const callChannelTitle = document.querySelector("#callChannelTitle");
const callParticipantCount = document.querySelector("#callParticipantCount");
const voiceErrorText = document.querySelector("#voiceErrorText");
const voiceStage = document.querySelector("#voiceStage");
const callMuteButton = document.querySelector("#callMuteButton");
const callDeafenButton = document.querySelector("#callDeafenButton");
const cameraButton = document.querySelector("#cameraButton");
const screenShareButton = document.querySelector("#screenShareButton");
const hangupButton = document.querySelector("#hangupButton");
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
const settingsBannerInput = document.querySelector("#settingsBannerInput");
const settingsAvatarSize = document.querySelector("#settingsAvatarSize");
const settingsBannerSize = document.querySelector("#settingsBannerSize");
const settingsBioInput = document.querySelector("#settingsBioInput");
const filesDialog = document.querySelector("#filesDialog");
const fileSearchInput = document.querySelector("#fileSearchInput");
const sharedFilesList = document.querySelector("#sharedFilesList");
const dropOverlay = document.querySelector("#dropOverlay");
const adminDialog = document.querySelector("#adminDialog");
const adminPinInput = document.querySelector("#adminPinInput");
const adminUserInput = document.querySelector("#adminUserInput");
const adminRoleInput = document.querySelector("#adminRoleInput");
const saveRoleButton = document.querySelector("#saveRoleButton");
const toggleLockButton = document.querySelector("#toggleLockButton");

const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
const nativeFetch = window.fetch.bind(window);

function apiUrl(path) {
  if (!path || typeof path !== "string" || path.startsWith("http") || path.startsWith("data:") || path.startsWith("#")) return path;
  return path.startsWith("/") ? `${API_BASE}${path}` : path;
}

window.fetch = (input, init) => {
  if (typeof input === "string") return nativeFetch(apiUrl(input), init);
  return nativeFetch(input, init);
};

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
let pendingAttachments = [];
let dmPins = JSON.parse(localStorage.getItem("dmPins") || "[]");
let typingTimeout = 0;
let appState = { roles: {}, lockedChannels: {}, turn: null };
let profile = {
  name: savedName || "Usuario",
  status: localStorage.getItem("profileStatus") || "Disponible",
  presence: localStorage.getItem("profilePresence") || "online",
  color: localStorage.getItem("profileColor") || "#949cf7",
  avatar: localStorage.getItem("profileAvatar") || "",
  banner: localStorage.getItem("profileBanner") || "",
  bio: localStorage.getItem("profileBio") || "",
  theme: localStorage.getItem("theme") || "dark",
  role: "member"
};
let isMuted = localStorage.getItem("isMuted") === "true";
let isDeafened = localStorage.getItem("isDeafened") === "true";
let currentVoiceChannel = "";
let localVoiceStream = null;
let localCameraStream = null;
let localScreenStream = null;
let latestUsers = [];
let lastVoiceSignalId = 0;
const handledVoiceSignals = new Set();
const peers = new Map();
const peerSenders = new Map();
const remoteStreams = new Map();
const voiceParticipants = new Map();
const audioAnalysers = new Map();
let voiceSocket = null;
let isCameraOn = false;
let isScreenSharing = false;
let lastSpeakingState = false;
let speakingTimer = 0;
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

function fileIcon(file) {
  const name = `${file.originalName || file.name || ""}`.toLowerCase();
  const mime = file.mime || "";
  if (mime.startsWith("image/")) return "IMG";
  if (mime.startsWith("video/")) return "VID";
  if (mime.startsWith("audio/")) return "AUD";
  if (mime.includes("pdf")) return "PDF";
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return "ZIP";
  if (/\.(doc|docx)$/i.test(name)) return "DOC";
  if (/\.(xls|xlsx|csv)$/i.test(name)) return "XLS";
  if (/\.(ppt|pptx)$/i.test(name)) return "PPT";
  if (/\.(js|html|css|py|java|json|ts|jsx|tsx)$/i.test(name)) return "CODE";
  if (/\.(exe|msi|apk|app|dmg)$/i.test(name)) return "APP";
  return "FILE";
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

function dmPeerFromConversation(conversation) {
  const peerId = (conversation.participants || []).find(id => id !== userId) || "";
  const contact = latestUsers.find(user => user.id === peerId) || {};
  return {
    id: peerId,
    name: contact.name || conversation.lastMessage?.name || peerId || "Usuario",
    status: contact.status || "Disponible",
    presence: contact.presence || "offline",
    avatar: contact.avatar || ""
  };
}

function renderDirectMessages() {
  const query = dmSearchInput.value.trim().toLowerCase();
  const dms = conversations
    .filter(conversation => conversation.type === "dm")
    .map(conversation => ({ conversation, peer: dmPeerFromConversation(conversation) }))
    .filter(item => !query || item.peer.name.toLowerCase().includes(query) || item.conversation.lastMessage?.text?.toLowerCase().includes(query))
    .sort((left, right) => {
      const pinnedDelta = Number(dmPins.includes(right.conversation.id)) - Number(dmPins.includes(left.conversation.id));
      if (pinnedDelta) return pinnedDelta;
      return new Date(right.conversation.updatedAt || 0) - new Date(left.conversation.updatedAt || 0);
    });

  directMessages.replaceChildren();
  dms.forEach(({ conversation, peer }) => {
    const button = document.createElement("button");
    button.className = "dm-item";
    button.type = "button";
    button.dataset.peerId = peer.id;
    button.dataset.peerName = peer.name;

    const avatar = document.createElement("div");
    avatar.className = `avatar small ${peer.presence}`;
    if (peer.avatar) {
      const image = document.createElement("img");
      image.src = peer.avatar;
      image.alt = peer.name;
      avatar.append(image);
    } else {
      avatar.textContent = initials(peer.name);
    }

    const details = document.createElement("span");
    details.className = "dm-details";
    details.innerHTML = `<strong></strong><small></small>`;
    details.querySelector("strong").textContent = peer.name;
    details.querySelector("small").textContent = conversation.lastMessage?.text || peer.status || "";

    const unread = document.createElement("span");
    unread.className = "unread-badge";
    unread.hidden = !conversation.unreadCount;
    unread.textContent = String(conversation.unreadCount || "");

    const pin = document.createElement("span");
    pin.className = "dm-pin";
    pin.textContent = dmPins.includes(conversation.id) ? "pin" : "";

    button.append(avatar, details, unread, pin);
    directMessages.append(button);
  });
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
  callMuteButton.classList.toggle("active", isMuted);
  callDeafenButton.classList.toggle("active", isDeafened);
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
  voiceStage.querySelectorAll("video").forEach(video => {
    if (video.srcObject !== localCameraStream && video.srcObject !== localScreenStream) video.muted = isDeafened;
  });
  emitVoiceState("user-muted", { muted: isMuted });
  emitVoiceState("user-deafened", { deafened: isDeafened });
  renderVoicePanel();
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
      const voiceFlags = [
        user.speaking ? "hablando" : "",
        user.muted ? "muteado" : "",
        user.deafened ? "deafened" : "",
        user.cameraOn ? "camara" : "",
        user.screenSharing ? "pantalla" : ""
      ].filter(Boolean);
      status.textContent = `Voz: ${user.voiceChannel}${voiceFlags.length ? ` - ${voiceFlags.join(", ")}` : ""}`;
    } else {
      const presenceLabel = user.presence === "away" ? "Ausente" :
        user.presence === "dnd" ? "No molestar" :
          user.presence === "invisible" || user.presence === "offline" ? "Desconectado" : "En linea";
      status.textContent = user.id === userId ? `Tu cuenta - ${presenceLabel}` : (user.status || presenceLabel);
    }

    details.append(name, status);
    item.append(avatar, details);
    item.dataset.userId = user.id;
    item.dataset.name = user.name;
    item.classList.toggle("muted", Boolean(user.muted));
    item.classList.toggle("speaking", Boolean(user.speaking));
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
  voiceCallPanel.hidden = !currentVoiceChannel;
  voiceChannelName.textContent = currentVoiceChannel || "";
  voiceStatus.textContent = currentVoiceChannel ? "Voz conectada" : "Voz desconectada";
  document.querySelectorAll(".channel[data-type='voice']").forEach(button => {
    button.classList.toggle("voice-joined", button.dataset.channel === currentVoiceChannel);
    button.classList.toggle("active", button.dataset.channel === currentVoiceChannel);
  });
  renderVoicePanel();
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
  const attachments = message.attachments?.length ? message.attachments : (message.attachment ? [message.attachment] : []);
  attachments.forEach(file => {
    const attachment = document.createElement("div");
    attachment.className = "message-attachment";
    const source = apiUrl(file.url || file.data || "");
    const fileName = file.originalName || file.name || "archivo";
    const fileMeta = document.createElement("a");
    fileMeta.className = "file-card";
    fileMeta.href = source || "#";
    fileMeta.download = fileName;
    fileMeta.innerHTML = `<span class="file-icon"></span><span class="file-info"><strong></strong><small></small></span>`;
    fileMeta.querySelector(".file-icon").textContent = fileIcon(file);
    fileMeta.querySelector("strong").textContent = fileName;
    fileMeta.querySelector("small").textContent = `${formatBytes(file.size || 0)} · ${file.createdAt ? new Date(file.createdAt).toLocaleDateString("es") : "archivo"}`;
    attachment.append(fileMeta);

    if (source && file.mime?.startsWith("image/")) {
      const image = document.createElement("img");
      image.src = source;
      image.alt = fileName;
      attachment.append(image);
    } else if (source && file.mime?.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = source;
      video.controls = true;
      attachment.append(video);
    } else if (source && file.mime?.startsWith("audio/")) {
      const audio = document.createElement("audio");
      audio.src = source;
      audio.controls = true;
      attachment.append(audio);
    }
    item.append(attachment);
  });

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
  renderDirectMessages();
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
        voiceGuild: currentVoiceChannel ? currentGuild : "",
        muted: isMuted,
        deafened: isDeafened,
        cameraOn: isCameraOn,
        screenSharing: isScreenSharing,
        speaking: lastSpeakingState
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

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function dataUrlSize(dataUrl) {
  const payload = String(dataUrl || "").split(",")[1] || "";
  return Math.floor(payload.length * 3 / 4);
}

async function compressImageToLimit(file, maxBytes) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  let scale = 1;
  let quality = 0.92;
  let best = source;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const next = canvas.toDataURL("image/jpeg", quality);
    best = next;
    if (dataUrlSize(next) <= maxBytes) return next;
    if (quality > 0.72) {
      quality -= 0.08;
    } else {
      scale *= 0.82;
      quality = 0.88;
    }
  }

  if (dataUrlSize(best) <= maxBytes) return best;
  throw new Error(`No se pudo reducir la imagen por debajo de ${formatBytes(maxBytes)}.`);
}

async function imageFileToProfileDataUrl(file, maxBytes, label) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) throw new Error(`${label} debe ser una imagen.`);
  if (file.size <= maxBytes) return readFileAsDataUrl(file);
  const shouldCompress = window.confirm(`${label} supera el límite permitido de ${formatBytes(maxBytes)}. ¿Quieres reducirla automaticamente?`);
  if (!shouldCompress) throw new Error(`${label} supera el límite permitido de ${formatBytes(maxBytes)}.`);
  return compressImageToLimit(file, maxBytes);
}

function requestJson(method, url, payload, onUploadProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, apiUrl(url));
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
    xhr.onerror = () => reject(new Error(API_BASE ? "No se pudo conectar con el servidor local. Abre MarioChat con Abrir Chat.bat o ejecuta npm start." : "Error de red durante la subida."));
    xhr.send(JSON.stringify(payload));
  });
}

function showVoiceError(message) {
  voiceErrorText.textContent = message || "";
  voiceErrorText.hidden = !message;
}

function currentVoiceRoomUsers() {
  return Array.from(voiceParticipants.values());
}

function localVoiceUser() {
  return {
    id: userId,
    name: displayName(),
    color: profile.color,
    avatar: profile.avatar,
    guild: currentGuild,
    channel: currentVoiceChannel,
    muted: isMuted,
    deafened: isDeafened,
    cameraOn: isCameraOn,
    screenSharing: isScreenSharing,
    speaking: lastSpeakingState,
    cameraStreamId: localCameraStream?.id || "",
    screenStreamId: localScreenStream?.id || ""
  };
}

function streamKindFor(peerId, stream) {
  const participant = voiceParticipants.get(peerId);
  if (participant?.screenStreamId && participant.screenStreamId === stream?.id) return "screen";
  if (participant?.cameraStreamId && participant.cameraStreamId === stream?.id) return "camera";
  return stream?.getVideoTracks().length ? "camera" : "audio";
}

function cardId(peerId, kind) {
  return `voice-card-${CSS.escape(peerId)}-${kind}`;
}

function renderVoicePanel() {
  voiceCallPanel.hidden = !currentVoiceChannel;
  callChannelTitle.textContent = currentVoiceChannel ? `Voz: ${currentVoiceChannel}` : "Sala de voz";
  const users = currentVoiceChannel ? [localVoiceUser(), ...currentVoiceRoomUsers().filter(user => user.id !== userId)] : [];
  callParticipantCount.textContent = `${users.length} conectado${users.length === 1 ? "" : "s"}`;
  callMuteButton.classList.toggle("active", isMuted);
  callDeafenButton.classList.toggle("active", isDeafened);
  cameraButton.classList.toggle("active", isCameraOn);
  screenShareButton.classList.toggle("active", isScreenSharing);

  voiceStage.classList.toggle("has-screen", users.some(user => user.screenSharing));
  voiceStage.replaceChildren();

  users.forEach(user => {
    const remote = remoteStreams.get(user.id) || new Map();
    const cards = [];
    if (user.screenSharing) cards.push({ kind: "screen", stream: user.id === userId ? localScreenStream : remote.get("screen") });
    if (user.cameraOn) cards.push({ kind: "camera", stream: user.id === userId ? localCameraStream : remote.get("camera") });
    if (!cards.length) cards.push({ kind: "audio", stream: null });

    cards.forEach(({ kind, stream }) => {
      const card = document.createElement("article");
      card.className = `voice-card ${kind}`;
      card.id = cardId(user.id, kind);
      card.dataset.userId = user.id;
      card.classList.toggle("speaking", Boolean(user.speaking));
      card.classList.toggle("muted", Boolean(user.muted));
      card.classList.toggle("deafened", Boolean(user.deafened));

      if (stream?.getVideoTracks().length) {
        const video = document.createElement("video");
        video.autoplay = true;
        video.playsInline = true;
        video.muted = user.id === userId || isDeafened;
        video.srcObject = stream;
        card.append(video);
      } else {
        const avatar = document.createElement("div");
        avatar.className = "voice-avatar";
        if (user.avatar) {
          const image = document.createElement("img");
          image.src = user.avatar;
          image.alt = user.name;
          avatar.append(image);
        } else {
          avatar.textContent = initials(user.name);
        }
        card.append(avatar);
      }

      const footer = document.createElement("footer");
      footer.innerHTML = `<strong></strong><span></span>`;
      footer.querySelector("strong").textContent = user.id === userId ? `${user.name} (tu)` : user.name;
      const badges = [
        user.muted ? "muteado" : "",
        user.deafened ? "deafened" : "",
        user.cameraOn ? "camara" : "",
        user.screenSharing ? "pantalla" : "",
        user.speaking ? "hablando" : ""
      ].filter(Boolean);
      footer.querySelector("span").textContent = badges.join(" / ") || "conectado";
      card.append(footer);
      voiceStage.append(card);
    });
  });
}

function emitVoiceState(eventName, payload = {}) {
  if (!voiceSocket?.connected || !currentVoiceChannel) return;
  voiceSocket.emit(eventName, payload);
}

function stopSpeakingDetection() {
  window.clearInterval(speakingTimer);
  speakingTimer = 0;
  lastSpeakingState = false;
  for (const analyser of audioAnalysers.values()) analyser?.context?.close?.().catch(() => {});
  audioAnalysers.clear();
}

function startSpeakingDetection() {
  stopSpeakingDetection();
  const track = localVoiceStream?.getAudioTracks()[0];
  if (!track) return;

  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  context.createMediaStreamSource(new MediaStream([track])).connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  audioAnalysers.set(userId, { context, analyser });

  speakingTimer = window.setInterval(() => {
    analyser.getByteTimeDomainData(data);
    const volume = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length;
    const speaking = !isMuted && volume > 8;
    if (speaking === lastSpeakingState) return;
    lastSpeakingState = speaking;
    emitVoiceState("user-speaking", { speaking });
    renderVoicePanel();
  }, 180);
}

function addLocalTracks(peerId, peer) {
  const senderMap = peerSenders.get(peerId) || new Map();
  [
    [localVoiceStream, "audio"],
    [localCameraStream, "camera"],
    [localScreenStream, "screen"]
  ].forEach(([stream, kind]) => {
    stream?.getTracks().forEach(track => {
      const key = `${kind}:${track.id}`;
      if (!senderMap.has(key)) senderMap.set(key, peer.addTrack(track, stream));
    });
  });
  peerSenders.set(peerId, senderMap);
}

function removeLocalStreamFromPeers(stream) {
  if (!stream) return;
  for (const [peerId, peer] of peers) {
    const senderMap = peerSenders.get(peerId);
    if (!senderMap) continue;
    for (const [key, sender] of senderMap) {
      if (stream.getTracks().includes(sender.track)) {
        peer.removeTrack(sender);
        senderMap.delete(key);
      }
    }
    renegotiatePeer(peerId);
  }
}

function sendWebRtc(to, eventName, payload) {
  if (!voiceSocket?.connected) return;
  voiceSocket.emit(eventName, { to, payload });
}

function removePeer(peerId) {
  const peer = peers.get(peerId);
  if (peer) peer.close();
  peers.delete(peerId);
  peerSenders.delete(peerId);
  remoteStreams.delete(peerId);
  remoteAudio.querySelector(`[data-peer="${CSS.escape(peerId)}"]`)?.remove();
  renderVoicePanel();
}

function createPeer(peerId) {
  if (peers.has(peerId)) return peers.get(peerId);

  const peer = new RTCPeerConnection(peerConfig);
  peers.set(peerId, peer);
  addLocalTracks(peerId, peer);

  peer.addEventListener("icecandidate", event => {
    if (event.candidate) sendWebRtc(peerId, "webrtc-ice-candidate", event.candidate);
  });

  peer.addEventListener("track", event => {
    const stream = event.streams[0] || new MediaStream([event.track]);
    const kind = streamKindFor(peerId, stream);
    if (!remoteStreams.has(peerId)) remoteStreams.set(peerId, new Map());
    remoteStreams.get(peerId).set(kind, stream);

    let audio = remoteAudio.querySelector(`[data-peer="${CSS.escape(peerId)}"]`);
    if (!audio && stream.getAudioTracks().length) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      audio.dataset.peer = peerId;
      remoteAudio.append(audio);
    }
    if (audio) {
      audio.srcObject = stream;
      audio.muted = isDeafened;
    }
    renderVoicePanel();
  });

  peer.addEventListener("connectionstatechange", () => {
    if (peer.connectionState === "connected") voiceStatus.textContent = "Voz conectada";
    if (["closed", "failed", "disconnected"].includes(peer.connectionState)) removePeer(peerId);
  });

  return peer;
}

async function renegotiatePeer(peerId) {
  const peer = peers.get(peerId);
  if (!peer || peer.signalingState !== "stable") return;
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  sendWebRtc(peerId, "webrtc-offer", peer.localDescription);
}

async function callPeer(peerId) {
  const peer = createPeer(peerId);
  await renegotiatePeer(peerId);
}

function syncVoicePeers() {
  if (!currentVoiceChannel || !localVoiceStream) return;
  const voiceUserIds = currentVoiceRoomUsers()
    .filter(user => user.id !== userId)
    .map(user => user.id);

  for (const peerId of Array.from(peers.keys())) {
    if (!voiceUserIds.includes(peerId)) removePeer(peerId);
  }

  voiceUserIds.forEach(peerId => {
    if (!peers.has(peerId) && userId < peerId) callPeer(peerId);
  });
}

async function handleVoiceSignal(eventName, signal) {
  if (signal.to !== userId || signal.from === userId) return;
  if (!currentVoiceChannel || signal.channel !== currentVoiceChannel || signal.guild !== currentGuild) return;

  const peer = createPeer(signal.from);
  if (eventName === "webrtc-offer") {
    await peer.setRemoteDescription(new RTCSessionDescription(signal.payload));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    sendWebRtc(signal.from, "webrtc-answer", peer.localDescription);
  }
  if (eventName === "webrtc-answer") {
    await peer.setRemoteDescription(new RTCSessionDescription(signal.payload));
  }
  if (eventName === "webrtc-ice-candidate" && signal.payload) {
    await peer.addIceCandidate(new RTCIceCandidate(signal.payload)).catch(() => {});
  }
}

function connectVoiceSocket() {
  if (voiceSocket || typeof io !== "function") return;
  voiceSocket = io(API_BASE || undefined, { transports: ["websocket", "polling"] });
  voiceSocket.on("connect", () => {
    if (currentVoiceChannel) {
      voiceSocket.emit("join-voice-channel", {
        userId,
        name: displayName(),
        guild: currentGuild,
        channel: currentVoiceChannel,
        muted: isMuted,
        deafened: isDeafened,
        cameraOn: isCameraOn,
        screenSharing: isScreenSharing,
        cameraStreamId: localCameraStream?.id || "",
        screenStreamId: localScreenStream?.id || ""
      });
    }
  });
  voiceSocket.on("voice-channel-state", state => {
    voiceParticipants.clear();
    (state.users || []).forEach(user => {
      if (user.id !== userId) voiceParticipants.set(user.id, user);
    });
    renderVoicePanel();
    syncVoicePeers();
  });
  voiceSocket.on("voice-user-left", event => removePeer(event.userId));
  ["user-muted", "user-deafened", "user-camera-on", "user-camera-off", "screen-share-start", "screen-share-stop", "user-speaking"].forEach(eventName => {
    voiceSocket.on(eventName, user => {
      if (user.id !== userId) voiceParticipants.set(user.id, user);
      renderVoicePanel();
    });
  });
  ["webrtc-offer", "webrtc-answer", "webrtc-ice-candidate"].forEach(eventName => {
    voiceSocket.on(eventName, signal => handleVoiceSignal(eventName, signal));
  });
}

async function startCamera() {
  if (!currentVoiceChannel || isCameraOn) return;
  try {
    localCameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    isCameraOn = true;
    localCameraStream.getVideoTracks()[0]?.addEventListener("ended", stopCamera);
    for (const [peerId, peer] of peers) {
      addLocalTracks(peerId, peer);
      await renegotiatePeer(peerId);
    }
    emitVoiceState("user-camera-on", { cameraStreamId: localCameraStream.id });
    renderVoicePanel();
  } catch (error) {
    showVoiceError("Permiso de camara denegado.");
  }
}

async function stopCamera() {
  if (!localCameraStream) return;
  const stream = localCameraStream;
  removeLocalStreamFromPeers(stream);
  stream.getTracks().forEach(track => track.stop());
  localCameraStream = null;
  isCameraOn = false;
  emitVoiceState("user-camera-off");
  renderVoicePanel();
}

async function startScreenShare() {
  if (!currentVoiceChannel || isScreenSharing) return;
  try {
    localScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    isScreenSharing = true;
    localScreenStream.getVideoTracks()[0]?.addEventListener("ended", stopScreenShare);
    for (const [peerId, peer] of peers) {
      addLocalTracks(peerId, peer);
      await renegotiatePeer(peerId);
    }
    emitVoiceState("screen-share-start", { screenStreamId: localScreenStream.id });
    renderVoicePanel();
  } catch (error) {
    showVoiceError("No se pudo iniciar la transmision de pantalla.");
  }
}

async function stopScreenShare() {
  if (!localScreenStream) return;
  const stream = localScreenStream;
  removeLocalStreamFromPeers(stream);
  stream.getTracks().forEach(track => track.stop());
  localScreenStream = null;
  isScreenSharing = false;
  emitVoiceState("screen-share-stop");
  renderVoicePanel();
}

async function joinVoiceChannel(channel) {
  if (currentVoiceChannel === channel) return;
  await leaveVoiceChannel(false);
  showVoiceError("");

  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("MediaDevices no disponible.");
    localVoiceStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    localVoiceStream.getAudioTracks().forEach(track => {
      track.enabled = !isMuted;
    });
    currentVoiceChannel = channel;
    connectVoiceSocket();
    updateVoiceUi();
    startSpeakingDetection();
    voiceSocket.emit("join-voice-channel", {
      userId,
      name: displayName(),
      guild: currentGuild,
      channel,
      muted: isMuted,
      deafened: isDeafened,
      cameraOn: false,
      screenSharing: false
    });
    await sendPresence();
    connectionStatus.textContent = `Voz: ${channel}`;
  } catch (error) {
    currentVoiceChannel = "";
    localVoiceStream = null;
    updateVoiceUi();
    showVoiceError("Permiso de microfono denegado.");
    connectionStatus.textContent = "Permiso de microfono denegado";
  }
}

async function leaveVoiceChannel(sendUpdate = true) {
  if (isScreenSharing) await stopScreenShare();
  if (isCameraOn) await stopCamera();
  for (const peerId of Array.from(peers.keys())) removePeer(peerId);
  stopSpeakingDetection();
  if (localVoiceStream) localVoiceStream.getTracks().forEach(track => track.stop());
  localVoiceStream = null;
  currentVoiceChannel = "";
  voiceParticipants.clear();
  voiceSocket?.emit("leave-voice-channel");
  updateVoiceUi();
  renderVoicePanel();
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
  const events = new EventSource(apiUrl(`/events?userId=${encodeURIComponent(userId)}`));

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

  events.addEventListener("typing", event => {
    const typing = JSON.parse(event.data);
    if (typing.userId === userId || typing.conversationId !== currentConversationId()) return;
    typingIndicator.textContent = `${typing.name} esta escribiendo...`;
    typingIndicator.hidden = false;
    window.setTimeout(() => {
      typingIndicator.hidden = true;
    }, 3500);
  });

  events.addEventListener("presence", event => {
    renderMembers(JSON.parse(event.data));
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

async function addPendingFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const maxFileSize = appState.maxAttachmentBytes || 100 * 1024 * 1024;
  const tooLarge = files.find(file => file.size > maxFileSize);
  if (tooLarge) {
    window.alert(`${tooLarge.name} es demasiado grande. Limite actual: ${formatBytes(maxFileSize)}.`);
    return;
  }

  pendingAttachments = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    setUploadProgress(0, `Preparando ${index + 1}/${files.length}`);
    pendingAttachments.push({
      name: file.name,
      mime: file.type,
      data: await readFileAsDataUrl(file, percent => setUploadProgress(percent, `Preparando ${index + 1}/${files.length} ${Math.round(percent)}%`))
    });
  }
  resetUploadProgress();
  messageInput.placeholder = pendingAttachments.length === 1
    ? `Archivo listo: ${pendingAttachments[0].name}`
    : `${pendingAttachments.length} archivos listos`;
}

fileInput.addEventListener("change", async () => {
  await addPendingFiles(fileInput.files);
});

["dragenter", "dragover"].forEach(type => {
  document.addEventListener(type, event => {
    event.preventDefault();
    if (event.dataTransfer?.types?.includes("Files")) dropOverlay.hidden = false;
  });
});

["dragleave", "drop"].forEach(type => {
  document.addEventListener(type, event => {
    event.preventDefault();
    if (type === "drop" && event.dataTransfer?.files?.length) {
      addPendingFiles(event.dataTransfer.files);
    }
    dropOverlay.hidden = true;
  });
});

function exportCurrentConversation(format) {
  const params = new URLSearchParams(
    currentMode === "dm" && dmPeer
      ? { format, type: "dm", userId, peerId: dmPeer.id }
      : { format, type: "channel", guild: currentGuild, channel: currentChannel }
  );
  window.location.href = apiUrl(`/export?${params.toString()}`);
}

exportJsonButton.addEventListener("click", () => exportCurrentConversation("json"));
exportTxtButton.addEventListener("click", () => exportCurrentConversation("txt"));

async function loadSharedFiles() {
  const params = new URLSearchParams(
    currentMode === "dm" && dmPeer
      ? { type: "dm", userId, peerId: dmPeer.id, q: fileSearchInput.value.trim() }
      : { type: "channel", guild: currentGuild, channel: currentChannel, q: fileSearchInput.value.trim() }
  );
  const response = await fetch(`/shared-files?${params.toString()}`, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return;
  const files = await response.json();
  sharedFilesList.replaceChildren();
  if (!files.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No hay archivos compartidos.";
    sharedFilesList.append(empty);
    return;
  }
  files.forEach(file => {
    const link = document.createElement("a");
    link.className = "shared-file";
    link.href = apiUrl(file.url);
    link.download = file.originalName || file.name;
    link.innerHTML = `<span class="file-icon"></span><span><strong></strong><small></small></span>`;
    link.querySelector(".file-icon").textContent = fileIcon(file);
    link.querySelector("strong").textContent = file.originalName || file.name;
    link.querySelector("small").textContent = `${formatBytes(file.size || 0)} · ${file.userName || "Usuario"} · ${new Date(file.uploadedAt).toLocaleDateString("es")}`;
    sharedFilesList.append(link);
  });
}

sharedFilesButton.addEventListener("click", () => {
  filesDialog.showModal();
  loadSharedFiles();
});

fileSearchInput.addEventListener("input", debounce(loadSharedFiles, 250));

function updateProfileImageSizeLabels() {
  const avatarFile = settingsAvatarInput.files?.[0];
  const bannerFile = settingsBannerInput.files?.[0];
  settingsAvatarSize.textContent = avatarFile
    ? `${avatarFile.name} · ${formatBytes(avatarFile.size)} / limite ${formatBytes(appState.maxAvatarBytes || 10 * 1024 * 1024)}`
    : `Limite ${formatBytes(appState.maxAvatarBytes || 10 * 1024 * 1024)}`;
  settingsBannerSize.textContent = bannerFile
    ? `${bannerFile.name} · ${formatBytes(bannerFile.size)} / limite ${formatBytes(appState.maxBannerBytes || 20 * 1024 * 1024)}`
    : `Limite ${formatBytes(appState.maxBannerBytes || 20 * 1024 * 1024)}`;
}

settingsAvatarInput.addEventListener("change", updateProfileImageSizeLabels);
settingsBannerInput.addEventListener("change", updateProfileImageSizeLabels);

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

callMuteButton.addEventListener("click", () => {
  muteButton.click();
});

callDeafenButton.addEventListener("click", () => {
  deafenButton.click();
});

cameraButton.addEventListener("click", () => {
  if (isCameraOn) {
    stopCamera();
  } else {
    startCamera();
  }
});

screenShareButton.addEventListener("click", () => {
  if (isScreenSharing) {
    stopScreenShare();
  } else {
    startScreenShare();
  }
});

hangupButton.addEventListener("click", () => {
  leaveVoiceChannel();
});

leaveVoiceButton.addEventListener("click", () => {
  leaveVoiceChannel();
});

settingsButton.addEventListener("click", () => {
  settingsNameInput.value = displayName();
  settingsStatusInput.value = profile.status;
  settingsPresenceInput.value = profile.presence;
  settingsBioInput.value = profile.bio;
  settingsColorInput.value = profile.color;
  settingsThemeInput.value = profile.theme;
  updateProfileImageSizeLabels();
  settingsDialog.showModal();
});

saveSettingsButton.addEventListener("click", async () => {
  try {
    const avatarFile = settingsAvatarInput.files?.[0];
    const bannerFile = settingsBannerInput.files?.[0];
    if (avatarFile) {
      profile.avatar = await imageFileToProfileDataUrl(avatarFile, appState.maxAvatarBytes || 10 * 1024 * 1024, "La imagen");
      localStorage.setItem("profileAvatar", profile.avatar);
    }
    if (bannerFile) {
      profile.banner = await imageFileToProfileDataUrl(bannerFile, appState.maxBannerBytes || 20 * 1024 * 1024, "El banner");
      localStorage.setItem("profileBanner", profile.banner);
    }
  } catch (error) {
    window.alert(error.message || "No se pudo procesar la imagen.");
    return;
  }
  nameInput.value = settingsNameInput.value.trim();
  profile.name = displayName();
  profile.status = settingsStatusInput.value.trim() || "Disponible";
  profile.presence = settingsPresenceInput.value || "online";
  profile.bio = settingsBioInput.value.trim();
  profile.color = settingsColorInput.value || "#949cf7";
  profile.theme = settingsThemeInput.value || "dark";
  localStorage.setItem("chatName", currentName());
  localStorage.setItem("profileStatus", profile.status);
  localStorage.setItem("profilePresence", profile.presence);
  localStorage.setItem("profileBio", profile.bio);
  localStorage.setItem("profileColor", profile.color);
  applyTheme(profile.theme);
  updateProfile();
  const response = await fetch("/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: userId, ...profile })
  }).catch(() => {});
  if (response && !response.ok) {
    const result = await response.json().catch(() => ({}));
    window.alert(result.error || "No se pudo guardar el perfil.");
    return;
  }
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

textChannels.addEventListener("contextmenu", event => {
  const button = event.target.closest(".channel[data-type='text']");
  if (!button) return;
  event.preventDefault();
  const action = window.prompt("Canal: escribir 'editar' o 'eliminar'");
  const guild = guilds[currentGuild];
  if (!guild) return;
  if (action === "editar") {
    const nextName = window.prompt("Nuevo nombre del canal", button.dataset.channel);
    if (!nextName) return;
    guild.text = guild.text.map(channel => channel === button.dataset.channel ? nextName.trim().slice(0, 24) : channel);
    persistCustomGuilds();
    renderChannels();
  }
  if (action === "eliminar" && window.confirm("Eliminar canal?")) {
    guild.text = guild.text.filter(channel => channel !== button.dataset.channel);
    persistCustomGuilds();
    if (currentChannel === button.dataset.channel) currentChannel = guild.text[0] || "general";
    renderChannels();
    setCurrentChannel(currentChannel);
  }
});

directMessages.addEventListener("click", event => {
  const item = event.target.closest(".dm-item");
  if (!item) return;
  openDirectMessage({ id: item.dataset.peerId, name: item.dataset.peerName });
});

directMessages.addEventListener("contextmenu", event => {
  const item = event.target.closest(".dm-item");
  if (!item) return;
  event.preventDefault();
  const conversationId = conversationKeyFor("dm", { peerId: item.dataset.peerId });
  if (dmPins.includes(conversationId)) {
    dmPins = dmPins.filter(id => id !== conversationId);
  } else {
    dmPins.push(conversationId);
  }
  localStorage.setItem("dmPins", JSON.stringify(dmPins));
  renderDirectMessages();
});

dmSearchInput.addEventListener("input", renderDirectMessages);

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
  navigator.sendBeacon?.(apiUrl("/presence"), new Blob([payload], { type: "application/json" }));
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
  window.clearTimeout(typingTimeout);
  typingTimeout = window.setTimeout(() => {
    fetch("/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name: displayName(), conversationId: currentConversationId() })
    }).catch(() => {});
  }, 180);
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
  if (!text && !pendingAttachments.length) return;

  const submitButton = messageForm.querySelector(".send-button");
  submitButton.disabled = true;

  try {
    if (pendingAttachments.length) setUploadProgress(0, "Subiendo 0%");
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
        attachment: pendingAttachments[0] || null,
        attachments: pendingAttachments
      }, percent => setUploadProgress(percent, `Subiendo ${Math.round(percent)}%`));

    if (editingMessageId) {
      mergeMessages([result]);
      renderMessages();
    }

    messageInput.value = "";
    editingMessageId = "";
    pendingAttachments = [];
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
