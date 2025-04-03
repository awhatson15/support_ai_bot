// src/models/messageModel.js
const { db } = require('./database');
const logger = require('../utils/logger');

/**
 * Сохранение сообщения
 * @param {number} userId - ID пользователя в базе данных
 * @param {string} messageText - Текст сообщения
 * @param {boolean} isFromBot - Флаг, указывающий, что сообщение от бота
 * @returns {Promise<Object>} - Сохраненное сообщение
 */
function saveMessage(userId, messageText, isFromBot) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO messages (user_id, message_text, is_from_bot) VALUES (?, ?, ?)',
      [userId, messageText, isFromBot ? 1 : 0],
      function(err) {
        if (err) {
          logger.error(`Error saving message: ${err.message}`);
          return reject(err);
        }
        
        // Возвращаем сохраненное сообщение
        db.get('SELECT * FROM messages WHERE id = ?', [this.lastID], (err, row) => {
          if (err) {
            logger.error(`Error getting saved message: ${err.message}`);
            return reject(err);
          }
          resolve(row);
        });
      }
    );
  });
}

/**
 * Получение истории диалога пользователя
 * @param {number} userId - ID пользователя в базе данных
 * @param {number} limit - Количество последних сообщений
 * @returns {Promise<Array>} - Массив сообщений
 */
function getConversationHistory(userId, limit = 5) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit],
      (err, rows) => {
        if (err) {
          logger.error(`Error getting conversation history: ${err.message}`);
          return reject(err);
        }
        // Возвращаем в обратном порядке (от старых к новым)
        resolve(rows ? rows.reverse() : []);
      }
    );
  });
}

/**
 * Удаление истории диалога пользователя
 * @param {number} userId - ID пользователя в базе данных
 * @returns {Promise<void>}
 */
function clearConversationHistory(userId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM messages WHERE user_id = ?', [userId], function(err) {
      if (err) {
        logger.error(`Error clearing conversation history: ${err.message}`);
        return reject(err);
      }
      resolve();
    });
  });
}

module.exports = {
  saveMessage,
  getConversationHistory,
  clearConversationHistory
};
