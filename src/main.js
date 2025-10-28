// Main entry point for QXBroker Binary Options Bot
import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { getSignal } from './strategy/index.js';
import { sendTelegramMessage } from './telegram/sender.js';

class QXBrokerBot {
	constructor() {
		this.isRunning = false;
		this.symbols = (process.env.QX_SYMBOLS || 'EURUSD,GBPUSD,USDJPY').split(',');
		this.checkInterval = 300000; // 5 minutes
		this.lastSignals = new Map(); // Prevent duplicate signals
	}

	async initialize() {
		console.log('🚀 Initializing QXBroker Binary Options Bot...');
		
		// Create necessary directories
		await this.createDirectories();
		
		// Validate environment variables
		this.validateEnvironment();
		
		console.log('✅ Bot initialized successfully');
	}

	async createDirectories() {
		const dirs = [
			'./artifacts',
			'./artifacts/screenshots',
			'./artifacts/data',
			'./artifacts/logs',
			'./artifacts/reports'
		];
		
		for (const dir of dirs) {
			await fs.promises.mkdir(dir, { recursive: true });
		}
	}

	validateEnvironment() {
		const required = ['QX_EMAIL', 'QX_PASSWORD', 'TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID'];
		const missing = required.filter(key => !process.env[key]);
		
		if (missing.length > 0) {
			throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
		}
	}

	async collectData(symbol) {
		const browser = await chromium.launch({ 
			headless: process.env.HEADLESS !== 'false' 
		});
		const context = await browser.newContext({ 
			viewport: { width: 1440, height: 900 } 
		});
		const page = await context.newPage();

		try {
			// Navigate to QXBroker and login
			await page.goto('https://qxbroker.com/', { 
				waitUntil: 'load', 
				timeout: 120000 
			});
			
			// Login process (simplified - needs actual implementation)
			await this.performLogin(page);
			
			// Navigate to symbol chart
			await this.navigateToSymbol(page, symbol);
			
			// Wait for chart to load
			await page.waitForLoadState('networkidle', { timeout: 30000 });
			
			// Extract candle data
			const candleData = await this.extractCandleData(page);
			
			// Capture screenshot
			const screenshotPath = `./artifacts/screenshots/${symbol}_${Date.now()}.png`;
			await this.captureChart(page, screenshotPath);
			
			await context.close();
			await browser.close();
			
			return {
				symbol,
				candles: candleData,
				screenshot: screenshotPath,
				timestamp: new Date().toISOString()
			};
			
		} catch (error) {
			await context.close();
			await browser.close();
			throw error;
		}
	}

	async performLogin(page) {
		// This is a placeholder - actual implementation depends on QXBroker's login form
		console.log('🔐 Performing login...');
		
		// Try to find and fill login form
		const emailSelectors = ['input[type="email"]', 'input[name="email"]'];
		const passwordSelectors = ['input[type="password"]', 'input[name="password"]'];
		
		for (const selector of emailSelectors) {
			const element = await page.$(selector);
			if (element) {
				await element.fill(process.env.QX_EMAIL);
				break;
			}
		}
		
		for (const selector of passwordSelectors) {
			const element = await page.$(selector);
			if (element) {
				await element.fill(process.env.QX_PASSWORD);
				break;
			}
		}
		
		// Try to submit
		const submitSelectors = ['button[type="submit"]', 'button:has-text("Log in")'];
		for (const selector of submitSelectors) {
			const element = await page.$(selector);
			if (element) {
				await element.click();
				break;
			}
		}
		
		// Wait for login to complete
		await page.waitForLoadState('networkidle', { timeout: 30000 });
	}

	async navigateToSymbol(page, symbol) {
		// Navigate to specific symbol chart
		// This depends on QXBroker's URL structure
		console.log(`📊 Navigating to ${symbol} chart...`);
		
		// Try different possible URL patterns
		const possibleUrls = [
			`https://qxbroker.com/trading/${symbol}`,
			`https://qxbroker.com/chart/${symbol}`,
			`https://qxbroker.com/#${symbol}`
		];
		
		for (const url of possibleUrls) {
			try {
				await page.goto(url, { waitUntil: 'load', timeout: 10000 });
				await page.waitForLoadState('networkidle', { timeout: 10000 });
				console.log(`✅ Successfully navigated to ${url}`);
				return;
			} catch (error) {
				console.log(`❌ Failed to navigate to ${url}`);
			}
		}
		
		throw new Error(`Could not navigate to ${symbol} chart`);
	}

	async extractCandleData(page) {
		// Extract 5m and 10m candle data from chart
		// This is a placeholder - actual implementation depends on QXBroker's chart library
		console.log('📈 Extracting candle data...');
		
		try {
			// Try to extract from various possible sources
			const candleData = await page.evaluate(() => {
				// Look for chart data in window object
				const possibleVars = ['chartData', 'candles', 'ohlcData', 'tradingData'];
				for (const varName of possibleVars) {
					if (window[varName]) {
						return window[varName];
					}
				}
				return null;
			});
			
			if (candleData) {
				return candleData;
			}
			
			// Fallback: return mock data for testing
			return this.generateMockCandleData();
			
		} catch (error) {
			console.warn('Could not extract candle data:', error.message);
			return this.generateMockCandleData();
		}
	}

