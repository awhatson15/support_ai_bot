// src/adminBot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { getAllFaqs, addFaq, updateFaq, deleteFaq } = require('./models/faqModel');
const { getTickets, updateTicketStatus, getTicketById } = require('./models/ticketModel');
const { getAllUsers, updateUserBlockStatus } = require('./models/userModel');
const logger = require('./utils/logger');

// Получаем токен бота и список админов
const token = process.env.ADMIN_BOT_TOKEN;
if (!token) {
  logger.error('ADMIN_BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

const ADMINS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean);
if (ADMINS.length === 0) {
  logger.warn('No admin IDs specified in ADMIN_IDS');
}

const adminBot = new TelegramBot(token, { polling: true });

// Объект для хранения состояний админов
const adminStates = {};

// Проверка на админа
function isAdmin(userId) {
  return ADMINS.includes(userId);
}

// Обработка команды /start
adminBot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) {
    return adminBot.sendMessage(chatId, 'У вас нет доступа к административной панели.');
  }
  
  adminBot.sendMessage(chatId, 
    'Добро пожаловать в панель администратора!\n\n' +
    'Доступные команды:\n' +
    '/faq - управление базой знаний\n' +
    '/tickets - просмотр и управление тикетами\n' +
    '/users - управление пользователями\n' +
    '/stats - просмотр статистики использования\n'
  );
});

// Управление FAQ
adminBot.onText(/\/faq/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return;
  
  const faqs = await getAllFaqs();
  
  let message = 'База знаний FAQ:\n\n';
  if (faqs.length === 0) {
    message = 'База знаний пуста. Добавьте вопросы и ответы командой /addfaq.';
  } else {
    faqs.forEach((faq, index) => {
      message += `${index + 1}. ${faq.question} [ID: ${faq.id}]\n`;
    });
    message += '\nДля просмотра ответа используйте /viewfaq [ID]\n';
    message += 'Для добавления нового FAQ используйте /addfaq\n';
    message += 'Для удаления FAQ используйте /delfaq [ID]';
  }
  
  adminBot.sendMessage(chatId, message);
});

// Просмотр FAQ
adminBot.onText(/\/viewfaq (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return;
  
  const faqId = match[1];
  const faqs = await getAllFaqs();
  const faq = faqs.find(f => f.id == faqId);
  
  if (!faq) {
    return adminBot.sendMessage(chatId, `FAQ с ID ${faqId} не найден.`);
  }
  
  let message = `FAQ #${faq.id}\n\n`;
  message += `Вопрос: ${faq.question}\n\n`;
  message += `Ответ: ${faq.answer}\n\n`;
  message += `Категория: ${faq.category}\n`;
  message += `Ключевые слова: ${faq.keywords || 'не указаны'}\n`;
  
  adminBot.sendMessage(chatId, message);
});

// Добавление FAQ - шаг 1
adminBot.onText(/\/addfaq/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAdmin(userId)) return;
  
  adminStates[userId] = { action: 'adding_faq', step: 1 };
  
  adminBot.sendMessage(chatId, 
    'Для добавления FAQ отправьте сообщение в формате:\n\n' +
    'Вопрос: [текст вопроса]\n' +
    'Ответ: [текст ответа]\n' +
    'Категория: [категория]\n' +
    'Ключевые слова: [слово1, слово2, ...]'
  );
});

// Удаление FAQ
adminBot.onText(/\/delfaq (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return;
  
  const faqId = match[1];
  
  try {
    const result = await deleteFaq(faqId);
    if (result) {
      adminBot.sendMessage(chatId, `FAQ с ID ${faqId} успешно удален.`);
    } else {
      adminBot.sendMessage(chatId, `FAQ с ID ${faqId} не найден.`);
    }
  } catch (error) {
    logger.error(`Error deleting FAQ: ${error.message}`);
    adminBot.sendMessage(chatId, `Ошибка при удалении FAQ: ${error.message}`);
  }
});

// Управление тикетами
adminBot.onText(/\/tickets/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return;
  
  try {
    const tickets = await getTickets();
    
    if (!tickets.length) {
      return adminBot.sendMessage(chatId, 'В системе нет тикетов.');
    }
    
    let message = 'Список тикетов:\n\n';
    tickets.slice(0, 10).forEach(ticket => {
      message += `#${ticket.id} от ${ticket.first_name || ticket.username || 'пользователя'}\n`;
      message += `Статус: ${ticket.status}, Приоритет: ${ticket.priority}\n`;
      message += `Тип: ${ticket.issue_type}\n`;
      message += `Описание: ${ticket.description.substring(0, 50)}...\n\n`;
    });
    
    if (tickets.length > 10) {
      message += `\nПоказано 10 из ${tickets.length} тикетов. Используйте /ticket [ID] для просмотра деталей.`;
    } else {
      message += '\nИспользуйте /ticket [ID] для просмотра деталей.';
    }
    
    adminBot.sendMessage(chatId, message);
  } catch (error) {
    logger.error(`Error getting tickets: ${error.message}`);
    adminBot.sendMessage(chatId, `Ошибка при получении тикетов: ${error.message}`);
  }
});

