// src/server.js
require('dotenv').config();
const logger = require('./utils/logger');

logger.info('Starting the application...');

// Запуск бота
require('./bot');

// Запуск админ-бота, если задан токен
if (process.env.ADMIN_BOT_TOKEN) {
  require('./adminBot');
} else {
  logger.warn('Admin bot not started: ADMIN_BOT_TOKEN is not set');
}

logger.info('Server started successfully');

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
});

// Обработка необработанных отклонений обещаний
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);
});
