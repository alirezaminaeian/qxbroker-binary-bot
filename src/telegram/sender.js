import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

export async function sendTelegramMessage({ text, photoPath }) {
	const token = process.env.TELEGRAM_TOKEN;
	const chatId = process.env.TELEGRAM_CHAT_ID;
	if (!token || !chatId) throw new Error('Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID');
	const bot = new TelegramBot(token, { polling: false });
	if (photoPath) {
		await bot.sendPhoto(chatId, photoPath, { caption: text, parse_mode: 'HTML' });
	} else {
		await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
	}
}
