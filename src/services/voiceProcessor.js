// src/services/voiceProcessor.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const OpenAI = require('openai');
const logger = require('../utils/logger');

// Инициализация OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Обработка голосового сообщения
 * @param {Object} bot - Экземпляр Telegram бота
 * @param {Object} msg - Объект сообщения
 * @returns {Promise<string|null>} - Распознанный текст или null
 */
async function handleVoiceMessage(bot, msg) {
  const chatId = msg.chat.id;
  const voiceId = msg.voice.file_id;
  
  try {
    // Получаем файл голосового сообщения
    const fileInfo = await bot.getFile(voiceId);
    const voiceUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${fileInfo.file_path}`;
    
    // Проверяем/создаем директорию для временных файлов
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Скачиваем файл
    const response = await axios({
      method: 'GET',
      url: voiceUrl,
      responseType: 'stream'
    });
    
    const tempFilePath = path.join(tempDir, `${voiceId}.oga`);
    const writer = fs.createWriteStream(tempFilePath);
    
    response.data.pipe(writer);
    
    const fileReady = new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    await fileReady;
    
    // Используем Whisper API для распознавания
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1"
    });
    
    // Удаляем временный файл
    fs.unlinkSync(tempFilePath);
    
    // Возвращаем распознанный текст
    const text = transcription.text;
    if (text.trim()) {
      await bot.sendMessage(chatId, `Ваше сообщение: "${text}"`);
      return text;
    } else {
      await bot.sendMessage(chatId, 'Не удалось распознать текст. Пожалуйста, попробуйте еще раз или отправьте текстовое сообщение.');
      return null;
    }
  } catch (error) {
    logger.error(`Error processing voice message: ${error.message}`);
    await bot.sendMessage(chatId, 'Произошла ошибка при обработке голосового сообщения. Пожалуйста, отправьте текстовое сообщение.');
    return null;
  }
}

module.exports = { handleVoiceMessage };