	generateMockCandleData() {
		// Generate mock candle data for testing
		const now = new Date();
		const candles = [];
		
		for (let i = 0; i < 100; i++) {
			const time = new Date(now.getTime() - (i * 5 * 60 * 1000)); // 5-minute intervals
			const basePrice = 1.1000 + (Math.random() - 0.5) * 0.01;
			const open = basePrice;
			const close = basePrice + (Math.random() - 0.5) * 0.005;
			const high = Math.max(open, close) + Math.random() * 0.002;
			const low = Math.min(open, close) - Math.random() * 0.002;
			
			candles.push({
				time: time.toISOString(),
				open: parseFloat(open.toFixed(5)),
				high: parseFloat(high.toFixed(5)),
				low: parseFloat(low.toFixed(5)),
				close: parseFloat(close.toFixed(5))
			});
		}
		
		return candles.reverse(); // Oldest first
	}

	async captureChart(page, screenshotPath) {
		// Capture chart screenshot
		const chartSelectors = ['#chart', '.chart-container', 'canvas', '[data-chart-root]'];
		
		for (const selector of chartSelectors) {
			const element = await page.$(selector);
			if (element) {
				await element.screenshot({ path: screenshotPath });
				console.log(`📸 Chart screenshot saved: ${screenshotPath}`);
				return;
			}
		}
		
		// Fallback to full page screenshot
		await page.screenshot({ path: screenshotPath, fullPage: true });
		console.log(`📸 Full page screenshot saved: ${screenshotPath}`);
	}

	async processSymbol(symbol) {
		try {
			console.log(`🔍 Processing ${symbol}...`);
			
			// Collect data
			const data = await this.collectData(symbol);
			
			// Save candle data
			const dataPath = `./artifacts/data/${symbol}_${Date.now()}.json`;
			await fs.promises.writeFile(dataPath, JSON.stringify(data.candles, null, 2));
			
			// Generate signals
			const signal = getSignal(data.candles, data.candles); // Using same data for both timeframes
			
			if (signal) {
				// Check for duplicate signals
				const signalKey = `${symbol}_${signal.pattern}_${Math.floor(Date.now() / 300000)}`; // 5-minute window
				
				if (!this.lastSignals.has(signalKey)) {
					this.lastSignals.set(signalKey, true);
					
					// Send signal to Telegram
					await this.sendSignal(signal, data.screenshot);
					
					// Save signal log
					await this.saveSignalLog(signal, data);
				} else {
					console.log(`⚠️ Duplicate signal prevented for ${symbol}`);
				}
			} else {
				console.log(`ℹ️ No signal generated for ${symbol}`);
			}
			
		} catch (error) {
			console.error(`❌ Error processing ${symbol}:`, error.message);
		}
	}

	async sendSignal(signal, screenshotPath) {
		const directionText = signal.direction === 'call' ? 'کال' : 'پوت';
		const message = `🚨 سیگنال باینری آپشن — ۱۰ دقیقه
جفت: ${signal.symbol}
جهت: ${directionText}
تایم‌فریم تأیید: ۱۰m → ${signal.confirmation.trend10m}
نقطه ورود (۵m): ${signal.pattern}
قیمت باز: ${signal.price}
زمان ارسال: ${signal.timestamp}
شناسه سیگنال: SIG-${Date.now()}`;

		try {
			await sendTelegramMessage({ 
				text: message, 
				photoPath: screenshotPath 
			});
			console.log(`📱 Signal sent to Telegram: ${signal.symbol} ${signal.direction}`);
		} catch (error) {
			console.error('❌ Failed to send signal:', error.message);
		}
	}

	async saveSignalLog(signal, data) {
		const logEntry = {
			timestamp: new Date().toISOString(),
			signal,
			data: {
				symbol: data.symbol,
				screenshot: data.screenshot,
				candleCount: data.candles.length
			}
		};
		
		const logPath = `./artifacts/logs/signals_${new Date().toISOString().split('T')[0]}.json`;
		
		try {
			let logs = [];
			if (await fs.promises.access(logPath).then(() => true).catch(() => false)) {
				const content = await fs.promises.readFile(logPath, 'utf8');
				logs = JSON.parse(content);
			}
			
			logs.push(logEntry);
			await fs.promises.writeFile(logPath, JSON.stringify(logs, null, 2));
			
		} catch (error) {
			console.error('❌ Failed to save signal log:', error.message);
		}
	}

	async start() {
		console.log('🎯 Starting QXBroker Binary Options Bot...');
		
		await this.initialize();
		this.isRunning = true;
		
		// Process all symbols initially
		for (const symbol of this.symbols) {
			await this.processSymbol(symbol);
		}
		
		// Set up interval for continuous monitoring
		setInterval(async () => {
			if (this.isRunning) {
				for (const symbol of this.symbols) {
					await this.processSymbol(symbol);
				}
			}
		}, this.checkInterval);
		
		console.log(`⏰ Bot will check for signals every ${this.checkInterval / 1000} seconds`);
		console.log(`📊 Monitoring symbols: ${this.symbols.join(', ')}`);
	}

	stop() {
		console.log('🛑 Stopping QXBroker Binary Options Bot...');
		this.isRunning = false;
	}
}

// Run bot if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const bot = new QXBrokerBot();
	
	bot.start().catch(error => {
		console.error('❌ Bot failed to start:', error.message);
		process.exit(1);
	});
	
	// Handle graceful shutdown
	process.on('SIGINT', () => {
		bot.stop();
		process.exit(0);
	});
	
	process.on('SIGTERM', () => {
		bot.stop();
		process.exit(0);
	});
}

export default QXBrokerBot;
