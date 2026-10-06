const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('careDesktop',Object.freeze({backup:()=>ipcRenderer.invoke('care:backup'),restore:()=>ipcRenderer.invoke('care:restore'),openData:()=>ipcRenderer.invoke('care:open-data')}));