// Просмотр тикета
adminBot.onText(/\/ticket (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return;
  
  const ticketId = match[1];
  
  try {
    const ticket = await getTicketById(ticketId);
    
    if (!ticket) {
      return adminBot.sendMessage(chatId, `Тикет с ID ${ticketId} не найден.`);
    }
    
    let message = `Тикет #${ticket.id}\n\n`;
    message += `Статус: ${ticket.status}\n`;
    message += `Приоритет: ${ticket.priority}\n`;
    message += `Тип: ${ticket.issue_type}\n\n`;
    message += `Описание:\n${ticket.description}\n\n`;
    message += `Создан: ${new Date(ticket.created_at).toLocaleString()}\n`;
    message += `Обновлен: ${new Date(ticket.updated_at).toLocaleString()}\n\n`;
    message += 'Для изменения статуса используйте команды:\n';
    message += `/ticket_inprogress ${ticket.id} - взять в работу\n`;
    message += `/ticket_solved ${ticket.id} - отметить как решенный\n`;
    message += `/ticket_closed ${ticket.id} - закрыть тикет`;
    
    adminBot.sendMessage(chatId, message);
  } catch (error) {
    logger.error(`Error getting ticket: ${error.message}`);
    adminBot.sendMessage(chatId, `Ошибка при получении тикета: ${error.message}`);
  }
});

// Изменение статуса тикета - в работе
adminBot.onText(/\/ticket_inprogress (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return;
  
  const ticketId = match[1];
  
  try {
    const ticket = await updateTicketStatus(ticketId, 'В работе');
    adminBot.sendMessage(chatId, `Тикет #${ticketId} обновлен. Новый статус: В работе`);
  } catch (error) {
    logger.error(`Error updating ticket status: ${error.message}`);
    adminBot.sendMessage(chatId, `Ошибка при обновлении статуса тикета: ${error.message}`);
  }
});

// Изменение статуса тикета - решен
adminBot.onText(/\/ticket_solved (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return;
  
  const ticketId = match[1];
  
  try {
    const ticket = await updateTicketStatus(ticketId, 'Решен');
    adminBot.sendMessage(chatId, `Тикет #${ticketId} обновлен. Новый статус: Решен`);
  } catch (error) {
    logger.error(`Error updating ticket status: ${error.message}`);
    adminBot.sendMessage(chatId, `Ошибка при обновлении статуса тикета: ${error.message}`);
  }
});
adminBot.onText(/\/ticket_closed (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return;
  
  const ticketId = match[1];
  
  try {
    const ticket = await updateTicketStatus(ticketId, 'Закрыт');
    adminBot.sendMessage(chatId, `Тикет #${ticketId} обновлен. Новый статус: Закрыт`);
  } catch (error) {
    logger.error(`Error updating ticket status: ${error.message}`);
    adminBot.sendMessage(chatId, `Ошибка при обновлении статуса тикета: ${error.message}`);
  }
});

// Управление пользователями
adminBot.onText(/\/users/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return;
  
  try {
    const users = await getAllUsers();
    
    if (!users.length) {
      return adminBot.sendMessage(chatId, 'В системе нет зарегистрированных пользователей.');
    }
    
    let message = 'Список пользователей:\n\n';
    users.slice(0, 15).forEach(user => {
      message += `ID: ${user.id} | Telegram: ${user.telegram_id} | `;
      message += `${user.first_name || ''} ${user.last_name || ''} ${user.username ? `(@${user.username})` : ''}\n`;
      message += `Запросов: ${user.request_count} | Блокировка: ${user.is_blocked ? 'Да' : 'Нет'}\n\n`;
    });
    
    if (users.length > 15) {
      message += `\nПоказано 15 из ${users.length} пользователей.`;
    }
    
    message += '\nКоманды:\n';
    message += '/block [ID] - заблокировать пользователя\n';
    message += '/unblock [ID] - разблокировать пользователя';
    
    adminBot.sendMessage(chatId, message);
  } catch (error) {
    logger.error(`Error getting users: ${error.message}`);
    adminBot.sendMessage(chatId, `Ошибка при получении списка пользователей: ${error.message}`);
  }
});

