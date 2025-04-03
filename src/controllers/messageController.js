// src/controllers/messageController.js
const { getUserByTelegramId, createUser, updateUserRequestCount } = require('../models/userModel');
const { processUserMessage } = require('../services/messageProcessor');
const { saveMessage } = require('../models/messageModel');
const { checkSpamLimits } = require('../services/spamProtection');
const { handleVoiceMessage } = require('../services/voiceProcessor');
const logger = require('../utils/logger');

/**
 * Обработка сообщения пользователя
 * @param {Object} bot - Экземпляр Telegram бота
 * @param {Object} msg - Объект сообщения
 * @returns {Promise<void>}
 */
async function handleMessage(bot, msg) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  
  try {
    // Проверяем, зарегистрирован ли пользователь
    let user = await getUserByTelegramId(telegramId);
    if (!user) {
      // Создаем нового пользователя
      user = await createUser({
        telegram_id: telegramId,
        username: msg.from.username || null,
        first_name: msg.from.first_name || null,
        last_name: msg.from.last_name || null
      });
      logger.info(`New user registered: ${telegramId}`);
    }
    
    // Проверка на спам
    if (await checkSpamLimits(telegramId)) {
      return bot.sendMessage(chatId, 'Вы отправляете слишком много сообщений. Пожалуйста, подождите немного.');
    }
    
    // Обновляем счетчик запросов пользователя
    await updateUserRequestCount(user.id);
    
    // Обработка голосовых сообщений
    if (msg.voice) {
      await bot.sendMessage(chatId, 'Обрабатываю ваше голосовое сообщение...');
      const text = await handleVoiceMessage(bot, msg);
      if (!text) {
        return bot.sendMessage(chatId, 'Не удалось распознать голосовое сообщение. Пожалуйста, попробуйте еще раз или отправьте текстовое сообщение.');
      }
      msg.text = text;
    }
    
    // Если нет текста, выходим
    if (!msg.text) {
      return bot.sendMessage(chatId, 'Пожалуйста, отправьте текстовое или голосовое сообщение.');
    }
    
    // Сохраняем сообщение пользователя
    await saveMessage(user.id, msg.text, false);
    
    // Отправляем индикатор набора текста
    await bot.sendChatAction(chatId, 'typing');
    
    // Обрабатываем сообщение и получаем ответ
    const response = await processUserMessage(user.id, msg.text);
    
    // Сохраняем ответ бота
    await saveMessage(user.id, response, true);
    
    // Отправляем ответ пользователю
    return bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error(`Error in handleMessage: ${error.message}`);
    throw error;
  }
}

module.exports = { handleMessage };
