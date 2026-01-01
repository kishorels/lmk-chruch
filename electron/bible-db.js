const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Bible database path - in the project directory
let bibleDb = null;
let dbStructure = null; // Will store detected table/column structure

// English book names mapping
const ENGLISH_BOOK_NAMES = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
    'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
    'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
    'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
    'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
    'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    'Matthew', 'Mark', 'Luke', 'John', 'Acts',
    'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
    'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy',
    '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
    '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
    'Jude', 'Revelation'
];

// Initialize Bible database from the local TA folder
function initBibleDatabase() {
    // Try multiple possible paths for the Bible database
    const possiblePaths = [
        path.join(process.cwd(), 'TA-தமிழ்', 'ta_irv.sqlite'),
        path.join(__dirname, '..', 'TA-தமிழ்', 'ta_irv.sqlite'),
        path.join(process.resourcesPath || '', 'TA-தமிழ்', 'ta_irv.sqlite'),
    ];

    let dbPath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            dbPath = p;
            break;
        }
    }

    if (!dbPath) {
        console.error('Bible database not found. Tried paths:', possiblePaths);
        return false;
    }

    try {
        bibleDb = new Database(dbPath, { readonly: true });
        console.log('✓ Bible database loaded from:', dbPath);

        // Discover the database structure
        discoverDatabaseStructure();

        return true;
    } catch (error) {
        console.error('Failed to open Bible database:', error);
        return false;
    }
}

// Discover the database structure
function discoverDatabaseStructure() {
    if (!bibleDb) return;

    try {
        const tables = bibleDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        console.log('Available tables:', tables.map(t => t.name));

        dbStructure = {
            versesTable: null,
            booksTable: null,
            versesColumns: {},
            booksColumns: {}
        };

        // Look for verses table (might be named: verses, t_verses, bible_verses, etc.)
        const versesTableNames = ['verses', 't_verses', 'bible_verses', 'verse', 'scripture'];
        for (const tbl of tables) {
            if (versesTableNames.includes(tbl.name.toLowerCase()) || tbl.name.toLowerCase().includes('verse')) {
                dbStructure.versesTable = tbl.name;
                const columns = bibleDb.prepare(`PRAGMA table_info(${tbl.name})`).all();
                console.log(`Table ${tbl.name} columns:`, columns.map(c => c.name));

                // Detect column names
                for (const col of columns) {
                    const colName = col.name.toLowerCase();
                    if (colName.includes('book') && !dbStructure.versesColumns.book) {
                        dbStructure.versesColumns.book = col.name;
                    }
                    if (colName.includes('chapter') || colName === 'ch') {
                        dbStructure.versesColumns.chapter = col.name;
                    }
                    if ((colName.includes('verse') && !colName.includes('id')) || colName === 'v') {
                        dbStructure.versesColumns.verse = col.name;
                    }
                    if (colName.includes('text') || colName.includes('content') || colName === 't') {
                        dbStructure.versesColumns.text = col.name;
                    }
                }
                break;
            }
        }

        // Look for books table
        const booksTableNames = ['books', 't_book_key', 'bible_books', 'book', 'bookInfo'];
        for (const tbl of tables) {
            if (booksTableNames.includes(tbl.name.toLowerCase()) || tbl.name.toLowerCase().includes('book')) {
                dbStructure.booksTable = tbl.name;
                const columns = bibleDb.prepare(`PRAGMA table_info(${tbl.name})`).all();
                console.log(`Table ${tbl.name} columns:`, columns.map(c => c.name));

                for (const col of columns) {
                    const colName = col.name.toLowerCase();
                    if (colName.includes('number') || colName === 'id' || colName === 'book_num') {
                        dbStructure.booksColumns.id = col.name;
                    }
                    if (colName.includes('name') || colName.includes('title')) {
                        dbStructure.booksColumns.name = col.name;
                    }
                }
                break;
            }
        }

        console.log('Detected structure:', dbStructure);

        // Try to get a sample row from verses table
        if (dbStructure.versesTable) {
            try {
                const sample = bibleDb.prepare(`SELECT * FROM ${dbStructure.versesTable} LIMIT 3`).all();
                console.log('Sample verses:', sample);
            } catch (e) {
                console.error('Failed to get sample verses:', e.message);
            }
        }

    } catch (error) {
        console.error('Error discovering database structure:', error);
    }
}

