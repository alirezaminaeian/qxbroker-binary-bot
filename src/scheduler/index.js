// Scheduler for automated bot execution
import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import pino from 'pino';
import TelegramBot from 'node-telegram-bot-api';

const execAsync = promisify(exec);
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

class BotScheduler {
	constructor() {
		this.isRunning = false;
		this.interval = 10 * 60 * 1000; // 10 minutes
		this.lastRun = null;
	}

	async runCollectionCycle() {
		if (this.isRunning) {
			logger.warn('Previous cycle still running, skipping');
			return;
		}

		this.isRunning = true;
		const startTime = new Date();
		
		try {
			logger.info('Starting collection cycle...');
			
			// Step 1: Collect candle data
			logger.info('Step 1: Collecting candle data...');
			try {
				const { stdout: collectOutput } = await execAsync('npm run collect:candles');
				logger.info({ output: collectOutput }, 'Candle collection completed');
			} catch (err) {
				logger.error({ err: err.message }, 'Candle collection failed');
				// Continue anyway with existing data
			}

			// Step 2: Generate signals
			logger.info('Step 2: Generating signals...');
			try {
				const { stdout: signalOutput } = await execAsync('npm run signals:generate');
				logger.info({ output: signalOutput }, 'Signal generation completed');
			} catch (err) {
				logger.error({ err: err.message }, 'Signal generation failed');
			}

			// Step 3: Send signals to Telegram
			logger.info('Step 3: Sending signals to Telegram...');
			try {
				const { stdout: telegramOutput } = await execAsync('npm run signals:send');
				logger.info({ output: telegramOutput }, 'Telegram sending completed');
			} catch (err) {
				logger.error({ err: err.message }, 'Telegram sending failed');
			}

			const duration = Date.now() - startTime.getTime();
			logger.info({ duration }, 'Collection cycle completed successfully');
			
		} catch (err) {
			logger.error({ err }, 'Collection cycle failed');
		} finally {
			this.isRunning = false;
			this.lastRun = new Date();
		}
	}

	start() {
		logger.info({ interval: this.interval }, 'Starting bot scheduler...');
		
		// Run immediately on start
		this.runCollectionCycle();
		
		// Set up interval
		setInterval(() => {
			this.runCollectionCycle();
		}, this.interval);
		
		logger.info('Bot scheduler started successfully');

		// Send startup test message to Telegram
		(async () => {
			try {
				const token = process.env.TELEGRAM_TOKEN;
				const chatId = process.env.TELEGRAM_CHAT_ID;
				if (!token || !chatId) throw new Error('Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID');
				const bot = new TelegramBot(token, { polling: false });
				await bot.sendMessage(chatId, `🚀 [TEST] Bot started at ${new Date().toLocaleString('fa-IR')}`);
				console.log('TEST MESSAGE SENT TO TELEGRAM');
			} catch (err) {
				console.error('TEST MESSAGE FAILED:', err.message);
			}
		})();
	}

	stop() {
		logger.info('Stopping bot scheduler...');
		this.isRunning = false;
	}
}

// Health check endpoint for Railway
async function createHealthCheck(schedulerInstance) {
	const express = await import('express');
	const app = express.default();
	const port = process.env.PORT || 3000;

	app.get('/health', (req, res) => {
		res.json({
			status: 'ok',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			lastRun: schedulerInstance ? schedulerInstance.lastRun : null
		});
	});

	app.get('/', (req, res) => {
		res.json({
			service: 'QXBroker Binary Options Bot',
			status: 'running',
			timestamp: new Date().toISOString()
		});
	});

	app.listen(port, () => {
		logger.info({ port }, 'Health check server started');
	});
}

// Main function
async function main() {
	// Start the scheduler
	const scheduler = new BotScheduler();

	// Handle graceful shutdown
	process.on('SIGINT', () => {
		logger.info('Received SIGINT, shutting down gracefully...');
		scheduler.stop();
		process.exit(0);
	});

	process.on('SIGTERM', () => {
		logger.info('Received SIGTERM, shutting down gracefully...');
		scheduler.stop();
		process.exit(0);
	});

	// Start health check server
	await createHealthCheck(scheduler);

	// Start the scheduler
	scheduler.start();

	// Delayed runtime env check for Nixpacks
	setTimeout(() => {
		console.log('RUNTIME ENV VARS:', {
			TELEGRAM_TOKEN: !!process.env.TELEGRAM_TOKEN,
			TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID,
			QX_EMAIL: !!process.env.QX_EMAIL
		});
	}, 5000);
}

// Start the application
main().catch(err => {
	logger.error({ err }, 'Failed to start application');
	process.exit(1);
});

export default BotScheduler;
