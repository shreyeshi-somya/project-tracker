import { app, BrowserWindow } from "electron";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, copyFileSync, mkdirSync } from "fs";
import { createServer } from "net";

const __dirname = dirname(fileURLToPath(import.meta.url));

app.setName("Project Tracker");

let mainWindow;

function findFreePort(startPort) {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", () => {
      resolve(findFreePort(startPort + 1));
    });
  });
}

function getResourcePath(filename) {
  // In packaged app, extraResources go to Contents/Resources/
  // In dev, they're in the assets/ directory
  const packagedPath = join(process.resourcesPath || __dirname, filename);
  const devPath = join(__dirname, "assets", filename);
  if (existsSync(packagedPath)) return packagedPath;
  if (existsSync(devPath)) return devPath;
  return null;
}

async function createWindow() {
  const port = await findFreePort(3001);

  // Use Electron's user data directory for persistent storage
  const userDataPath = app.getPath("userData");
  mkdirSync(userDataPath, { recursive: true });

  // Copy projects.json from resources on first launch
  const userDbPath = join(userDataPath, "projects.json");
  if (!existsSync(userDbPath)) {
    const bundledDb = getResourcePath("projects.json");
    if (bundledDb) copyFileSync(bundledDb, userDbPath);
  }

  // Copy .env from resources on first launch
  // electron-builder renames .env to env.conf to avoid dotfile filtering
  const userEnvPath = join(userDataPath, ".env");
  if (!existsSync(userEnvPath)) {
    const bundledEnv = getResourcePath(".env") || getResourcePath("env.conf");
    if (bundledEnv) copyFileSync(bundledEnv, userEnvPath);
  }

  // Load .env from user data directory
  const dotenv = await import("dotenv");
  dotenv.config({ path: userEnvPath, override: true });

  // Tell the server where to store data
  const { startServer, expressApp, setDataDir } = await import("./server.js");
  setDataDir(userDataPath);

  // Serve built frontend files through Express
  const distPath = join(__dirname, "dist");
  if (existsSync(distPath)) {
    const { default: express } = await import("express");
    expressApp.use(express.static(distPath));
    expressApp.get("*", (req, res) => {
      if (!req.path.startsWith("/api")) {
        res.sendFile(join(distPath, "index.html"));
      }
    });
  }

  await startServer(port);

  console.log(`Data directory: ${userDataPath}`);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Project Tracker",
    icon: join(__dirname, "assets", "icon.icns"),
    titleBarStyle: "hiddenInset",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (process.platform === "darwin" && app.dock) {
    const iconPath = getResourcePath("icon-padded.png");
    if (iconPath) app.dock.setIcon(iconPath);
  }
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
