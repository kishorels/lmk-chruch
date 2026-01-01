import { useState, useEffect, useCallback } from "react";
import lmkLogo from "./assets/lmk-logo.png";

// Helper function to get background URL
// Uses dataUrl from API if available (for image/video), otherwise returns the value as-is (for gradients)
const getMediaUrl = (item) => {
    if (!item) return '';
    // If the item has a dataUrl (base64), use it
    if (item.dataUrl) return item.dataUrl;
    // Otherwise return the background_value (for gradients)
    return item.background_value || '';
};

// Template gradients for preview
const GRADIENT_PRESETS = [
    { name: 'Heavenly Purple', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { name: 'Ocean Blue', value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
    { name: 'Sunset Gold', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { name: 'Forest Green', value: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)' },
    { name: 'Royal Purple', value: 'linear-gradient(135deg, #4a0e4e 0%, #81689d 100%)' },
    { name: 'Night Sky', value: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%)' },
    { name: 'Deep Ocean', value: 'linear-gradient(135deg, #000428 0%, #004e92 100%)' },
    { name: 'Warm Sunset', value: 'linear-gradient(135deg, #ff512f 0%, #f09819 100%)' },
];

export default function App() {
    // State
    const [activeTab, setActiveTab] = useState("songs");
    const [songs, setSongs] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [mediaLibrary, setMediaLibrary] = useState([]);
    const [selectedSong, setSelectedSong] = useState(null);
    const [selectedVerse, setSelectedVerse] = useState(null);
    const [selectedVerseIndex, setSelectedVerseIndex] = useState(-1);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLive, setIsLive] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);

    // Bible state
    const [bibleBooks, setBibleBooks] = useState([]);
    const [selectedBook, setSelectedBook] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [hoveredChapter, setHoveredChapter] = useState(null);
    const [bibleVerses, setBibleVerses] = useState([]);
    const [selectedBibleVerse, setSelectedBibleVerse] = useState(null);
    const [bibleSearchQuery, setBibleSearchQuery] = useState("");
    const [bibleSearchResults, setBibleSearchResults] = useState([]);
    const [testamentFilter, setTestamentFilter] = useState("all"); // 'all', 'OT', 'NT'
    const [bibleViewMode, setBibleViewMode] = useState("books"); // 'books', 'search'

    // Modal states
    const [showAddSongModal, setShowAddSongModal] = useState(false);
    const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
    const [showMediaLibraryModal, setShowMediaLibraryModal] = useState(false);
    const [editingSong, setEditingSong] = useState(null);

    // Form states
    const [newSong, setNewSong] = useState({ title: '', author: '', category: 'Worship', lyrics: '' });
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        background_type: 'gradient',
        background_value: GRADIENT_PRESETS[0].value,
        background_overlay: 'rgba(0,0,0,0.3)',
        font_size: 72,
        font_color: '#ffffff'
    });

    // Load data on mount
    useEffect(() => {
        loadSongs();
        loadTemplates();
        loadMediaLibrary();
        loadBibleBooks();
    }, []);

    const loadSongs = async () => {
        try {
            const songsData = await window.electronAPI.getAllSongs();
            setSongs(songsData);
        } catch (error) {
            console.error('Failed to load songs:', error);
        }
    };

    const loadTemplates = async () => {
        try {
            const templatesData = await window.electronAPI.getAllTemplates();
            setTemplates(templatesData);
            if (templatesData.length > 0) {
                setSelectedTemplate(templatesData[0]);
            }
        } catch (error) {
            console.error('Failed to load templates:', error);
        }
    };

    const loadMediaLibrary = async () => {
        try {
            const media = await window.electronAPI.getAllMedia();
            setMediaLibrary(media);
        } catch (error) {
            console.error('Failed to load media:', error);
        }
    };

    const loadBibleBooks = async () => {
        try {
            const books = await window.electronAPI.getAllBibleBooks();
            console.log('Loaded Bible books:', books.length);
            setBibleBooks(books);
        } catch (error) {
            console.error('Failed to load Bible books:', error);
        }
    };

    // Search Bible
    const searchBible = async (query) => {
        if (!query.trim()) {
            setBibleSearchResults([]);
            return;
        }
        try {
            const results = await window.electronAPI.searchBible(query);
            setBibleSearchResults(results);
        } catch (error) {
            console.error('Failed to search Bible:', error);
        }
    };

    const selectSong = async (song) => {
        try {
            const songWithVerses = await window.electronAPI.getSongWithVerses(song.id);
            setSelectedSong(songWithVerses);
            setSelectedVerse(null);
            setSelectedVerseIndex(-1);

            // Set the song's template if it has one
            if (songWithVerses.template_id) {
                const template = templates.find(t => t.id === songWithVerses.template_id);
                if (template) setSelectedTemplate(template);
            }
        } catch (error) {
            console.error('Failed to load song:', error);
        }
    };

    const selectVerse = (verse, index) => {
        setSelectedVerse(verse);
        setSelectedVerseIndex(index);
    };

    const selectBook = async (book) => {
        setSelectedBook(book);
        setSelectedChapter(null);
        setHoveredChapter(null);
        setBibleVerses([]);
        setSelectedBibleVerse(null);
        // Load chapters
        try {
            const chapters = await window.electronAPI.getChaptersByBook(book.id);
            setSelectedBook({ ...book, chapters });
        } catch (error) {
            console.error('Failed to load chapters:', error);
        }
    };

    const loadVersesForChapter = async (chapter) => {
        try {
            const verses = await window.electronAPI.getVersesByChapter(selectedBook.id, chapter.chapter_number);
            setBibleVerses(verses);
        } catch (error) {
            console.error('Failed to load verses:', error);
        }
    };

    const selectChapter = async (chapter) => {
        setSelectedChapter(chapter);
        setSelectedBibleVerse(null);
        setHoveredChapter(null);
        loadVersesForChapter(chapter);
    };

    const handleChapterHover = (chapter) => {
        setHoveredChapter(chapter);
        loadVersesForChapter(chapter);
    };

    const handleChapterLeave = () => {
        setHoveredChapter(null);
    };

    const selectBibleVerse = (verse, bookName = null, chapterNum = null) => {
        setSelectedBibleVerse(verse);
        // Create reference text for presentation
        const reference = bookName && chapterNum
            ? `${bookName} ${chapterNum}:${verse.verse_number}`
            : selectedBook && selectedChapter
                ? `${selectedBook.tamil_name} ${selectedChapter.chapter_number}:${verse.verse_number}`
                : '';
        // Set as selectedVerse for presentation with reference
        setSelectedVerse({
            content: verse.content,
            id: verse.id,
            verse_number: verse.verse_number,
            reference: reference
        });
        setSelectedVerseIndex(-1); // Not used for Bible
    };

    // Filter books by testament
    const filteredBibleBooks = bibleBooks.filter(book => {
        if (testamentFilter === 'all') return true;
        return book.testament === testamentFilter;
    });

    const goToPresentation = () => {
        if (!selectedVerse) return;

        window.electronAPI.openPresentation();
        setIsLive(true);

        window.electronAPI.sendToPresentation({
            type: "present",
            text: selectedVerse.content,
            template: selectedTemplate
        });
    };

    const updatePresentation = useCallback((verse) => {
        if (isLive && verse) {
            window.electronAPI.sendToPresentation({
                type: "present",
                text: verse.content,
                template: selectedTemplate
            });
        }
    }, [isLive, selectedTemplate]);

    const navigateVerse = useCallback((direction) => {
        if (!selectedSong?.verses) return;

        const newIndex = selectedVerseIndex + direction;
        if (newIndex >= 0 && newIndex < selectedSong.verses.length) {
            const newVerse = selectedSong.verses[newIndex];
            setSelectedVerse(newVerse);
            setSelectedVerseIndex(newIndex);
            updatePresentation(newVerse);
        }
    }, [selectedSong, selectedVerseIndex, updatePresentation]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't navigate if user is typing in an input or if a modal is open
            if (
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'TEXTAREA' ||
                showAddSongModal ||
                showAddTemplateModal ||
                showMediaLibraryModal
            ) {
                return;
            }

            if (e.key === 'ArrowRight') {
                navigateVerse(1);
            } else if (e.key === 'ArrowLeft') {
                navigateVerse(-1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigateVerse, showAddSongModal, showAddTemplateModal, showMediaLibraryModal]);

    const clearPresentation = () => {
        window.electronAPI.sendToPresentation({ type: "clear" });
    };

    const blackoutPresentation = () => {
        window.electronAPI.sendToPresentation({ type: "blackout" });
    };

    const closePresentation = () => {
        window.electronAPI.closePresentation();
        setIsLive(false);
    };

    // Add Song
    const handleAddSong = async () => {
        if (!newSong.title.trim() || !newSong.lyrics.trim()) return;

        try {
            // Create the song
            const song = await window.electronAPI.createSong({
                title: newSong.title,
                author: newSong.author,
                category: newSong.category,
                template_id: selectedTemplate?.id || null
            });

            // Parse lyrics into verses and add them
            const verses = newSong.lyrics.split(/\n\n+/).filter(v => v.trim());
            for (let i = 0; i < verses.length; i++) {
                await window.electronAPI.addVerse({
                    song_id: song.id,
                    verse_number: i + 1,
                    verse_type: 'verse',
                    content: verses[i].trim()
                });
            }

            // Reload songs and reset form
            loadSongs();
            setNewSong({ title: '', author: '', category: 'Worship', lyrics: '' });
            setShowAddSongModal(false);
        } catch (error) {
            console.error('Failed to add song:', error);
        }
    };

    // Delete Song
    const handleDeleteSong = async (songId) => {
        if (!confirm('Are you sure you want to delete this song?')) return;

        try {
            await window.electronAPI.deleteSong(songId);
            loadSongs();
            if (selectedSong?.id === songId) {
                setSelectedSong(null);
                setSelectedVerse(null);
            }
        } catch (error) {
            console.error('Failed to delete song:', error);
        }
    };

    // Select Image for Template
    const handleSelectImage = async () => {
        try {
            const result = await window.electronAPI.selectImage();
            if (result) {
                setNewTemplate({
                    ...newTemplate,
                    background_type: 'image',
                    background_value: result.path,
                    dataUrl: result.dataUrl
                });
                loadMediaLibrary();
            }
        } catch (error) {
            console.error('Failed to select image:', error);
        }
    };

    // Select Video for Template
    const handleSelectVideo = async () => {
        try {
            const result = await window.electronAPI.selectVideo();
            if (result) {
                setNewTemplate({
                    ...newTemplate,
                    background_type: 'video',
                    background_value: result.path,
                    dataUrl: result.dataUrl
                });
                loadMediaLibrary();
            }
        } catch (error) {
            console.error('Failed to select video:', error);
        }
    };

    // Select from Media Library
    const handleSelectFromLibrary = (media) => {
        setNewTemplate({
            ...newTemplate,
            background_type: media.type,
            background_value: media.file_path,
            dataUrl: media.dataUrl
        });
        setShowMediaLibraryModal(false);
    };

    // Add Template
    const handleAddTemplate = async () => {
        if (!newTemplate.name.trim()) return;

        try {
            await window.electronAPI.createTemplate({
                name: newTemplate.name,
                background_type: newTemplate.background_type,
                background_value: newTemplate.background_value,
                background_overlay: newTemplate.background_overlay,
                font_family: 'Inter',
                font_size: newTemplate.font_size,
                font_color: newTemplate.font_color,
                text_align: 'center',
                text_shadow: '2px 2px 8px rgba(0,0,0,0.8)'
            });

            loadTemplates();
            setNewTemplate({
                name: '',
                background_type: 'gradient',
                background_value: GRADIENT_PRESETS[0].value,
                background_overlay: 'rgba(0,0,0,0.3)',
                font_size: 72,
                font_color: '#ffffff'
            });
            setShowAddTemplateModal(false);
        } catch (error) {
            console.error('Failed to add template:', error);
        }
    };

    // Delete Template
    const handleDeleteTemplate = async (templateId) => {
        if (!confirm('Are you sure you want to delete this template?')) return;

        try {
            await window.electronAPI.deleteTemplate(templateId);
            loadTemplates();
            if (selectedTemplate?.id === templateId) {
                setSelectedTemplate(templates[0] || null);
            }
        } catch (error) {
            console.error('Failed to delete template:', error);
        }
    };

    // Filter songs
    const filteredSongs = songs.filter(song =>
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.author?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getVerseTypeLabel = (type) => {
        const labels = { verse: 'V', chorus: 'C', bridge: 'B', intro: 'I', outro: 'O' };
        return labels[type] || 'V';
    };

    const getBackgroundTypeIcon = (type) => {
        const icons = { gradient: '🎨', image: '🖼️', video: '🎬' };
        return icons[type] || '🎨';
    };

    // Render background preview
    const renderBackgroundPreview = (template, size = 'normal') => {
        if (!template) return null;

        const style = size === 'thumb'
            ? { width: '60px', height: '40px', borderRadius: '8px' }
            : { width: '100%', height: '200px', borderRadius: '12px' };

        if (template.background_type === 'video') {
            return (
                <div style={{ ...style, position: 'relative', overflow: 'hidden', background: '#000' }}>
                    <video
                        src={template.dataUrl || ''}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        autoPlay
                        muted
                        loop
                    />
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: template.background_overlay || 'rgba(0,0,0,0.3)'
                    }} />
                </div>
            );
        }

        if (template.background_type === 'image') {
            return (
                <div style={{
                    ...style,
                    backgroundImage: template.dataUrl ? `url('${template.dataUrl}')` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative'
                }}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: template.background_overlay || 'rgba(0,0,0,0.3)',
                        borderRadius: style.borderRadius
                    }} />
                </div>
            );
        }

        return (
            <div style={{
                ...style,
                background: template.background_value
            }} />
        );
    };

    return (
        <div className="app-container">
            {/* TOP BAR */}
            <header className="top-bar">
                <div className="logo">
                    <img src={lmkLogo} alt="LMK Logo" className="logo-image" />
                    <span className="logo-text">LMK Technology</span>
                </div>

                <div className="nav-tabs">
                    <button
                        className={`nav-tab ${activeTab === "songs" ? "active" : ""}`}
                        onClick={() => setActiveTab("songs")}
                    >
                        <span className="nav-tab-icon">🎵</span>
                        Songs
                    </button>
                    <button
                        className={`nav-tab ${activeTab === "bible" ? "active" : ""}`}
                        onClick={() => setActiveTab("bible")}
                    >
                        <span className="nav-tab-icon">📖</span>
                        Bible
                    </button>
                    <button
                        className={`nav-tab ${activeTab === "templates" ? "active" : ""}`}
                        onClick={() => setActiveTab("templates")}
                    >
                        <span className="nav-tab-icon">🎨</span>
                        Templates
                    </button>
                    <button
                        className={`nav-tab ${activeTab === "media" ? "active" : ""}`}
                        onClick={() => setActiveTab("media")}
                    >
                        <span className="nav-tab-icon">📁</span>
                        Media
                    </button>
                </div>

                <div className="top-bar-actions">
                    {isLive && (
                        <button className="btn btn-danger btn-icon" onClick={closePresentation} title="Close Presentation">
                            ✕
                        </button>
                    )}
                </div>
            </header>

            {/* MAIN BODY */}
            <div className="main-layout">
                {/* LEFT PANEL */}
                <aside className="panel left-panel">
                    <div className="panel-header">
                        <div className="panel-title">
                            {activeTab === "songs" ? "Song Library" : activeTab === "bible" ? "Bible" : activeTab === "templates" ? "Templates" : "Media Library"}
                        </div>
                        <div className="search-box">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                className="search-input"
                                placeholder={activeTab === "songs" ? "Search songs..." : "Search..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {activeTab === "songs" && (
                        <>
                            <button className="add-song-btn" onClick={() => setShowAddSongModal(true)}>
                                <span>➕</span>
                                Add New Song
                            </button>

                            <div className="song-list">
                                {filteredSongs.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">🎵</div>
                                        <div className="empty-state-text">No songs found</div>
                                    </div>
                                ) : (
                                    filteredSongs.map((song) => (
                                        <div
                                            key={song.id}
                                            className={`song-item ${selectedSong?.id === song.id ? "active" : ""}`}
                                            onClick={() => selectSong(song)}
                                        >
                                            <div className="song-icon">♪</div>
                                            <div className="song-info">
                                                <div className="song-title">{song.title}</div>
                                                <div className="song-author">{song.author || 'Unknown'}</div>
                                            </div>
                                            <div className="song-item-right">
                                                <span className="song-category">{song.category}</span>
                                                <button
                                                    className="delete-btn-small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteSong(song.id);
                                                    }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {selectedSong?.verses && selectedSong.verses.length > 0 && (
                                <div className="verse-section">
                                    <div className="verse-section-title">Verses & Sections</div>
                                    {selectedSong.verses.map((verse, index) => (
                                        <div
                                            key={verse.id}
                                            className={`verse-item ${selectedVerseIndex === index ? "active" : ""}`}
                                            onClick={() => selectVerse(verse, index)}
                                        >
                                            <span className="verse-badge">{getVerseTypeLabel(verse.verse_type)}{verse.verse_number}</span>
                                            <span className="verse-preview">{verse.content.split('\n')[0]}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === "bible" && (
                        <div className="bible-panel-redesign">
                            {/* Bible Header with Search */}
                            <div className="bible-header">
                                <div className="bible-search-container">
                                    <span className="bible-search-icon">🔍</span>
                                    <input
                                        type="text"
                                        className="bible-search-input"
                                        placeholder="வசன தேடல் / Search verses..."
                                        value={bibleSearchQuery}
                                        onChange={(e) => {
                                            setBibleSearchQuery(e.target.value);
                                            if (e.target.value.length >= 2) {
                                                searchBible(e.target.value);
                                                setBibleViewMode('search');
                                            } else {
                                                setBibleSearchResults([]);
                                                setBibleViewMode('books');
                                            }
                                        }}
                                    />
                                    {bibleSearchQuery && (
                                        <button
                                            className="bible-search-clear"
                                            onClick={() => {
                                                setBibleSearchQuery('');
                                                setBibleSearchResults([]);
                                                setBibleViewMode('books');
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {/* Testament Tabs */}
                                <div className="testament-tabs">
                                    <button
                                        className={`testament-tab ${testamentFilter === 'all' ? 'active' : ''}`}
                                        onClick={() => setTestamentFilter('all')}
                                    >
                                        <span className="testament-icon">📖</span>
                                        அனைத்தும்
                                    </button>
                                    <button
                                        className={`testament-tab ${testamentFilter === 'OT' ? 'active' : ''}`}
                                        onClick={() => setTestamentFilter('OT')}
                                    >
                                        <span className="testament-icon">📜</span>
                                        பழைய ஏற்பாடு
                                    </button>
                                    <button
                                        className={`testament-tab ${testamentFilter === 'NT' ? 'active' : ''}`}
                                        onClick={() => setTestamentFilter('NT')}
                                    >
                                        <span className="testament-icon">✝️</span>
                                        புதிய ஏற்பாடு
                                    </button>
                                </div>
                            </div>

                            {/* Search Results View */}
                            {bibleViewMode === 'search' && bibleSearchResults.length > 0 && (
                                <div className="bible-search-results">
                                    <div className="search-results-header">
                                        <span className="search-results-count">{bibleSearchResults.length} results found</span>
                                    </div>
                                    <div className="search-results-list">
                                        {bibleSearchResults.map((result, index) => (
                                            <div
                                                key={index}
                                                className={`search-result-item ${selectedBibleVerse?.id === result.id ? 'active' : ''}`}
                                                onClick={() => selectBibleVerse({
                                                    id: `${result.book}_${result.chapter}_${result.verse_number}`,
                                                    verse_number: result.verse_number,
                                                    content: result.content
                                                }, `Book ${result.book}`, result.chapter)}
                                            >
                                                <div className="search-result-ref">
                                                    Book {result.book} : {result.chapter}:{result.verse_number}
                                                </div>
                                                <div className="search-result-text">{result.content}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Single Column with Popup */}
                            {bibleViewMode === 'books' && (
                                <>
                                    {bibleBooks.length === 0 ? (
                                        <div className="bible-loading-state">
                                            <div className="bible-loading-icon">📖</div>
                                            <div className="bible-loading-text">Loading Tamil Bible...</div>
                                            <div className="bible-loading-spinner"></div>
                                        </div>
                                    ) : (
                                        <div className="bible-content">
                                            <div className="bible-books-with-popup">
                                                {filteredBibleBooks.map((book) => (
                                                    <div
                                                        key={book.id}
                                                        className={`bible-book-popup-item ${selectedBook?.id === book.id ? 'active' : ''} ${book.testament === 'OT' ? 'ot' : 'nt'}`}
                                                        onClick={() => selectBook(book)}
                                                    >
                                                        <div className="book-popup-number">{book.id}</div>
                                                        <div className="book-popup-info">
                                                            <div className="book-popup-tamil">{book.tamil_name}</div>
                                                            <div className="book-popup-english">{book.english_name}</div>
                                                        </div>

                                                        {/* Chapter & Verse Popup */}
                                                        {selectedBook?.id === book.id && book.chapters && (
                                                            <div className="chapter-verse-popup">
                                                                <div className="popup-header">
                                                                    <span className="popup-title">{book.tamil_name}</span>
                                                                    <button
                                                                        className="popup-close"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedBook(null);
                                                                            setSelectedChapter(null);
                                                                            setHoveredChapter(null);
                                                                            setBibleVerses([]);
                                                                        }}
                                                                    >✕</button>
                                                                </div>

                                                                {/* Two Column inside Popup: Chapters | Verses */}
                                                                <div className="popup-two-columns">
                                                                    {/* Chapters List */}
                                                                    <div className="popup-chapters-section">
                                                                        <div className="popup-section-title">அதிகாரங்கள்</div>
                                                                        <div className="popup-chapters-grid">
                                                                            {book.chapters.map((chapter) => (
                                                                                <button
                                                                                    key={chapter.id}
                                                                                    className={`popup-chapter-btn ${selectedChapter?.chapter_number === chapter.chapter_number ? 'active' : ''}`}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        selectChapter(chapter);
                                                                                    }}
                                                                                    onMouseEnter={() => handleChapterHover(chapter)}
                                                                                    onMouseLeave={handleChapterLeave}
                                                                                >
                                                                                    <span className="chapter-btn-label">அதி</span>
                                                                                    <span className="chapter-btn-number">{chapter.chapter_number}</span>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Verses Grid */}
                                                                    <div className="popup-verses-section">
                                                                        <div className="popup-section-title">
                                                                            {selectedChapter ? `வசனங்கள் ${selectedChapter.chapter_number}` : hoveredChapter ? `வசனங்கள் ${hoveredChapter.chapter_number}` : 'வசனங்கள்'}
                                                                        </div>
                                                                        {bibleVerses.length > 0 ? (
                                                                            <div className="popup-verses-grid">
                                                                                {bibleVerses.map((verse) => (
                                                                                    <button
                                                                                        key={verse.id}
                                                                                        className={`popup-verse-btn ${selectedBibleVerse?.id === verse.id ? 'active' : ''}`}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            selectBibleVerse(verse);
                                                                                        }}
                                                                                        title={verse.content}
                                                                                    >
                                                                                        {verse.verse_number}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="popup-empty">
                                                                                <div className="popup-empty-icon">📑</div>
                                                                                <div className="popup-empty-text">அதிகாரத்தைத் தேர்ந்தெடுக்கவும்</div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === "templates" && (
                        <>
                            <button className="add-song-btn" onClick={() => setShowAddTemplateModal(true)}>
                                <span>➕</span>
                                Add New Template
                            </button>

                            <div className="song-list">
                                {templates.map((template) => (
                                    <div
                                        key={template.id}
                                        className={`song-item ${selectedTemplate?.id === template.id ? "active" : ""}`}
                                        onClick={() => setSelectedTemplate(template)}
                                    >
                                        <div className="template-thumb-small">
                                            {renderBackgroundPreview({ ...template, background_overlay: null }, 'thumb')}
                                        </div>
                                        <div className="song-info">
                                            <div className="song-title">{template.name}</div>
                                            <div className="song-author">
                                                {getBackgroundTypeIcon(template.background_type)} {template.background_type} • {template.font_size}px
                                            </div>
                                        </div>
                                        <button
                                            className="delete-btn-small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTemplate(template.id);
                                            }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {activeTab === "media" && (
                        <>
                            <div className="media-actions">
                                <button className="add-song-btn" onClick={handleSelectImage}>
                                    <span>🖼️</span>
                                    Add Image
                                </button>
                                <button className="add-song-btn" onClick={handleSelectVideo}>
                                    <span>🎬</span>
                                    Add Video
                                </button>
                            </div>

                            <div className="media-grid">
                                {mediaLibrary.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">📁</div>
                                        <div className="empty-state-text">No media files yet</div>
                                    </div>
                                ) : (
                                    mediaLibrary.map((media) => (
                                        <div key={media.id} className="media-item">
                                            {media.type === 'image' ? (
                                                <img src={media.dataUrl || ''} alt={media.name} />
                                            ) : (
                                                <video src={media.dataUrl || ''} muted />
                                            )}
                                            <div className="media-item-info">
                                                <span className="media-item-name">{media.name}</span>
                                                <span className="media-item-type">{media.type === 'image' ? '🖼️' : '🎬'}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </aside>

                {/* CENTER PANEL */}
                <main className="center-panel">
                    <div className="preview-header">
                        <div className="preview-title">
                            <h3>Preview</h3>
                            <div className={`live-badge ${isLive ? '' : 'offline'}`}>
                                {isLive && <span className="live-dot"></span>}
                                {isLive ? 'LIVE' : 'OFFLINE'}
                            </div>
                        </div>
                    </div>

                    <div className="preview-container">
                        <div className="preview-screen" style={{ position: 'relative', overflow: 'hidden' }}>
                            {/* Background Layer */}
                            {selectedTemplate?.background_type === 'video' ? (
                                <>
                                    <video
                                        src={selectedTemplate.dataUrl || ''}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                        autoPlay
                                        muted
                                        loop
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: selectedTemplate.background_overlay || 'rgba(0,0,0,0.3)'
                                    }} />
                                </>
                            ) : selectedTemplate?.background_type === 'image' ? (
                                <>
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        backgroundImage: selectedTemplate.dataUrl ? `url('${selectedTemplate.dataUrl}')` : 'none',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center'
                                    }} />
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: selectedTemplate.background_overlay || 'rgba(0,0,0,0.3)'
                                    }} />
                                </>
                            ) : (
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: selectedTemplate?.background_value || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                }} />
                            )}

                            {/* Text Layer */}
                            {selectedVerse ? (
                                <div
                                    className="preview-text"
                                    style={{
                                        position: 'relative',
                                        zIndex: 1,
                                        color: selectedTemplate?.font_color || '#ffffff',
                                        fontSize: `${(selectedTemplate?.font_size || 72) / 2}px`
                                    }}
                                >
                                    {selectedVerse.content}
                                </div>
                            ) : (
                                <div className="preview-placeholder" style={{ position: 'relative', zIndex: 1 }}>
                                    <div className="preview-placeholder-icon">🎤</div>
                                    <div>Select a verse to preview</div>
                                </div>
                            )}
                        </div>

                        <div className="template-selector">
                            <div className="template-label">Quick Template</div>
                            <div className="template-list">
                                {templates.map((template) => (
                                    <div
                                        key={template.id}
                                        className={`template-thumb ${selectedTemplate?.id === template.id ? "active" : ""}`}
                                        onClick={() => setSelectedTemplate(template)}
                                        title={template.name}
                                    >
                                        {renderBackgroundPreview({ ...template, background_overlay: null }, 'thumb')}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>

                {/* RIGHT PANEL */}
                <aside className="panel right-panel">
                    <div className="control-section">
                        <div className="control-title">Presentation Controls</div>
                        <div className="quick-actions">
                            <button
                                className="btn btn-primary"
                                onClick={goToPresentation}
                                disabled={!selectedVerse}
                            >
                                <span>🖥️</span>
                                {isLive ? 'Update Live' : 'Go Live'}
                            </button>
                        </div>
                    </div>

                    <div className="control-section">
                        <div className="control-title">Navigation</div>
                        <div className="nav-controls">
                            <button
                                className="nav-btn"
                                onClick={() => navigateVerse(-1)}
                                disabled={selectedVerseIndex <= 0}
                            >
                                <span className="nav-btn-icon">⬆️</span>
                                <span className="nav-btn-label">Previous</span>
                            </button>
                            <button
                                className="nav-btn"
                                onClick={() => navigateVerse(1)}
                                disabled={!selectedSong?.verses || selectedVerseIndex >= selectedSong.verses.length - 1}
                            >
                                <span className="nav-btn-icon">⬇️</span>
                                <span className="nav-btn-label">Next</span>
                            </button>
                        </div>
                    </div>

                    <div className="control-section">
                        <div className="control-title">Quick Actions</div>
                        <div className="quick-actions">
                            <button className="btn btn-secondary" onClick={clearPresentation}>
                                <span>🔲</span>
                                Clear Screen
                            </button>
                            <button className="btn btn-danger" onClick={blackoutPresentation}>
                                <span>⬛</span>
                                Blackout
                            </button>
                        </div>
                    </div>

                    {selectedSong && (
                        <div className="control-section">
                            <div className="control-title">Song Actions</div>
                            <div className="quick-actions">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => handleDeleteSong(selectedSong.id)}
                                >
                                    <span>🗑️</span>
                                    Delete Song
                                </button>
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {/* ADD SONG MODAL */}
            {showAddSongModal && (
                <div className="modal-overlay" onClick={() => setShowAddSongModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add New Song</h2>
                            <button className="modal-close" onClick={() => setShowAddSongModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Song Title *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter song title"
                                    value={newSong.title}
                                    onChange={(e) => setNewSong({ ...newSong, title: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Author / Artist</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter author or artist name"
                                    value={newSong.author}
                                    onChange={(e) => setNewSong({ ...newSong, author: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <select
                                    className="form-select"
                                    value={newSong.category}
                                    onChange={(e) => setNewSong({ ...newSong, category: e.target.value })}
                                >
                                    <option value="Worship">Worship</option>
                                    <option value="Hymn">Hymn</option>
                                    <option value="Praise">Praise</option>
                                    <option value="Gospel">Gospel</option>
                                    <option value="Contemporary">Contemporary</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Lyrics * (Separate verses with empty lines)</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Verse 1 line 1&#10;Verse 1 line 2&#10;&#10;Verse 2 line 1&#10;Verse 2 line 2"
                                    value={newSong.lyrics}
                                    onChange={(e) => setNewSong({ ...newSong, lyrics: e.target.value })}
                                    rows={8}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddSongModal(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleAddSong}>
                                Add Song
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD TEMPLATE MODAL */}
            {showAddTemplateModal && (
                <div className="modal-overlay" onClick={() => setShowAddTemplateModal(false)}>
                    <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add New Template</h2>
                            <button className="modal-close" onClick={() => setShowAddTemplateModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {/* Preview */}
                            <div className="template-preview-large" style={{ position: 'relative', overflow: 'hidden' }}>
                                {newTemplate.background_type === 'video' ? (
                                    <>
                                        <video
                                            src={newTemplate.dataUrl || ''}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                            autoPlay
                                            muted
                                            loop
                                        />
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: newTemplate.background_overlay
                                        }} />
                                    </>
                                ) : newTemplate.background_type === 'image' ? (
                                    <>
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            backgroundImage: newTemplate.dataUrl ? `url('${newTemplate.dataUrl}')` : 'none',
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center'
                                        }} />
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: newTemplate.background_overlay
                                        }} />
                                    </>
                                ) : (
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: newTemplate.background_value
                                    }} />
                                )}
                                <div style={{
                                    position: 'relative',
                                    zIndex: 1,
                                    color: newTemplate.font_color,
                                    fontSize: `${newTemplate.font_size / 3}px`,
                                    textShadow: '2px 2px 8px rgba(0,0,0,0.8)'
                                }}>
                                    Preview Text
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Template Name *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter template name"
                                    value={newTemplate.name}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                />
                            </div>

                            {/* Background Type Selector */}
                            <div className="form-group">
                                <label className="form-label">Background Type</label>
                                <div className="background-type-tabs">
                                    <button
                                        className={`bg-type-btn ${newTemplate.background_type === 'gradient' ? 'active' : ''}`}
                                        onClick={() => setNewTemplate({ ...newTemplate, background_type: 'gradient', background_value: GRADIENT_PRESETS[0].value })}
                                    >
                                        🎨 Gradient
                                    </button>
                                    <button
                                        className={`bg-type-btn ${newTemplate.background_type === 'image' ? 'active' : ''}`}
                                        onClick={handleSelectImage}
                                    >
                                        🖼️ Image
                                    </button>
                                    <button
                                        className={`bg-type-btn ${newTemplate.background_type === 'video' ? 'active' : ''}`}
                                        onClick={handleSelectVideo}
                                    >
                                        🎬 Video
                                    </button>
                                </div>
                            </div>

                            {/* Gradient Presets */}
                            {newTemplate.background_type === 'gradient' && (
                                <div className="form-group">
                                    <label className="form-label">Choose Gradient</label>
                                    <div className="color-picker-group">
                                        {GRADIENT_PRESETS.map((gradient, index) => (
                                            <div
                                                key={index}
                                                className={`color-swatch ${newTemplate.background_value === gradient.value ? 'active' : ''}`}
                                                style={{ background: gradient.value }}
                                                onClick={() => setNewTemplate({ ...newTemplate, background_value: gradient.value })}
                                                title={gradient.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Overlay for Image/Video */}
                            {(newTemplate.background_type === 'image' || newTemplate.background_type === 'video') && (
                                <div className="form-group">
                                    <label className="form-label">Overlay Darkness: {Math.round(parseFloat(newTemplate.background_overlay.split(',')[3]) * 100)}%</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="80"
                                        value={parseFloat(newTemplate.background_overlay.split(',')[3]) * 100}
                                        onChange={(e) => setNewTemplate({
                                            ...newTemplate,
                                            background_overlay: `rgba(0,0,0,${e.target.value / 100})`
                                        })}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Font Size: {newTemplate.font_size}px</label>
                                <input
                                    type="range"
                                    min="36"
                                    max="120"
                                    value={newTemplate.font_size}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, font_size: parseInt(e.target.value) })}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Font Color</label>
                                <div className="color-picker-group">
                                    {['#ffffff', '#f0f0f0', '#ffeb3b', '#4fc3f7', '#81c784', '#f48fb1'].map((color) => (
                                        <div
                                            key={color}
                                            className={`color-swatch ${newTemplate.font_color === color ? 'active' : ''}`}
                                            style={{ background: color }}
                                            onClick={() => setNewTemplate({ ...newTemplate, font_color: color })}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddTemplateModal(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleAddTemplate}>
                                Add Template
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MEDIA LIBRARY MODAL */}
            {showMediaLibraryModal && (
                <div className="modal-overlay" onClick={() => setShowMediaLibraryModal(false)}>
                    <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Media Library</h2>
                            <button className="modal-close" onClick={() => setShowMediaLibraryModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="media-library-grid">
                                {mediaLibrary.map((media) => (
                                    <div
                                        key={media.id}
                                        className="media-library-item"
                                        onClick={() => handleSelectFromLibrary(media)}
                                    >
                                        {media.type === 'image' ? (
                                            <img src={media.dataUrl || ''} alt={media.name} />
                                        ) : (
                                            <video src={media.dataUrl || ''} muted />
                                        )}
                                        <div className="media-library-item-name">{media.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
