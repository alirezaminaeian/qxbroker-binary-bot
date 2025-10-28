// Unit tests for Telegram sender
import { sendTelegramMessage } from '../telegram/sender.js';

// Mock Telegram bot for testing
const mockBot = {
	sendPhoto: jest.fn().mockResolvedValue({ message_id: 123 }),
	sendMessage: jest.fn().mockResolvedValue({ message_id: 124 })
};

// Mock node-telegram-bot-api
jest.mock('node-telegram-bot-api', () => {
	return jest.fn().mockImplementation(() => mockBot);
});

// Test functions
function runTest(testName, testFn) {
	try {
		const result = testFn();
		console.log(`✅ ${testName}: ${result ? 'PASS' : 'FAIL'}`);
		return result;
	} catch (error) {
		console.log(`❌ ${testName}: ERROR - ${error.message}`);
		return false;
	}
}

// Test environment variables
runTest('Environment variables check', () => {
	const token = process.env.TELEGRAM_TOKEN;
	const chatId = process.env.TELEGRAM_CHAT_ID;
	return !!(token && chatId);
});

// Test message sending without photo
runTest('Send message without photo', async () => {
	try {
		await sendTelegramMessage({ 
			text: 'Test message from bot' 
		});
		return mockBot.sendMessage.mock.calls.length > 0;
	} catch (error) {
		return false;
	}
});

// Test message sending with photo
runTest('Send message with photo', async () => {
	try {
		await sendTelegramMessage({ 
			text: 'Test message with photo',
			photoPath: './test-image.png'
		});
		return mockBot.sendPhoto.mock.calls.length > 0;
	} catch (error) {
		return false;
	}
});

// Test error handling
runTest('Error handling - missing credentials', async () => {
	const originalToken = process.env.TELEGRAM_TOKEN;
	const originalChatId = process.env.TELEGRAM_CHAT_ID;
	
	delete process.env.TELEGRAM_TOKEN;
	delete process.env.TELEGRAM_CHAT_ID;
	
	try {
		await sendTelegramMessage({ text: 'Test' });
		return false; // Should throw error
	} catch (error) {
		return error.message.includes('Missing');
	} finally {
		process.env.TELEGRAM_TOKEN = originalToken;
		process.env.TELEGRAM_CHAT_ID = originalChatId;
	}
});

console.log('\n📱 Telegram sender tests completed');
