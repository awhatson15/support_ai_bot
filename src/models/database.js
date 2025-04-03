// src/models/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../db/support_bot.db');

// Проверка наличия директории db
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error(`Error connecting to database: ${err.message}`);
    throw err;
  }
  logger.info('Connected to the SQLite database');
});

function initializeDb() {
  // Включаем поддержку внешних ключей
  db.run('PRAGMA foreign_keys = ON');
  
  // Создаем таблицы
  db.serialize(() => {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      telegram_id INTEGER UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      is_blocked BOOLEAN DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Таблица сообщений
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      message_text TEXT,
      is_from_bot BOOLEAN,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    
    // Таблица тикетов
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      status TEXT,
      priority TEXT,
      issue_type TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    
    // Таблица FAQ
    db.run(`CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY,
      question TEXT,
      answer TEXT,
      keywords TEXT,
      category TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Таблица конфигурации
    db.run(`CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY,
      key TEXT UNIQUE,
      value TEXT,
      description TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    logger.info('Database tables created successfully');
  });
}

module.exports = { db, initializeDb };
