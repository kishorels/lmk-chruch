const { app, BrowserWindow, ipcMain, screen, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const db = require("./database");
const bibleDb = require("./bible-db");

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

// Fetch JSON from URL
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Populate Bible data
async function populateBible() {
    try {
        // Check if already populated - should have at least 31000 verses for complete Tamil Bible
        const verseCount = db.getBibleVerseCount();
        const books = db.getAllBibleBooks();

        console.log(`Bible check: ${books.length} books, ${verseCount} verses`);

        if (verseCount > 30000) {
            console.log('Bible data already complete, skipping population.');
            return;
        }

        // If we have books but no/incomplete verses, clear and start fresh
        if (books.length > 0 && verseCount < 30000) {
            console.log('Bible data incomplete, clearing and re-downloading...');
            db.clearBibleData();
        }

        console.log('Populating Bible data from GitHub...');

        // Fetch books list
        const booksData = await fetchJson('https://raw.githubusercontent.com/aruljohn/Bible-tamil/master/Books.json');
        console.log(`Found ${booksData.length} books to download.`);

        for (let i = 0; i < booksData.length; i++) {
            const bookItem = booksData[i];
            try {
                const book = db.createBibleBook({
                    english_name: bookItem.book.english,
                    tamil_name: bookItem.book.tamil.trim()
                });

                console.log(`[${i + 1}/${booksData.length}] Downloading: ${bookItem.book.english} (${bookItem.book.tamil.trim()})`);

                // Fetch book content
                const bookFileName = `${bookItem.book.english}.json`;
                const bookUrl = `https://raw.githubusercontent.com/aruljohn/Bible-tamil/master/${encodeURIComponent(bookFileName)}`;
                const bookData = await fetchJson(bookUrl);

                // The JSON format has chapters as an array inside bookData.chapters
                if (bookData.chapters && Array.isArray(bookData.chapters)) {
                    // New format: { book: {...}, chapters: [ { chapter: "1", verses: [...] }, ... ] }
                    for (const chapterData of bookData.chapters) {
                        const chapter = db.createBibleChapter({
                            book_id: book.id,
                            chapter_number: parseInt(chapterData.chapter)
                        });

                        if (chapterData.verses && Array.isArray(chapterData.verses)) {
                            for (const verseData of chapterData.verses) {
                                db.createBibleVerse({
                                    chapter_id: chapter.id,
                                    verse_number: parseInt(verseData.verse),
                                    content: verseData.text
                                });
                            }
                        }
                    }
                } else {
                    // Old format fallback: { "1": { "1": "verse text", ... }, ... }
                    for (const [chapterNum, verses] of Object.entries(bookData)) {
                        if (chapterNum === 'book' || chapterNum === 'count') continue; // Skip metadata

                        const chapter = db.createBibleChapter({
                            book_id: book.id,
                            chapter_number: parseInt(chapterNum)
                        });

                        if (typeof verses === 'object') {
                            for (const [verseNum, content] of Object.entries(verses)) {
                                db.createBibleVerse({
                                    chapter_id: chapter.id,
                                    verse_number: parseInt(verseNum),
                                    content: content
                                });
                            }
                        }
                    }
                }
            } catch (bookError) {
                console.error(`Failed to populate book ${bookItem.book.english}:`, bookError.message);
            }
        }

        console.log('✓ Bible data populated successfully!');
    } catch (error) {
        console.error('Failed to populate Bible data:', error.message);
    }
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
app.whenReady().then(async () => {
    ensureMediaDir();
    db.initializeDatabase();

    // Initialize the local Tamil Bible database
    const bibleLoaded = bibleDb.initBibleDatabase();
    if (bibleLoaded) {
        console.log('✓ Tamil Bible database ready with', bibleDb.getBibleVerseCount(), 'verses');
    } else {
        console.warn('⚠ Tamil Bible database not available');
    }

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

// Bible - using local Tamil Bible SQLite database
ipcMain.handle("get-all-bible-books", () => {
    return bibleDb.getAllBibleBooks();
});

ipcMain.handle("get-bible-book", (event, id) => {
    const books = bibleDb.getAllBibleBooks();
    return books.find(b => b.id === id) || null;
});

ipcMain.handle("get-chapters-by-book", (event, bookId) => {
    return bibleDb.getChaptersByBook(bookId);
});

ipcMain.handle("get-verses-by-chapter", (event, { bookId, chapterNumber }) => {
    return bibleDb.getVersesByChapter(bookId, chapterNumber);
});

ipcMain.handle("search-bible", (event, query) => {
    return bibleDb.searchBible(query);
});

ipcMain.handle("get-bible-verse", (event, { bookId, chapter, verse }) => {
    return bibleDb.getVerse(bookId, chapter, verse);
});

ipcMain.handle("get-bible-verse-count", () => {
    return bibleDb.getBibleVerseCount();
});
