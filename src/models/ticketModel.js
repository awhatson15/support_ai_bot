// src/models/ticketModel.js
const { db } = require('./database');
const logger = require('../utils/logger');

/**
 * Создание нового тикета
 * @param {number} userId - ID пользователя в базе данных
 * @param {string} status - Статус тикета
 * @param {string} priority - Приоритет тикета
 * @param {string} issueType - Тип проблемы
 * @param {string} description - Описание проблемы
 * @returns {Promise<Object>} - Созданный тикет
 */
function createTicket(userId, status, priority, issueType, description) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO tickets (user_id, status, priority, issue_type, description) VALUES (?, ?, ?, ?, ?)',
      [userId, status, priority, issueType, description],
      function(err) {
        if (err) {
          logger.error(`Error creating ticket: ${err.message}`);
          return reject(err);
        }
        
        // Получаем созданный тикет
        db.get('SELECT * FROM tickets WHERE id = ?', [this.lastID], (err, row) => {
          if (err) {
            logger.error(`Error getting created ticket: ${err.message}`);
            return reject(err);
          }
          resolve(row);
        });
      }
    );
  });
}

/**
 * Получение всех тикетов
 * @param {string} [status] - Фильтр по статусу
 * @returns {Promise<Array>} - Массив тикетов
 */
function getTickets(status = null) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT t.*, u.telegram_id, u.username, u.first_name, u.last_name
      FROM tickets t
      JOIN users u ON t.user_id = u.id
    `;
    
    const params = [];
    if (status) {
      query += ' WHERE t.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY t.created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) {
        logger.error(`Error getting tickets: ${err.message}`);
        return reject(err);
      }
      resolve(rows || []);
    });
  });
}

/**
 * Получение тикетов пользователя
 * @param {number} userId - ID пользователя в базе данных
 * @returns {Promise<Array>} - Массив тикетов
 */
function getUserTickets(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
      (err, rows) => {
        if (err) {
          logger.error(`Error getting user tickets: ${err.message}`);
          return reject(err);
        }
        resolve(rows || []);
      }
    );
  });
}

/**
 * Обновление статуса тикета
 * @param {number} ticketId - ID тикета
 * @param {string} status - Новый статус
 * @returns {Promise<Object>} - Обновленный тикет
 */
function updateTicketStatus(ticketId, status) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, ticketId],
      function(err) {
        if (err) {
          logger.error(`Error updating ticket status: ${err.message}`);
          return reject(err);
        }
        
        // Получаем обновленный тикет
        db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, row) => {
          if (err) {
            logger.error(`Error getting updated ticket: ${err.message}`);
            return reject(err);
          }
          resolve(row);
        });
      }
    );
  });
}

/**
 * Получение тикета по ID
 * @param {number} ticketId - ID тикета
 * @returns {Promise<Object|null>} - Тикет или null
 */
function getTicketById(ticketId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, row) => {
      if (err) {
        logger.error(`Error getting ticket by ID: ${err.message}`);
        return reject(err);
      }
      resolve(row || null);
    });
  });
}

module.exports = {
  createTicket,
  getTickets,
  getUserTickets,
  updateTicketStatus,
  getTicketById
};