// Блокировка пользователя
adminBot.onText(/\/block (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return;
  
  const userId = match[1];
  
  try {
    await updateUserBlockStatus(userId, true);
    adminBot.sendMessage(chatId, `Пользователь с ID ${userId} заблокирован.`);
  } catch (error) {
    logger.error(`Error blocking user: ${error.message}`);
    adminBot.sendMessage(chatId, `Ошибка при блокировке пользователя: ${error.message}`);
  }
});

// Разблокировка пользователя
adminBot.onText(/\/unblock (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return;
  
  const userId = match[1];
  
  try {
    await updateUserBlockStatus(userId, false);
    adminBot.sendMessage(chatId, `Пользователь с ID ${userId} разблокирован.`);
  } catch (error) {
    logger.error(`Error unblocking user: ${error.message}`);
    adminBot.sendMessage(chatId, `Ошибка при разблокировке пользователя: ${error.message}`);
  }
});

// Просмотр статистики
adminBot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return;
  
  try {
    // Получаем статистику
    const users = await getAllUsers();
    const tickets = await getTickets();
    const faqs = await getAllFaqs();
    
    // Считаем количество запросов
    const totalRequests = users.reduce((sum, user) => sum + user.request_count, 0);
    
    // Считаем тикеты по статусам
    const ticketStats = {
      'Новый': 0,
      'В работе': 0,
      'Решен': 0,
      'Закрыт': 0
    };
    
    tickets.forEach(ticket => {
      if (ticketStats[ticket.status] !== undefined) {
        ticketStats[ticket.status]++;
      }
    });
    
    let message = '📊 Статистика системы 📊\n\n';
    message += `👥 Всего пользователей: ${users.length}\n`;
    message += `💬 Всего запросов: ${totalRequests}\n`;
    message += `🎫 Всего тикетов: ${tickets.length}\n`;
    message += `📝 Всего FAQ: ${faqs.length}\n\n`;
    
    message += '🎫 Статистика тикетов:\n';
    message += `Новые: ${ticketStats['Новый']}\n`;
    message += `В работе: ${ticketStats['В работе']}\n`;
    message += `Решенные: ${ticketStats['Решен']}\n`;
    message += `Закрытые: ${ticketStats['Закрыт']}\n\n`;
    
    message += '📆 Сейчас: ' + new Date().toLocaleString();
    
    adminBot.sendMessage(chatId, message);
  } catch (error) {
    logger.error(`Error getting stats: ${error.message}`);
    adminBot.sendMessage(chatId, `Ошибка при получении статистики: ${error.message}`);
  }
});

// Обработка добавления FAQ
adminBot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Проверка на админа и наличие действия
  if (!isAdmin(userId) || !adminStates[userId] || !msg.text || msg.text.startsWith('/')) {
    return;
  }
  
  // Обработка добавления FAQ
  if (adminStates[userId].action === 'adding_faq' && adminStates[userId].step === 1) {
    try {
      // Парсим сообщение
      const lines = msg.text.split('\n');
      const faqData = {};
      
      for (const line of lines) {
        if (line.startsWith('Вопрос:')) {
          faqData.question = line.replace('Вопрос:', '').trim();
        } else if (line.startsWith('Ответ:')) {
          faqData.answer = line.replace('Ответ:', '').trim();
        } else if (line.startsWith('Категория:')) {
          faqData.category = line.replace('Категория:', '').trim();
        } else if (line.startsWith('Ключевые слова:')) {
          faqData.keywords = line.replace('Ключевые слова:', '').trim();
        }
      }
      
      // Проверяем наличие всех необходимых полей
      if (!faqData.question || !faqData.answer) {
        adminBot.sendMessage(chatId, 'Необходимо указать как минимум вопрос и ответ. Попробуйте еще раз.');
        return;
      }
      
      // Добавляем FAQ
      const newFaq = await addFaq(faqData);
      
      adminBot.sendMessage(chatId, 
        `FAQ успешно добавлен! ID: ${newFaq.id}\n\n` +
        `Вопрос: ${newFaq.question}\n\n` +
        `Ответ: ${newFaq.answer}\n\n` +
        `Категория: ${newFaq.category || 'Не указана'}\n` +
        `Ключевые слова: ${newFaq.keywords || 'Не указаны'}`
      );
      
      // Очищаем состояние
      delete adminStates[userId];
    } catch (error) {
      logger.error(`Error adding FAQ: ${error.message}`);
      adminBot.sendMessage(chatId, `Ошибка при добавлении FAQ: ${error.message}`);
      delete adminStates[userId];
    }
  }
});

// Обработка ошибок
adminBot.on('polling_error', (error) => {
  logger.error(`Admin bot polling error: ${error.message}`);
});

logger.info('Admin bot started successfully');

module.exports = adminBot;
