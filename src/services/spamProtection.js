// src/services/spamProtection.js
const { getUserByTelegramId, updateUserBlockStatus } = require('../models/userModel');
const logger = require('../utils/logger');

// Получаем лимиты из переменных окружения или используем значения по умолчанию
const HOURLY_LIMIT = parseInt(process.env.MAX_HOURLY_REQUESTS) || 20;
const MINUTE_LIMIT = parseInt(process.env.MAX_MINUTE_REQUESTS) || 5;

// Кэш для хранения временных данных о запросах
const requestCache = {
  hourly: {},
  minute: {}
};

// Очистка устаревших данных кэша
setInterval(() => {
  const now = Date.now();
  
  // Очистка часовых данных
  Object.keys(requestCache.hourly).forEach(userId => {
    if (now - requestCache.hourly[userId].timestamp > 3600000) {
      delete requestCache.hourly[userId];
    }
  });
  
  // Очистка минутных данных
  Object.keys(requestCache.minute).forEach(userId => {
    if (now - requestCache.minute[userId].timestamp > 60000) {
      delete requestCache.minute[userId];
    }
  });
}, 60000);

/**
 * Проверка на превышение лимитов запросов
 * @param {number} telegramId - ID пользователя в Telegram
 * @returns {Promise<boolean>} - true, если превышен лимит
 */
async function checkSpamLimits(telegramId) {
  const now = Date.now();
  const userId = telegramId.toString();
  
  try {
    // Получаем пользователя для проверки блокировки
    const user = await getUserByTelegramId(telegramId);
    if (user && user.is_blocked) {
      return true; // Пользователь заблокирован
    }
    
    // Проверка часового лимита
    if (!requestCache.hourly[userId]) {
      requestCache.hourly[userId] = {
        count: 1,
        timestamp: now
      };
    } else if (now - requestCache.hourly[userId].timestamp > 3600000) {
      // Сбрасываем счетчик, если прошел час
      requestCache.hourly[userId] = {
        count: 1,
        timestamp: now
      };
    } else {
      requestCache.hourly[userId].count++;
      
      if (requestCache.hourly[userId].count > HOURLY_LIMIT) {
        logger.warn(`User ${userId} exceeded hourly request limit (${HOURLY_LIMIT})`);
        if (user) {
          // Временно блокируем пользователя
          await updateUserBlockStatus(user.id, true);
          
          // Автоматическая разблокировка через час
          setTimeout(async () => {
            await updateUserBlockStatus(user.id, false);
            logger.info(`User ${userId} has been automatically unblocked`);
          }, 3600000);
        }
        return true; // Превышен лимит
      }
    }
    
    // Проверка минутного лимита
    if (!requestCache.minute[userId]) {
      requestCache.minute[userId] = {
        count: 1,
        timestamp: now
      };
    } else if (now - requestCache.minute[userId].timestamp > 60000) {
      // Сбрасываем счетчик, если прошла минута
      requestCache.minute[userId] = {
        count: 1,
        timestamp: now
      };
    } else {
      requestCache.minute[userId].count++;
      
      if (requestCache.minute[userId].count > MINUTE_LIMIT) {
        logger.warn(`User ${userId} exceeded minute request limit (${MINUTE_LIMIT})`);
        return true; // Превышен лимит
      }
    }
    
    return false; // Лимиты не превышены
  } catch (error) {
    logger.error(`Error in checkSpamLimits: ${error.message}`);
    return false; // В случае ошибки разрешаем запрос
  }
}

module.exports = { checkSpamLimits };
