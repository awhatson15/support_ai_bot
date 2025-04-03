// src/bot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { handleMessage } = require('./controllers/messageController');
const { getUserByTelegramId } = require('./models/userModel');
const { getUserTickets } = require('./models/ticketModel');
const { initializeDb } = require('./models/database');
const logger = require('./utils/logger');

// Инициализация бота
const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  logger.error('TELEGRAM_TOKEN is not set in environment variables');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Инициализация базы данных
initializeDb();

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    'Добро пожаловать в бот технической поддержки! 👋\n\n' +
    'Я могу помочь вам с различными вопросами и проблемами. Просто опишите, что вас интересует, и я постараюсь помочь.\n\n' +
    'Вы можете отправлять как текстовые, так и голосовые сообщения.\n\n' +
    'Для получения справки используйте команду /help'
  );
});

// Обработка команды /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    'Справка по использованию бота:\n\n' +
    '• Задайте вопрос в свободной форме\n' +
    '• Для сложных запросов будет создан тикет\n' +
    '• Используйте команду /status для проверки статуса ваших запросов\n\n' +
    'Доступные команды:\n' +
    '/start - Начало работы с ботом\n' +
    '/help - Показать эту справку\n' +
    '/status - Проверить статус ваших запросов\n' +
    '/clear - Очистить историю диалога'
  );
});

// Обработка команды /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  
  try {
    // Получаем пользователя
    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return bot.sendMessage(chatId, 'Вы еще не зарегистрированы в системе.');
    }
    
    // Получаем тикеты пользователя
    const tickets = await getUserTickets(user.id);
    
    if (!tickets.length) {
      return bot.sendMessage(chatId, 'У вас нет активных запросов в технической поддержке.');
    }
    
    let message = 'Ваши запросы в технической поддержке:\n\n';
    tickets.forEach((ticket, index) => {
      message += `${index + 1}. #${ticket.id} - ${ticket.description.substring(0, 30)}...\n`;
      message += `   Статус: ${ticket.status}, Приоритет: ${ticket.priority}\n`;
      message += `   Создан: ${new Date(ticket.created_at).toLocaleString()}\n\n`;
    });
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    logger.error(`Error processing /status command: ${error.message}`);
    bot.sendMessage(chatId, 'Произошла ошибка при получении статуса запросов. Попробуйте позже.');
  }
});

// Обработка команды /clear
bot.onText(/\/clear/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  
  try {
    // Получаем пользователя
    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return bot.sendMessage(chatId, 'Вы еще не зарегистрированы в системе.');
    }
    
    // Очищаем историю диалога
    await require('./models/messageModel').clearConversationHistory(user.id);
    
    bot.sendMessage(chatId, 'История диалога очищена. Теперь мы начинаем с чистого листа.');
  } catch (error) {
    logger.error(`Error processing /clear command: ${error.message}`);
    bot.sendMessage(chatId, 'Произошла ошибка при очистке истории диалога. Попробуйте позже.');
  }
});

// Обработка всех сообщений
bot.on('message', async (msg) => {
  // Игнорируем команды, которые уже обрабатываются
  if (msg.text && (
    msg.text.startsWith('/start') || 
    msg.text.startsWith('/help') || 
    msg.text.startsWith('/status') || 
    msg.text.startsWith('/clear')
  )) {
    return;
  }
  
  try {
    await handleMessage(bot, msg);
  } catch (error) {
    logger.error(`Error processing message: ${error.message}`);
    bot.sendMessage(msg.chat.id, 'Извините, произошла ошибка при обработке вашего запроса. Попробуйте позже или свяжитесь с нами другим способом.');
  }
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  logger.error(`Polling error: ${error.message}`);
});

logger.info('Bot started successfully');

module.exports = bot;
