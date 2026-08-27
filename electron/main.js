import { app, BrowserWindow, dialog, Menu, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.platform === 'win32' && process.argv.includes('--squirrel-firstrun')) {
  app.quit();
}

const isDev = !!process.env.VITE_DEV_SERVER_URL;

const createMenu = () => {
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { role: 'redo', accelerator: 'Shift+CmdOrCtrl+Z' },
        { type: 'separator' },
        { role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { role: 'paste', accelerator: 'CmdOrCtrl+V' },
        { role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
      ],
    },
    {
      label: 'Opmaak',
      submenu: [
        {
          label: 'Titel',
          accelerator: 'Shift+CmdOrCtrl+T',
          click: (_menuItem, browserWindow) => {
            browserWindow?.webContents.send('note-format', 'title');
          },
        },
        {
          label: 'Koptekst',
          accelerator: 'Shift+CmdOrCtrl+H',
          click: (_menuItem, browserWindow) => {
            browserWindow?.webContents.send('note-format', 'h1');
          },
        },
        {
          label: 'Subkop',
          accelerator: 'Shift+CmdOrCtrl+J',
          click: (_menuItem, browserWindow) => {
            browserWindow?.webContents.send('note-format', 'h2');
          },
        },
        {
          label: 'Kop 3',
          accelerator: 'Shift+CmdOrCtrl+I',
          click: (_menuItem, browserWindow) => {
            browserWindow?.webContents.send('note-format', 'h3');
          },
        },
        {
          label: 'Hoofdtekst',
          accelerator: 'Shift+CmdOrCtrl+B',
          click: (_menuItem, browserWindow) => {
            browserWindow?.webContents.send('note-format', 'p');
          },
        },
        {
          label: 'Met één opmaak',
          accelerator: 'Shift+CmdOrCtrl+M',
          click: (_menuItem, browserWindow) => {
            browserWindow?.webContents.send('note-format', 'code');
          },
        },
        { type: 'separator' },
        {
          label: 'Opsommingstekenslijst',
          accelerator: 'Shift+CmdOrCtrl+7',
          click: (_menuItem, browserWindow) => {
            browserWindow?.webContents.send('note-format', 'bullet');
          },
        },
        {
          label: 'Genummerde lijst',
          accelerator: 'Shift+CmdOrCtrl+9',
          click: (_menuItem, browserWindow) => {
            browserWindow?.webContents.send('note-format', 'number');
          },
        },
        {
          label: 'Checklist',
          accelerator: 'Shift+CmdOrCtrl+L',
          click: (_menuItem, browserWindow) => {
            browserWindow?.webContents.send('note-format', 'checklist');
          },
        },
        {
          label: 'Markeer als afgevinkt',
          accelerator: 'Shift+CmdOrCtrl+U',
          click: (_menuItem, browserWindow) => {
            browserWindow?.webContents.send('note-format', 'toggle-check');
          },
        },
        {
          label: 'Blokcitaat',
          accelerator: 'Alt+CmdOrCtrl+\'',
          click: (_menuItem, browserWindow) => {
            browserWindow?.webContents.send('note-format', 'quote');
          },
        },
        { type: 'separator' },
        {
          label: 'Inspringing',
          submenu: [
            {
              label: 'Verhoog',
              accelerator: 'CmdOrCtrl+]',
              click: (_menuItem, browserWindow) => {
                browserWindow?.webContents.send('note-format', 'indent');
              },
            },
            {
              label: 'Verlaag',
              accelerator: 'CmdOrCtrl+[',
              click: (_menuItem, browserWindow) => {
                browserWindow?.webContents.send('note-format', 'outdent');
              },
            },
          ],
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: () => {
            shell.openExternal('https://github.com/DaphneHoutackers/BiBaBench-Buddy');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/DaphneHoutackers/BiBaBench-Buddy/issues');
          },
        },
        { type: 'separator' },
        {
          label: 'Buy me a cookie',
          click: () => {
            shell.openExternal('https://www.buymeacoffee.com/daphnewoodpecker');
          },
        },
      ],
    },
    ...(isDev
      ? [
        {
          label: 'Developer',
          submenu: [
            { role: 'reload' },
            { role: 'forcereload' },
            { role: 'toggleDevTools' },
          ],
        },
      ]
      : []),
  ]);
  Menu.setApplicationMenu(menu);
};

