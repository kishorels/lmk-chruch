const { app, BrowserWindow, ipcMain, screen, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const db = require("./database");

let mainWindow;
let presentationWindow;

// Media storage directory
const mediaDir = path.join(app.getPath('userData'), 'media');

function ensureMediaDir() {
    if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
    }
}

// Convert file to base64 data URL
function fileToDataUrl(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;

    const ext = path.extname(filePath).toLowerCase().slice(1);
    const mimeTypes = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        bmp: 'image/bmp',
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        avi: 'video/x-msvideo',
        mkv: 'video/x-matroska'
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        backgroundColor: '#0a0a1a',
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        },
    });

    mainWindow.loadURL("http://localhost:5173");

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (presentationWindow) {
            presentationWindow.close();
        }
    });
}

function createPresentationWindow() {
    const displays = screen.getAllDisplays();
    const externalDisplay = displays.length > 1 ? displays[1] : displays[0];

    presentationWindow = new BrowserWindow({
        x: externalDisplay.bounds.x,
        y: externalDisplay.bounds.y,
        fullscreen: true,
        frame: false,
        backgroundColor: '#000000',
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        },
    });

    presentationWindow.loadURL("http://localhost:5173/#/present");

    presentationWindow.on('closed', () => {
        presentationWindow = null;
    });
}

// Initialize database and media directory
app.whenReady().then(() => {
    ensureMediaDir();
    db.initializeDatabase();
    createMainWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// Presentation controls
ipcMain.on("open-presentation", () => {
    if (!presentationWindow) {
        createPresentationWindow();
    }
});

ipcMain.on("close-presentation", () => {
    if (presentationWindow) {
        presentationWindow.close();
        presentationWindow = null;
    }
});

ipcMain.on("send-to-presentation", (event, data) => {
    if (presentationWindow) {
        presentationWindow.webContents.send("present-data", data);
    }
});

// Get data URL for a file path
ipcMain.handle("get-file-data-url", (event, filePath) => {
    return fileToDataUrl(filePath);
});

// File dialog handlers
ipcMain.handle("select-image", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Background Image',
        filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }
        ],
        properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const sourcePath = result.filePaths[0];
    const fileName = `img_${Date.now()}_${path.basename(sourcePath)}`;
    const destPath = path.join(mediaDir, fileName);

    // Copy file to media directory
    fs.copyFileSync(sourcePath, destPath);

    // Get base64 data URL
    const dataUrl = fileToDataUrl(destPath);

    // Add to database
    const media = db.addMedia({
        name: path.basename(sourcePath, path.extname(sourcePath)),
        type: 'image',
        file_path: destPath,
        thumbnail_path: destPath
    });

    return {
        id: media.id,
        path: destPath,
        dataUrl: dataUrl,
        name: media.name
    };
});

ipcMain.handle("select-video", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Background Video',
        filters: [
            { name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] }
        ],
        properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const sourcePath = result.filePaths[0];
    const fileName = `vid_${Date.now()}_${path.basename(sourcePath)}`;
    const destPath = path.join(mediaDir, fileName);

    // Copy file to media directory
    fs.copyFileSync(sourcePath, destPath);

    // Get base64 data URL
    const dataUrl = fileToDataUrl(destPath);

    // Add to database
    const media = db.addMedia({
        name: path.basename(sourcePath, path.extname(sourcePath)),
        type: 'video',
        file_path: destPath,
        thumbnail_path: null
    });

    return {
        id: media.id,
        path: destPath,
        dataUrl: dataUrl,
        name: media.name
    };
});

// Media library handlers
ipcMain.handle("get-all-media", async () => {
    const mediaList = db.getAllMedia();
    // Add data URLs to each media item
    return mediaList.map(media => ({
        ...media,
        dataUrl: fileToDataUrl(media.file_path)
    }));
});

ipcMain.handle("get-media-by-type", async (event, type) => {
    const mediaList = db.getMediaByType(type);
    return mediaList.map(media => ({
        ...media,
        dataUrl: fileToDataUrl(media.file_path)
    }));
});

ipcMain.handle("delete-media", (event, id) => {
    const media = db.getAllMedia().find(m => m.id === id);
    if (media && fs.existsSync(media.file_path)) {
        fs.unlinkSync(media.file_path);
    }
    return db.deleteMedia(id);
});

// Database IPC handlers

// Templates - include data URLs for image/video templates
ipcMain.handle("get-all-templates", () => {
    const templates = db.getAllTemplates();
    return templates.map(t => {
        if (t.background_type === 'image' || t.background_type === 'video') {
            return { ...t, dataUrl: fileToDataUrl(t.background_value) };
        }
        return t;
    });
});

ipcMain.handle("get-template", (event, id) => {
    const template = db.getTemplateById(id);
    if (template && (template.background_type === 'image' || template.background_type === 'video')) {
        template.dataUrl = fileToDataUrl(template.background_value);
    }
    return template;
});

ipcMain.handle("create-template", (event, template) => {
    const created = db.createTemplate(template);
    if (template.background_type === 'image' || template.background_type === 'video') {
        created.dataUrl = fileToDataUrl(template.background_value);
    }
    return created;
});

ipcMain.handle("update-template", (event, { id, template }) => {
    const updated = db.updateTemplate(id, template);
    if (template.background_type === 'image' || template.background_type === 'video') {
        updated.dataUrl = fileToDataUrl(template.background_value);
    }
    return updated;
});

ipcMain.handle("delete-template", (event, id) => {
    return db.deleteTemplate(id);
});

// Songs
ipcMain.handle("get-all-songs", () => {
    return db.getAllSongs();
});

ipcMain.handle("get-song", (event, id) => {
    return db.getSongById(id);
});

ipcMain.handle("get-song-with-verses", (event, id) => {
    const song = db.getSongWithVerses(id);
    // Add dataUrl if song has a template with image/video background
    if (song && (song.background_type === 'image' || song.background_type === 'video')) {
        song.dataUrl = fileToDataUrl(song.background_value);
    }
    return song;
});

ipcMain.handle("create-song", (event, song) => {
    return db.createSong(song);
});

ipcMain.handle("update-song", (event, { id, song }) => {
    return db.updateSong(id, song);
});

ipcMain.handle("delete-song", (event, id) => {
    return db.deleteSong(id);
});

ipcMain.handle("search-songs", (event, query) => {
    return db.searchSongs(query);
});

// Verses
ipcMain.handle("get-verses", (event, songId) => {
    return db.getVersesBySongId(songId);
});

ipcMain.handle("add-verse", (event, verse) => {
    return db.addVerse(verse);
});

ipcMain.handle("update-verse", (event, { id, verse }) => {
    return db.updateVerse(id, verse);
});

ipcMain.handle("delete-verse", (event, id) => {
    return db.deleteVerse(id);
});
