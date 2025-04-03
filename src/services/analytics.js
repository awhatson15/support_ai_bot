// src/services/analytics.js
const { db } = require('../models/database');
const logger = require('../utils/logger');

/**
 * Получение общей статистики использования
 * @returns {Promise<Object>} - Объект со статистикой
 */
function getStats() {
  return new Promise((resolve, reject) => {
    const stats = {
      users: 0,
      totalRequests: 0,
      tickets: {
        total: 0,
        new: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0
      },
      faqs: 0,
      messages: 0,
      lastActivity: null
    };
    
    db.serialize(() => {
      // Количество пользователей
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) {
          logger.error(`Error getting users count: ${err.message}`);
          return reject(err);
        }
        stats.users = row.count;
        
        // Общее количество запросов
        db.get('SELECT SUM(request_count) as total FROM users', (err, row) => {
          if (err) {
            logger.error(`Error getting total requests: ${err.message}`);
            return reject(err);
          }
          stats.totalRequests = row.total || 0;
          
          // Статистика тикетов
          db.get('SELECT COUNT(*) as count FROM tickets', (err, row) => {
            if (err) {
              logger.error(`Error getting tickets count: ${err.message}`);
              return reject(err);
            }
            stats.tickets.total = row.count;
            
            // Тикеты по статусам
            db.get("SELECT COUNT(*) as count FROM tickets WHERE status = 'Новый'", (err, row) => {
              if (err) {
                logger.error(`Error getting new tickets count: ${err.message}`);
                return reject(err);
              }
              stats.tickets.new = row.count;
              
              db.get("SELECT COUNT(*) as count FROM tickets WHERE status = 'В работе'", (err, row) => {
                if (err) {
                  logger.error(`Error getting in-progress tickets count: ${err.message}`);
                  return reject(err);
                }
                stats.tickets.inProgress = row.count;
                
                db.get("SELECT COUNT(*) as count FROM tickets WHERE status = 'Решен'", (err, row) => {
                  if (err) {
                    logger.error(`Error getting resolved tickets count: ${err.message}`);
                    return reject(err);
                  }
                  stats.tickets.resolved = row.count;
                  
                  db.get("SELECT COUNT(*) as count FROM tickets WHERE status = 'Закрыт'", (err, row) => {
                    if (err) {
                      logger.error(`Error getting closed tickets count: ${err.message}`);
                      return reject(err);
                    }
                    stats.tickets.closed = row.count;
                    
                    // Количество FAQ
                    db.get('SELECT COUNT(*) as count FROM faqs', (err, row) => {
                      if (err) {
                        logger.error(`Error getting FAQs count: ${err.message}`);
                        return reject(err);
                      }
                      stats.faqs = row.count;
                      
                      // Количество сообщений
                      db.get('SELECT COUNT(*) as count FROM messages', (err, row) => {
                        if (err) {
                          logger.error(`Error getting messages count: ${err.message}`);
                          return reject(err);
                        }
                        stats.messages = row.count;
                        
                        // Последняя активность
                        db.get('SELECT MAX(created_at) as last FROM messages', (err, row) => {
                          if (err) {
                            logger.error(`Error getting last activity: ${err.message}`);
                            return reject(err);
                          }
                          stats.lastActivity = row.last;
                          
                          resolve(stats);
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

/**
 * Получение статистики по периоду
 * @param {string} startDate - Начальная дата (YYYY-MM-DD)
 * @param {string} endDate - Конечная дата (YYYY-MM-DD)
 * @returns {Promise<Object>} - Объект со статистикой за период
 */
function getStatsByPeriod(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const stats = {
      newUsers: 0,
      messages: 0,
      tickets: 0,
      ticketsByDay: {}
    };
    
    // Форматируем даты для запросов
    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;
    
    db.serialize(() => {
      // Новые пользователи за период
      db.get(
        'SELECT COUNT(*) as count FROM users WHERE created_at BETWEEN ? AND ?',
        [start, end],
        (err, row) => {
          if (err) {
            logger.error(`Error getting new users for period: ${err.message}`);
            return reject(err);
          }
          stats.newUsers = row.count;
          
          // Сообщения за период
          db.get(
            'SELECT COUNT(*) as count FROM messages WHERE created_at BETWEEN ? AND ?',
            [start, end],
            (err, row) => {
              if (err) {
                logger.error(`Error getting messages for period: ${err.message}`);
                return reject(err);
              }
              stats.messages = row.count;
              
              // Тикеты за период
              db.get(
                'SELECT COUNT(*) as count FROM tickets WHERE created_at BETWEEN ? AND ?',
                [start, end],
                (err, row) => {
                  if (err) {
                    logger.error(`Error getting tickets for period: ${err.message}`);
                    return reject(err);
                  }
                  stats.tickets = row.count;
                  
                  // Тикеты по дням
                  db.all(
                    "SELECT date(created_at) as day, COUNT(*) as count FROM tickets WHERE created_at BETWEEN ? AND ? GROUP BY date(created_at)",
                    [start, end],
                    (err, rows) => {
                      if (err) {
                        logger.error(`Error getting tickets by day: ${err.message}`);
                        return reject(err);
                      }
                      
                      // Преобразуем в объект для удобства
                      rows.forEach(row => {
                        stats.ticketsByDay[row.day] = row.count;
                      });
                      
                      resolve(stats);
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
}

module.exports = {
  getStats,
  getStatsByPeriod
};
