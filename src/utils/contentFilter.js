// src/utils/contentFilter.js
const logger = require('./logger');

/**
 * Список запрещенных слов и фраз
 * @type {Array}
 */
const prohibitedWords = [
  'спам', 'реклама', 'бесплатно', 'выигрыш', 'лотерея',
  // Нецензурные слова и оскорбления
  'идиот', 'тупой', 'дурак'
  // ... добавьте другие запрещенные слова
];

/**
 * Проверка текста на наличие недопустимого контента
 * @param {string} text - Текст для проверки
 * @returns {boolean} - true, если найден недопустимый контент
 */
function filterInappropriateContent(text) {
  if (!text) return false;
  
  // Приводим к нижнему регистру для проверки
  const lowerText = text.toLowerCase();
  
  // Проверяем на наличие запрещенных слов
  for (const word of prohibitedWords) {
    if (lowerText.includes(word.toLowerCase())) {
      logger.warn(`Inappropriate content detected: "${text}"`);
      return true;
    }
  }
  
  // Проверка на слишком частые повторения символов (спам)
  const repeatedCharsPattern = /(.)\1{5,}/;
  if (repeatedCharsPattern.test(lowerText)) {
    logger.warn(`Repeated characters detected (possible spam): "${text}"`);
    return true;
  }
  
  // Проверка на слишком много заглавных букв (КРИК)
  const upperCaseCount = (text.match(/[A-ZА-Я]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  if (totalChars > 10 && upperCaseCount / totalChars > 0.7) {
    logger.warn(`Too many uppercase letters detected: "${text}"`);
    return true;
  }
  
  return false;
}

module.exports = { filterInappropriateContent };
