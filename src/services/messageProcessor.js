// src/services/messageProcessor.js
const OpenAI = require('openai');
const { findFaqAnswer } = require('../models/faqModel');
const { getConversationHistory } = require('../models/messageModel');
const { createTicket } = require('../models/ticketModel');
const { getUserByTelegramId } = require('../models/userModel');
const { filterInappropriateContent } = require('../utils/contentFilter');
const logger = require('../utils/logger');

// Инициализация OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Максимальное количество сообщений для контекста
const CONTEXT_HISTORY_LENGTH = parseInt(process.env.CONTEXT_HISTORY_LENGTH) || 5;

/**
 * Обработка сообщения пользователя
 * @param {number} userId - ID пользователя в базе данных
 * @param {string} messageText - Текст сообщения
 * @returns {Promise<string>} - Ответ на сообщение
 */
async function processUserMessage(userId, messageText) {
  try {
    // Проверка на недопустимый контент
    if (filterInappropriateContent(messageText)) {
      return 'Ваше сообщение содержит недопустимый контент. Пожалуйста, соблюдайте правила общения.';
    }
    
    // Поиск ответа в FAQ
    const faqAnswer = await findFaqAnswer(messageText);
    if (faqAnswer) {
      logger.info(`FAQ answer found for user ${userId}`);
      return faqAnswer;
    }
    
    // Получение истории диалога 
    const history = await getConversationHistory(userId, CONTEXT_HISTORY_LENGTH);
    
    // Формирование запроса для GPT-4o
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Ты - бот технической поддержки компании. Твоя задача - помогать пользователям решать их проблемы.
                   Отвечай коротко и по существу. Если не знаешь точного ответа, скажи что "этот вопрос требует участия специалиста технической поддержки".
                   Не придумывай информацию, которой не знаешь. База знаний включает следующие категории:
                   1. Общие вопросы о компании
                   2. Технические проблемы с нашим ПО
                   3. Вопросы по аккаунтам и безопасности
                   4. Тарифы и оплата
                   5. Настройка оборудования`
        },
        ...history.map(msg => ({
          role: msg.is_from_bot ? "assistant" : "user",
          content: msg.message_text
        })),
        {
          role: "user",
          content: messageText
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });
    
    const answer = completion.choices[0].message.content.trim();
    
    // Если ответ содержит неуверенность, создаем тикет
    if (answer.includes("требует участия специалиста") || 
        answer.includes("не знаю") || 
        answer.includes("не могу предоставить точную информацию")) {
      const ticket = await createTicket(userId, "Новый", "Средний", "Вопрос", messageText);
      return `${answer}\n\nВаш запрос зарегистрирован под номером #${ticket.id}. Специалист свяжется с вами в ближайшее время.`;
    }
    
    return answer;
  } catch (error) {
    logger.error(`Error in processUserMessage: ${error.message}`);
    return "Извините, произошла техническая ошибка при обработке вашего запроса. Попробуйте задать вопрос позже.";
  }
}

module.exports = { processUserMessage };
