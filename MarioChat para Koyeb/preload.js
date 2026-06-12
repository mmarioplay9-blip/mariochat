const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("marioChatDesktop", {
  listDisplaySources: () => ipcRenderer.invoke("display-sources:list"),
  selectDisplaySource: sourceId => ipcRenderer.invoke("display-source:select", sourceId)
});
