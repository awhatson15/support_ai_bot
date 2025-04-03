// src/models/userModel.js
const { db } = require('./database');
const logger = require('../utils/logger');

/**
 * Получение пользователя по Telegram ID
 * @param {number} telegramId - ID пользователя в Telegram
 * @returns {Promise<Object|null>} - Объект пользователя или null
 */
function getUserByTelegramId(telegramId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId], (err, row) => {
      if (err) {
        logger.error(`Error getting user by Telegram ID: ${err.message}`);
        return reject(err);
      }
      resolve(row || null);
    });
  });
}

/**
 * Создание нового пользователя
 * @param {Object} userData - Данные пользователя
 * @returns {Promise<Object>} - Созданный пользователь
 */
function createUser(userData) {
  return new Promise((resolve, reject) => {
    const { telegram_id, username, first_name, last_name } = userData;
    
    db.run(
      'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES (?, ?, ?, ?)',
      [telegram_id, username, first_name, last_name],
      function(err) {
        if (err) {
          logger.error(`Error creating user: ${err.message}`);
          return reject(err);
        }
        
        // Получаем созданного пользователя
        getUserByTelegramId(telegram_id)
          .then(user => resolve(user))
          .catch(err => reject(err));
      }
    );
  });
}

/**
 * Обновление счетчика запросов пользователя
 * @param {number} userId - ID пользователя в базе данных
 * @returns {Promise<void>}
 */
function updateUserRequestCount(userId) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET request_count = request_count + 1 WHERE id = ?',
      [userId],
      function(err) {
        if (err) {
          logger.error(`Error updating user request count: ${err.message}`);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

/**
 * Блокировка/разблокировка пользователя
 * @param {number} userId - ID пользователя в базе данных
 * @param {boolean} isBlocked - Статус блокировки
 * @returns {Promise<void>}
 */
function updateUserBlockStatus(userId, isBlocked) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET is_blocked = ? WHERE id = ?',
      [isBlocked ? 1 : 0, userId],
      function(err) {
        if (err) {
          logger.error(`Error updating user block status: ${err.message}`);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

/**
 * Получение всех пользователей
 * @returns {Promise<Array>} - Массив пользователей
 */
function getAllUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM users ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        logger.error(`Error getting all users: ${err.message}`);
        return reject(err);
      }
      resolve(rows || []);
    });
  });
}

module.exports = {
  getUserByTelegramId,
  createUser,
  updateUserRequestCount,
  updateUserBlockStatus,
  getAllUsers
};
