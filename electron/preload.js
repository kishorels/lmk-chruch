const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    // Presentation controls
    openPresentation: () => ipcRenderer.send("open-presentation"),
    closePresentation: () => ipcRenderer.send("close-presentation"),
    sendToPresentation: (data) => ipcRenderer.send("send-to-presentation", data),
    onPresent: (callback) => ipcRenderer.on("present-data", (event, data) => callback(data)),

    // File utilities
    getFileDataUrl: (filePath) => ipcRenderer.invoke("get-file-data-url", filePath),

    // File dialogs
    selectImage: () => ipcRenderer.invoke("select-image"),
    selectVideo: () => ipcRenderer.invoke("select-video"),

    // Media library
    getAllMedia: () => ipcRenderer.invoke("get-all-media"),
    getMediaByType: (type) => ipcRenderer.invoke("get-media-by-type", type),
    deleteMedia: (id) => ipcRenderer.invoke("delete-media", id),

    // Templates
    getAllTemplates: () => ipcRenderer.invoke("get-all-templates"),
    getTemplate: (id) => ipcRenderer.invoke("get-template", id),
    createTemplate: (template) => ipcRenderer.invoke("create-template", template),
    updateTemplate: (id, template) => ipcRenderer.invoke("update-template", { id, template }),
    deleteTemplate: (id) => ipcRenderer.invoke("delete-template", id),

    // Songs
    getAllSongs: () => ipcRenderer.invoke("get-all-songs"),
    getSong: (id) => ipcRenderer.invoke("get-song", id),
    getSongWithVerses: (id) => ipcRenderer.invoke("get-song-with-verses", id),
    createSong: (song) => ipcRenderer.invoke("create-song", song),
    updateSong: (id, song) => ipcRenderer.invoke("update-song", { id, song }),
    deleteSong: (id) => ipcRenderer.invoke("delete-song", id),
    searchSongs: (query) => ipcRenderer.invoke("search-songs", query),

    // Verses
    getVerses: (songId) => ipcRenderer.invoke("get-verses", songId),
    addVerse: (verse) => ipcRenderer.invoke("add-verse", verse),
    updateVerse: (id, verse) => ipcRenderer.invoke("update-verse", { id, verse }),
    deleteVerse: (id) => ipcRenderer.invoke("delete-verse", id),

    // Bible - using local Tamil Bible database
    getAllBibleBooks: () => ipcRenderer.invoke("get-all-bible-books"),
    getBibleBook: (id) => ipcRenderer.invoke("get-bible-book", id),
    getChaptersByBook: (bookId) => ipcRenderer.invoke("get-chapters-by-book", bookId),
    getVersesByChapter: (bookId, chapterNumber) => ipcRenderer.invoke("get-verses-by-chapter", { bookId, chapterNumber }),
    searchBible: (query) => ipcRenderer.invoke("search-bible", query),
    getBibleVerse: (bookId, chapter, verse) => ipcRenderer.invoke("get-bible-verse", { bookId, chapter, verse }),
    getBibleVerseCount: () => ipcRenderer.invoke("get-bible-verse-count"),
});
