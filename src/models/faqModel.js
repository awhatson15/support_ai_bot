// src/models/faqModel.js
const { db } = require('./database');
const logger = require('../utils/logger');

/**
 * Получение всех FAQ
 * @returns {Promise<Array>} - Массив FAQ
 */
function getAllFaqs() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM faqs ORDER BY category, id', (err, rows) => {
      if (err) {
        logger.error(`Error getting all FAQs: ${err.message}`);
        return reject(err);
      }
      resolve(rows || []);
    });
  });
}

/**
 * Добавление нового FAQ
 * @param {Object} faqData - Данные FAQ
 * @returns {Promise<Object>} - Добавленный FAQ
 */
function addFaq(faqData) {
  return new Promise((resolve, reject) => {
    const { question, answer, keywords, category } = faqData;
    
    db.run(
      'INSERT INTO faqs (question, answer, keywords, category) VALUES (?, ?, ?, ?)',
      [question, answer, keywords, category],
      function(err) {
        if (err) {
          logger.error(`Error adding FAQ: ${err.message}`);
          return reject(err);
        }
        
        // Получаем добавленный FAQ
        db.get('SELECT * FROM faqs WHERE id = ?', [this.lastID], (err, row) => {
          if (err) {
            logger.error(`Error getting added FAQ: ${err.message}`);
            return reject(err);
          }
          resolve(row);
        });
      }
    );
  });
}

/**
 * Обновление FAQ
 * @param {number} id - ID FAQ
 * @param {Object} faqData - Данные для обновления
 * @returns {Promise<Object>} - Обновленный FAQ
 */
function updateFaq(id, faqData) {
  return new Promise((resolve, reject) => {
    const { question, answer, keywords, category } = faqData;
    
    db.run(
      'UPDATE faqs SET question = ?, answer = ?, keywords = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [question, answer, keywords, category, id],
      function(err) {
        if (err) {
          logger.error(`Error updating FAQ: ${err.message}`);
          return reject(err);
        }
        
        // Получаем обновленный FAQ
        db.get('SELECT * FROM faqs WHERE id = ?', [id], (err, row) => {
          if (err) {
            logger.error(`Error getting updated FAQ: ${err.message}`);
            return reject(err);
          }
          resolve(row);
        });
      }
    );
  });
}

/**
 * Удаление FAQ
 * @param {number} id - ID FAQ
 * @returns {Promise<boolean>} - Результат удаления
 */
function deleteFaq(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM faqs WHERE id = ?', [id], function(err) {
      if (err) {
        logger.error(`Error deleting FAQ: ${err.message}`);
        return reject(err);
      }
      resolve(this.changes > 0);
    });
  });
}

/**
 * Поиск ответа в базе FAQ
 * @param {string} query - Текст запроса
 * @returns {Promise<string|null>} - Ответ или null, если ничего не найдено
 */
function findFaqAnswer(query) {
  return new Promise((resolve, reject) => {
    // Получаем все FAQ
    getAllFaqs()
      .then(faqs => {
        if (!faqs.length) return resolve(null);
        
        const lowerQuery = query.toLowerCase();
        
        // 1. Прямое совпадение с вопросом
        const exactMatch = faqs.find(faq => 
          faq.question.toLowerCase() === lowerQuery
        );
        if (exactMatch) return resolve(exactMatch.answer);
        
        // 2. Вопрос содержится в запросе
        const containsQuestion = faqs.find(faq => 
          lowerQuery.includes(faq.question.toLowerCase())
        );
        if (containsQuestion) return resolve(containsQuestion.answer);
        
        // 3. Совпадение по ключевым словам
        const keywordMatch = faqs.find(faq => {
          if (!faq.keywords) return false;
          
          const keywords = faq.keywords.split(',').map(k => k.trim().toLowerCase());
          return keywords.some(keyword => lowerQuery.includes(keyword));
        });
        if (keywordMatch) return resolve(keywordMatch.answer);
        
        // Ничего не найдено
        resolve(null);
      })
      .catch(err => {
        logger.error(`Error in findFaqAnswer: ${err.message}`);
        reject(err);
      });
  });
}

module.exports = {
  getAllFaqs,
  addFaq,
  updateFaq,
  deleteFaq,
  findFaqAnswer
};
