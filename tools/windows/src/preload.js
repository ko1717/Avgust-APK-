/**
 * Expone AvgustFileBridge al renderer.
 *
 * Solo implementa la API de almacén local (store*). No se expone begin/append/
 * finish para que la UI siga mostrando «Windows · Sin conexión» (mC() = false).
 * Los respaldos .care360 usan la descarga del navegador embebido.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("AvgustFileBridge", {
  storeLength() {
    return ipcRenderer.sendSync("c360:storeLength");
  },
  storeSlice(start, end) {
    return ipcRenderer.sendSync("c360:storeSlice", start, end);
  },
  storeStart() {
    return ipcRenderer.sendSync("c360:storeStart");
  },
  storeAppend(chunkB64) {
    return ipcRenderer.sendSync("c360:storeAppend", chunkB64);
  },
  storeCommit() {
    return ipcRenderer.sendSync("c360:storeCommit");
  },
});