// Get all Bible books
function getAllBibleBooks() {
    if (!bibleDb) {
        console.error('Bible database not initialized');
        return [];
    }

    try {
        // Try to get books from books table first
        if (dbStructure?.booksTable && dbStructure.booksColumns.id && dbStructure.booksColumns.name) {
            const books = bibleDb.prepare(`
                SELECT ${dbStructure.booksColumns.id} as id, ${dbStructure.booksColumns.name} as tamil_name
                FROM ${dbStructure.booksTable}
                ORDER BY ${dbStructure.booksColumns.id}
            `).all();

            return books.map(b => ({
                ...b,
                english_name: ENGLISH_BOOK_NAMES[b.id - 1] || `Book ${b.id}`,
                testament: b.id <= 39 ? 'OT' : 'NT'
            }));
        }

        // Fallback: Get unique books from verses table
        if (dbStructure?.versesTable && dbStructure.versesColumns.book) {
            const uniqueBooks = bibleDb.prepare(`
                SELECT DISTINCT ${dbStructure.versesColumns.book} as id
                FROM ${dbStructure.versesTable}
                ORDER BY ${dbStructure.versesColumns.book}
            `).all();

            return uniqueBooks.map(b => ({
                id: b.id,
                tamil_name: ENGLISH_BOOK_NAMES[b.id - 1] || `புத்தகம் ${b.id}`,
                english_name: ENGLISH_BOOK_NAMES[b.id - 1] || `Book ${b.id}`,
                testament: b.id <= 39 ? 'OT' : 'NT'
            }));
        }

        // Last resort: try common table names
        const commonQueries = [
            "SELECT DISTINCT book as id FROM verses ORDER BY book",
            "SELECT DISTINCT b as id FROM t_verses ORDER BY b",
            "SELECT book_number as id, book_name as tamil_name FROM t_book_key ORDER BY book_number",
        ];

        for (const query of commonQueries) {
            try {
                const books = bibleDb.prepare(query).all();
                if (books.length > 0) {
                    return books.map(b => ({
                        id: b.id,
                        tamil_name: b.tamil_name || ENGLISH_BOOK_NAMES[b.id - 1] || `புத்தகம் ${b.id}`,
                        english_name: ENGLISH_BOOK_NAMES[b.id - 1] || `Book ${b.id}`,
                        testament: b.id <= 39 ? 'OT' : 'NT'
                    }));
                }
            } catch (e) {
                // Try next query
            }
        }

        console.error('Could not find books in any known structure');
        return [];
    } catch (error) {
        console.error('Error getting Bible books:', error);
        return [];
    }
}

// Get chapters for a book
function getChaptersByBook(bookId) {
    if (!bibleDb || !dbStructure?.versesTable) return [];

    try {
        const bookCol = dbStructure.versesColumns.book || 'book';
        const chapterCol = dbStructure.versesColumns.chapter || 'chapter';

        const chapters = bibleDb.prepare(`
            SELECT DISTINCT ${chapterCol} as chapter_number
            FROM ${dbStructure.versesTable}
            WHERE ${bookCol} = ?
            ORDER BY ${chapterCol}
        `).all(bookId);

        return chapters.map((c) => ({
            id: `${bookId}_${c.chapter_number}`,
            book_id: bookId,
            chapter_number: c.chapter_number
        }));
    } catch (error) {
        console.error('Error getting chapters:', error);
        return [];
    }
}

// Get verses for a chapter
function getVersesByChapter(bookId, chapterNumber) {
    if (!bibleDb || !dbStructure?.versesTable) return [];

    try {
        const bookCol = dbStructure.versesColumns.book || 'book';
        const chapterCol = dbStructure.versesColumns.chapter || 'chapter';
        const verseCol = dbStructure.versesColumns.verse || 'verse';
        const textCol = dbStructure.versesColumns.text || 'text';

        const verses = bibleDb.prepare(`
            SELECT 
                ${verseCol} as verse_number,
                ${textCol} as content
            FROM ${dbStructure.versesTable}
            WHERE ${bookCol} = ? AND ${chapterCol} = ?
            ORDER BY ${verseCol}
        `).all(bookId, chapterNumber);

        return verses.map(v => ({
            id: `${bookId}_${chapterNumber}_${v.verse_number}`,
            verse_number: v.verse_number,
            content: v.content
        }));
    } catch (error) {
        console.error('Error getting verses:', error);
        return [];
    }
}

// Search Bible for text
function searchBible(query, limit = 50) {
    if (!bibleDb || !query || !dbStructure?.versesTable) return [];

    try {
        const bookCol = dbStructure.versesColumns.book || 'book';
        const chapterCol = dbStructure.versesColumns.chapter || 'chapter';
        const verseCol = dbStructure.versesColumns.verse || 'verse';
        const textCol = dbStructure.versesColumns.text || 'text';

        const results = bibleDb.prepare(`
            SELECT 
                ${bookCol} as book,
                ${chapterCol} as chapter,
                ${verseCol} as verse_number,
                ${textCol} as content
            FROM ${dbStructure.versesTable}
            WHERE ${textCol} LIKE ?
            LIMIT ?
        `).all(`%${query}%`, limit);

        return results;
    } catch (error) {
        console.error('Error searching Bible:', error);
        return [];
    }
}

// Get a single verse
function getVerse(bookId, chapter, verse) {
    if (!bibleDb || !dbStructure?.versesTable) return null;

    try {
        const bookCol = dbStructure.versesColumns.book || 'book';
        const chapterCol = dbStructure.versesColumns.chapter || 'chapter';
        const verseCol = dbStructure.versesColumns.verse || 'verse';
        const textCol = dbStructure.versesColumns.text || 'text';

        const result = bibleDb.prepare(`
            SELECT 
                ${bookCol} as book,
                ${chapterCol} as chapter,
                ${verseCol} as verse_number,
                ${textCol} as content
            FROM ${dbStructure.versesTable}
            WHERE ${bookCol} = ? AND ${chapterCol} = ? AND ${verseCol} = ?
        `).get(bookId, chapter, verse);

        return result;
    } catch (error) {
        console.error('Error getting verse:', error);
        return null;
    }
}

// Get total verse count
function getBibleVerseCount() {
    if (!bibleDb || !dbStructure?.versesTable) return 0;

    try {
        const result = bibleDb.prepare(`SELECT COUNT(*) as count FROM ${dbStructure.versesTable}`).get();
        return result.count;
    } catch (error) {
        console.error('Error getting verse count:', error);
        return 0;
    }
}

module.exports = {
    initBibleDatabase,
    getAllBibleBooks,
    getChaptersByBook,
    getVersesByChapter,
    searchBible,
    getVerse,
    getBibleVerseCount
};
