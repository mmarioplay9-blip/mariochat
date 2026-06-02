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
const inviteButton = document.querySelector("#inviteButton");
const toggleMembersButton = document.querySelector("#toggleMembersButton");
const searchInput = document.querySelector("#searchInput");
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
let messageHistory = [];
let isLoadingHistory = false;
let isMuted = localStorage.getItem("isMuted") === "true";
let isDeafened = localStorage.getItem("isDeafened") === "true";
let currentVoiceChannel = "";
let localVoiceStream = null;
let latestUsers = [];
let lastVoiceSignalId = 0;
const handledVoiceSignals = new Set();
const peers = new Map();
const peerConfig = {
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
  return currentName() || "Usuario";
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

function updateProfile() {
  const name = displayName();
  const shortName = initials(name);
  profileAvatar.textContent = shortName;
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
    avatar.className = "avatar online";
    avatar.textContent = initials(user.name);

    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = user.name;

    const status = document.createElement("span");
    if (user.voiceChannel && user.voiceGuild === currentGuild) {
      status.textContent = `Voz: ${user.voiceChannel}`;
    } else {
      status.textContent = user.id === userId ? "Tu cuenta" : "Disponible";
    }

    details.append(name, status);
    item.append(avatar, details);
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

  const icon = document.createElement("span");
  icon.className = "hash";
  icon.textContent = type === "text" ? "#" : ">";

  const label = document.createElement("span");
  label.textContent = channel;

  button.append(icon, label);
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
  avatar.textContent = initials(message.name);

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const name = document.createElement("span");
  name.className = "message-name";
  name.textContent = message.name;

  const time = document.createElement("time");
  time.dateTime = message.time;
  time.textContent = formatTime(message.time);

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = message.text;

  meta.append(name, time);
  item.append(avatar, meta, text);
  messagesList.append(item);
}

function renderMessages() {
  messagesList.replaceChildren();
  const query = searchInput.value.trim().toLowerCase();
  const visibleMessages = messageHistory
    .filter(message => messageGuild(message) === currentGuild && messageChannel(message) === currentChannel)
    .filter(message => {
      if (!query) return true;
      return `${message.name} ${message.text}`.toLowerCase().includes(query);
    });

  if (!visibleMessages.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = query ? "No se encontraron mensajes." : `No hay mensajes en #${currentChannel}.`;
    messagesList.append(emptyItem);
  } else {
    visibleMessages.forEach(renderMessage);
  }

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

async function loadMessages() {
  if (isLoadingHistory) return;
  isLoadingHistory = true;

  try {
    const params = new URLSearchParams({
      guild: currentGuild,
      channel: currentChannel
    });
    const response = await fetch(`/messages?${params.toString()}`, {
      cache: "no-store"
    });
    if (!response.ok) return;

    const messages = await response.json();
    mergeMessages(messages);
    renderMessages();
  } finally {
    isLoadingHistory = false;
  }
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
  localStorage.setItem("currentChannel", currentChannel);
  channelName.textContent = currentChannel;
  messageInput.placeholder = `Enviar mensaje a #${currentChannel}`;
  updateActiveChannel();
  renderMessages();
  loadMessages();
}

function setConnected(isConnected) {
  connectionStatus.textContent = isConnected ? "Conectado" : "Reconectando...";
}

async function sendPresence() {
  try {
    const response = await fetch("/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: userId,
        name: displayName(),
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
  const events = new EventSource("/events");

  events.addEventListener("open", () => setConnected(true));
  events.addEventListener("error", () => setConnected(false));

  events.addEventListener("history", event => {
    mergeMessages(JSON.parse(event.data));
    renderMessages();
  });

  events.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    mergeMessages([message]);
    if (messageGuild(message) === currentGuild && messageChannel(message) === currentChannel) {
      renderMessages();
    }
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
  await navigator.clipboard?.writeText(window.location.href).catch(() => {});
  inviteButton.textContent = "Copiado";
  window.setTimeout(() => {
    inviteButton.textContent = "Invitar";
  }, 1400);
});

toggleMembersButton.addEventListener("click", () => {
  chatLayout.classList.toggle("hide-members");
});

searchInput.addEventListener("input", renderMessages);

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
  settingsDialog.showModal();
});

saveSettingsButton.addEventListener("click", () => {
  nameInput.value = settingsNameInput.value.trim();
  localStorage.setItem("chatName", currentName());
  updateProfile();
  sendPresence();
});

textChannels.addEventListener("click", event => {
  const button = event.target.closest(".channel[data-type='text']");
  if (!button) return;
  setCurrentChannel(button.dataset.channel);
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
  if (!text) return;

  const submitButton = messageForm.querySelector(".send-button");
  submitButton.disabled = true;

  try {
    const response = await fetch("/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        text,
        guild: currentGuild,
        channel: currentChannel
      })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "No se pudo enviar el mensaje.");
    }

    messageInput.value = "";
    messageInput.style.height = "auto";
    messageInput.focus();
  } finally {
    submitButton.disabled = false;
  }
});

updateProfile();
updateAudioButtons();
updateVoiceUi();
renderMembers([{ id: userId, name: displayName() }]);
Object.keys(customGuilds).forEach(addGuildButton);
setCurrentGuild(currentGuild);
connectEvents();
loadMessages();
sendPresence();
loadPresence();
setInterval(loadMessages, 3000);
setInterval(sendPresence, 5000);
setInterval(loadPresence, 7000);
setInterval(loadVoiceSignals, 1000);
