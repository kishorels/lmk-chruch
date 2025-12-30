const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// Database path in user data directory
const dbPath = path.join(app.getPath('userData'), 'lmk-church.db');
const db = new Database(dbPath);

// Initialize database tables
function initializeDatabase() {
  // Templates table - supports gradient, image, and video backgrounds
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      background_type TEXT DEFAULT 'gradient',
      background_value TEXT DEFAULT 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      background_overlay TEXT DEFAULT 'rgba(0,0,0,0.3)',
      font_family TEXT DEFAULT 'Inter',
      font_size INTEGER DEFAULT 72,
      font_color TEXT DEFAULT '#ffffff',
      text_align TEXT DEFAULT 'center',
      text_shadow TEXT DEFAULT '2px 2px 8px rgba(0,0,0,0.8)',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Check if background_overlay column exists, add if not
  try {
    db.prepare('SELECT background_overlay FROM templates LIMIT 1').get();
  } catch (e) {
    db.exec('ALTER TABLE templates ADD COLUMN background_overlay TEXT DEFAULT "rgba(0,0,0,0.3)"');
  }

  // Songs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT,
      category TEXT DEFAULT 'Worship',
      template_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES templates(id)
    )
  `);

  // Verses table (song lyrics)
  db.exec(`
    CREATE TABLE IF NOT EXISTS verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL,
      verse_number INTEGER NOT NULL,
      verse_type TEXT DEFAULT 'verse',
      content TEXT NOT NULL,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    )
  `);

  // Media library table for storing uploaded images and videos
  db.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default templates if none exist
  const templateCount = db.prepare('SELECT COUNT(*) as count FROM templates').get();
  if (templateCount.count === 0) {
    const insertTemplate = db.prepare(`
      INSERT INTO templates (name, background_type, background_value, background_overlay, font_family, font_size, font_color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Default gradient templates
    insertTemplate.run('Heavenly Purple', 'gradient', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'rgba(0,0,0,0)', 'Inter', 72, '#ffffff');
    insertTemplate.run('Ocean Blue', 'gradient', 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', 'rgba(0,0,0,0)', 'Inter', 72, '#ffffff');
    insertTemplate.run('Sunset Gold', 'gradient', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 'rgba(0,0,0,0)', 'Inter', 72, '#ffffff');
    insertTemplate.run('Forest Green', 'gradient', 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)', 'rgba(0,0,0,0)', 'Inter', 72, '#ffffff');
    insertTemplate.run('Royal Purple', 'gradient', 'linear-gradient(135deg, #4a0e4e 0%, #81689d 100%)', 'rgba(0,0,0,0)', 'Inter', 72, '#ffffff');
    insertTemplate.run('Night Sky', 'gradient', 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%)', 'rgba(0,0,0,0)', 'Inter', 72, '#ffffff');
  }

  // Insert sample songs if none exist
  const songCount = db.prepare('SELECT COUNT(*) as count FROM songs').get();
  if (songCount.count === 0) {
    const insertSong = db.prepare('INSERT INTO songs (title, author, category, template_id) VALUES (?, ?, ?, ?)');
    const insertVerse = db.prepare('INSERT INTO verses (song_id, verse_number, verse_type, content) VALUES (?, ?, ?, ?)');

    // How Great Is Our God
    const song1 = insertSong.run('How Great Is Our God', 'Chris Tomlin', 'Worship', 1);
    insertVerse.run(song1.lastInsertRowid, 1, 'verse', 'The splendor of the King\nClothed in majesty\nLet all the earth rejoice\nAll the earth rejoice');
    insertVerse.run(song1.lastInsertRowid, 2, 'verse', 'He wraps Himself in light\nAnd darkness tries to hide\nAnd trembles at His voice\nAnd trembles at His voice');
    insertVerse.run(song1.lastInsertRowid, 3, 'chorus', 'How great is our God\nSing with me\nHow great is our God\nAnd all will see\nHow great, how great is our God');
    insertVerse.run(song1.lastInsertRowid, 4, 'verse', 'Age to age He stands\nAnd time is in His hands\nBeginning and the End\nBeginning and the End');

    // Amazing Grace
    const song2 = insertSong.run('Amazing Grace', 'John Newton', 'Hymn', 2);
    insertVerse.run(song2.lastInsertRowid, 1, 'verse', 'Amazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind but now I see');
    insertVerse.run(song2.lastInsertRowid, 2, 'verse', "Twas grace that taught my heart to fear\nAnd grace my fears relieved\nHow precious did that grace appear\nThe hour I first believed");
    insertVerse.run(song2.lastInsertRowid, 3, 'verse', 'Through many dangers toils and snares\nI have already come\nTis grace hath brought me safe thus far\nAnd grace will lead me home');

    // 10,000 Reasons
    const song3 = insertSong.run('10,000 Reasons', 'Matt Redman', 'Worship', 3);
    insertVerse.run(song3.lastInsertRowid, 1, 'chorus', 'Bless the Lord O my soul\nO my soul\nWorship His holy name\nSing like never before\nO my soul\nI worship Your holy name');
    insertVerse.run(song3.lastInsertRowid, 2, 'verse', 'The sun comes up\nIts a new day dawning\nIts time to sing\nYour song again');
    insertVerse.run(song3.lastInsertRowid, 3, 'verse', "Whatever may pass\nAnd whatever lies before me\nLet me be singing\nWhen the evening comes");
  }
}