const createWindow = async () => {
  const pngIconPath = path.join(__dirname, '..', 'public', 'icon-512.png');

  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 788,
    minWidth: 800,
    minHeight: 500,
    show: false,
    titleBarStyle: 'hiddenInset',
    icon: pngIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  });

  const csp = isDev
    ? "default-src 'self' 'unsafe-inline' data: blob:; connect-src 'self' ws://localhost:* http://localhost:* data: blob: https://*.supabase.co https://generativelanguage.googleapis.com https://api.groq.com https://api.openai.com https://openrouter.ai; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:;"
    : "default-src 'self' data: blob:; connect-src 'self' data: blob: https://*.supabase.co https://generativelanguage.googleapis.com https://api.groq.com https://api.openai.com https://openrouter.ai; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:;";

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('context-menu', (event, params) => {
    const menuTemplate = [];

    if (params.isEditable) {
      menuTemplate.push(
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' }
      );
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup({ window: mainWindow });
    } else if (params.selectionText && params.selectionText.trim() !== '') {
      menuTemplate.push({ role: 'copy' });
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup({ window: mainWindow });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  console.log('VITE_DEV_SERVER_URL:', devServerUrl);

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // macOS: Hide window instead of destroying it, so localStorage (auth session) persists
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  setTimeout(() => {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1000);

  return mainWindow;
};

let mainWindow = null;

app.whenReady().then(async () => {
  createMenu();

  mainWindow = await createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

ipcMain.handle('export-note-pdf', async (_event, { title, html }) => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title || 'Note'}</title>
        <style>
          @page { margin: 20mm; size: A4; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            margin: 0;
            padding: 0;
          }
          h1.note-title {
            font-size: 24px;
            font-weight: 800;
            margin: 0 0 16px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
          }
          h1 { font-size: 20px; font-weight: 700; margin: 16px 0 8px 0; }
          h2 { font-size: 17px; font-weight: 700; margin: 14px 0 6px 0; }
          h3 { font-size: 15px; font-weight: 600; margin: 12px 0 4px 0; }
          h4 { font-size: 13px; font-weight: 600; margin: 10px 0 4px 0; }
          p { margin: 6px 0; font-size: 13px; }
          blockquote {
            margin: 10px 0;
            border-left: 3px solid #94a3b8;
            padding-left: 12px;
            color: #475569;
            font-style: italic;
          }
          ul, ol { margin: 6px 0; padding-left: 20px; font-size: 13px; }
          ul[data-checklist] { list-style: none; padding-left: 0; }
          ul[data-checklist] li {
            position: relative;
            padding-left: 24px;
            margin: 4px 0;
          }
          ul[data-checklist] li input[type="checkbox"] {
            position: absolute;
            left: 0;
            top: 3px;
          }
          .note-code pre {
            background: #f1f5f9;
            padding: 10px 14px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 12px;
            border: 1px solid #e2e8f0;
          }
          a { color: #db2777; text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1 class="note-title">${title || 'Untitled note'}</h1>
        <div>${html}</div>
      </body>
    </html>
  `;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
  const pdfData = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
  });
  win.destroy();

  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Save Note as PDF',
    defaultPath: `${(title || 'note').replace(/[/\\?%*:|"<>]/g, '_')}.pdf`,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });

  if (!canceled && filePath) {
    await fs.promises.writeFile(filePath, pdfData);
    shell.showItemInFolder(filePath);
    return { success: true, filePath };
  }
  return { canceled: true };
});

// Set quitting flag so the window close handler allows actual quit
app.on('before-quit', () => {
  app.isQuitting = true;
});

autoUpdater.on('update-downloaded', () => {
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: 'A new version has been downloaded. Restart the app to install the update.',
      buttons: ['Restart now', 'Later'],
    })
    .then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
});

autoUpdater.on('error', (error) => {
  console.error('Auto updater error:', error);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().then(win => { mainWindow = win; });
  }
});
