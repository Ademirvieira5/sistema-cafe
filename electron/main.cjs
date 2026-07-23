const { app, BrowserWindow, ipcMain, shell } = require("electron");
const http = require("node:http");
const { copyFileSync, existsSync } = require("node:fs");
const path = require("node:path");

const PORT = 3210;
let mainWindow;
let nextServer;

async function startApplicationServer() {
  const isDevelopment = !app.isPackaged || process.argv.includes("--dev");
  const projectRoot = app.getAppPath();

  if (app.isPackaged) {
    const databaseFile = path.join(app.getPath("userData"), "sistema-cafe.db");
    if (!existsSync(databaseFile)) {
      copyFileSync(path.join(process.resourcesPath, "template.db"), databaseFile);
    }
    const databasePath = databaseFile.replaceAll("\\", "/");
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.NODE_ENV = "production";
  }

  const next = require("next");
  const nextApplication = next({
    dev: isDevelopment,
    dir: projectRoot,
    hostname: "127.0.0.1",
    port: PORT,
  });

  await nextApplication.prepare();
  const handle = nextApplication.getRequestHandler();

  nextServer = http.createServer((request, response) => handle(request, response));
  await new Promise((resolve, reject) => {
    nextServer.once("error", reject);
    nextServer.listen(PORT, "127.0.0.1", resolve);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "Sistema Café BH",
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    frame: false,
    backgroundColor: "#080b0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("window:close", () => mainWindow?.close());
ipcMain.handle("window:is-maximized", () => mainWindow?.isMaximized() ?? false);

app.whenReady().then(async () => {
  await startApplicationServer();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  console.error("Falha ao iniciar o Sistema Café:", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => nextServer?.close());