// CRUD Operations for Templates
function getAllTemplates() {
  return db.prepare('SELECT * FROM templates ORDER BY name').all();
}

function getTemplateById(id) {
  return db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
}

function createTemplate(template) {
  const stmt = db.prepare(`
    INSERT INTO templates (name, background_type, background_value, background_overlay, font_family, font_size, font_color, text_align, text_shadow)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    template.name,
    template.background_type,
    template.background_value,
    template.background_overlay || 'rgba(0,0,0,0.3)',
    template.font_family,
    template.font_size,
    template.font_color,
    template.text_align,
    template.text_shadow
  );
  return { id: result.lastInsertRowid, ...template };
}

function updateTemplate(id, template) {
  const stmt = db.prepare(`
    UPDATE templates SET name = ?, background_type = ?, background_value = ?, background_overlay = ?,
    font_family = ?, font_size = ?, font_color = ?, text_align = ?, text_shadow = ?
    WHERE id = ?
  `);
  stmt.run(
    template.name,
    template.background_type,
    template.background_value,
    template.background_overlay || 'rgba(0,0,0,0.3)',
    template.font_family,
    template.font_size,
    template.font_color,
    template.text_align,
    template.text_shadow,
    id
  );
  return { id, ...template };
}

function deleteTemplate(id) {
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
}

// CRUD Operations for Songs
function getAllSongs() {
  return db.prepare(`
    SELECT s.*, t.name as template_name, t.background_value as template_background
    FROM songs s
    LEFT JOIN templates t ON s.template_id = t.id
    ORDER BY s.title
  `).all();
}

function getSongById(id) {
  return db.prepare(`
    SELECT s.*, t.name as template_name, t.background_value as template_background,
    t.background_type, t.background_overlay, t.font_family, t.font_size, t.font_color, t.text_align, t.text_shadow
    FROM songs s
    LEFT JOIN templates t ON s.template_id = t.id
    WHERE s.id = ?
  `).get(id);
}

function getSongWithVerses(id) {
  const song = getSongById(id);
  if (song) {
    song.verses = db.prepare('SELECT * FROM verses WHERE song_id = ? ORDER BY verse_number').all(id);
  }
  return song;
}

function createSong(song) {
  const stmt = db.prepare(`
    INSERT INTO songs (title, author, category, template_id)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(song.title, song.author, song.category, song.template_id);
  return { id: result.lastInsertRowid, ...song };
}

function updateSong(id, song) {
  const stmt = db.prepare(`
    UPDATE songs SET title = ?, author = ?, category = ?, template_id = ?
    WHERE id = ?
  `);
  stmt.run(song.title, song.author, song.category, song.template_id, id);
  return { id, ...song };
}

function deleteSong(id) {
  db.prepare('DELETE FROM verses WHERE song_id = ?').run(id);
  db.prepare('DELETE FROM songs WHERE id = ?').run(id);
}

// CRUD Operations for Verses
function addVerse(verse) {
  const stmt = db.prepare(`
    INSERT INTO verses (song_id, verse_number, verse_type, content)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(verse.song_id, verse.verse_number, verse.verse_type, verse.content);
  return { id: result.lastInsertRowid, ...verse };
}

function updateVerse(id, verse) {
  const stmt = db.prepare(`
    UPDATE verses SET verse_number = ?, verse_type = ?, content = ?
    WHERE id = ?
  `);
  stmt.run(verse.verse_number, verse.verse_type, verse.content, id);
  return { id, ...verse };
}

function deleteVerse(id) {
  db.prepare('DELETE FROM verses WHERE id = ?').run(id);
}

function getVersesBySongId(songId) {
  return db.prepare('SELECT * FROM verses WHERE song_id = ? ORDER BY verse_number').all(songId);
}

// Search songs
function searchSongs(query) {
  return db.prepare(`
    SELECT s.*, t.name as template_name
    FROM songs s
    LEFT JOIN templates t ON s.template_id = t.id
    WHERE s.title LIKE ? OR s.author LIKE ?
    ORDER BY s.title
  `).all(`%${query}%`, `%${query}%`);
}

// Media Library Operations
function getAllMedia() {
  return db.prepare('SELECT * FROM media ORDER BY created_at DESC').all();
}

function getMediaByType(type) {
  return db.prepare('SELECT * FROM media WHERE type = ? ORDER BY created_at DESC').all(type);
}

function addMedia(media) {
  const stmt = db.prepare('INSERT INTO media (name, type, file_path, thumbnail_path) VALUES (?, ?, ?, ?)');
  const result = stmt.run(media.name, media.type, media.file_path, media.thumbnail_path);
  return { id: result.lastInsertRowid, ...media };
}

function deleteMedia(id) {
  db.prepare('DELETE FROM media WHERE id = ?').run(id);
}

module.exports = {
  initializeDatabase,
  // Templates
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  // Songs
  getAllSongs,
  getSongById,
  getSongWithVerses,
  createSong,
  updateSong,
  deleteSong,
  searchSongs,
  // Verses
  addVerse,
  updateVerse,
  deleteVerse,
  getVersesBySongId,
  // Media
  getAllMedia,
  getMediaByType,
  addMedia,
  deleteMedia
};
