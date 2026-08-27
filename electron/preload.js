import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onNoteFormat: (callback) => {
    const subscription = (_event, format) => callback(format);
    ipcRenderer.on('note-format', subscription);
    return () => ipcRenderer.removeListener('note-format', subscription);
  },
  exportNotePdf: (data) => ipcRenderer.invoke('export-note-pdf', data),
});
