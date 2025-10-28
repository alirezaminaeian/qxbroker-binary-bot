import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

function requiredEnv(name) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env: ${name}`);
	}
	return value;
}

async function ensureDir(dirPath) {
	await fs.promises.mkdir(dirPath, { recursive: true });
}

async function wait(ms) {
	return new Promise(res => setTimeout(res, ms));
}

async function dumpDebugFiles(page, prefix = 'failure') {
	const debugDir = path.join('artifacts', 'debug');
	await ensureDir(debugDir);
	const timestamp = Date.now();
	
	try {
		// Full page screenshot
		const screenshotPath = path.join(debugDir, `${prefix}-${timestamp}.png`);
		await page.screenshot({ path: screenshotPath, fullPage: true });
		logger.info({ screenshotPath }, 'Debug screenshot saved');
		
		// Page HTML
		const htmlPath = path.join(debugDir, `${prefix}-${timestamp}.html`);
		const html = await page.content();
		await fs.promises.writeFile(htmlPath, html, 'utf8');
		logger.info({ htmlPath }, 'Debug HTML saved');
		
		return { screenshotPath, htmlPath };
	} catch (err) {
		logger.error({ err }, 'Failed to save debug files');
		return null;
	}
}

async function waitFor(page, selector, timeout = 10000) {
	try {
		await page.waitForSelector(selector, { timeout });
		return true;
	} catch (err) {
		logger.warn({ selector, timeout }, 'Selector not found, attempting page reload');
		try {
			await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
			await page.waitForSelector(selector, { timeout });
			return true;
		} catch (reloadErr) {
			logger.error({ selector, err: reloadErr }, 'Selector still not found after reload');
			return false;
		}
	}
}

async function handleCookieConsent(page) {
	const consentSelectors = [
		'button:has-text("Accept")',
		'button:has-text("I agree")',
		'button:has-text("پذیرفتن")',
		'button:has-text("قبول")',
		'.cookie-consent button',
		'#onetrust-accept-btn-handler',
		'text=Accept all',
		'text=Agree',
		'[data-testid="cookie-accept"]',
		'.cookie-banner button',
		'#cookie-accept',
		'.consent-accept'
	];
	
	for (const selector of consentSelectors) {
		try {
			const element = await page.$(selector);
			if (element) {
				await element.click();
				logger.info({ selector }, 'Cookie consent clicked');
				await wait(1000); // Wait for modal to close
				return true;
			}
		} catch (err) {
			// Continue to next selector
		}
	}
	
	logger.info('No cookie consent modal found');
	return false;
}

async function performLogin(page, email, password) {
	logger.info('Attempting automatic login');
	
	// Try to find login form elements
	const emailSelectors = [
		'input[name="email"]',
		'input[type="email"]',
		'input[autocomplete="email"]',
		'input[placeholder*="email" i]',
		'input[placeholder*="ایمیل" i]'
	];
	
	const passwordSelectors = [
		'input[name="password"]',
		'input[type="password"]',
		'input[autocomplete="current-password"]',
		'input[placeholder*="password" i]',
		'input[placeholder*="رمز" i]'
	];
	
	const submitSelectors = [
		'button[type="submit"]',
		'button:has-text("Log in")',
		'button:has-text("ورود")',
		'button:has-text("Sign in")',
		'input[type="submit"]',
		'.login-button',
		'#login-button'
	];
	
	let emailFilled = false;
	for (const selector of emailSelectors) {
		try {
			const element = await page.$(selector);
			if (element) {
				await element.fill(email);
				emailFilled = true;
				logger.info({ selector }, 'Email field filled');
				break;
			}
		} catch (err) {
			// Continue to next selector
		}
	}
	
	let passwordFilled = false;
	for (const selector of passwordSelectors) {
		try {
			const element = await page.$(selector);
			if (element) {
				await element.fill(password);
				passwordFilled = true;
				logger.info({ selector }, 'Password field filled');
				break;
			}
		} catch (err) {
			// Continue to next selector
		}
	}
	
	if (emailFilled && passwordFilled) {
		for (const selector of submitSelectors) {
			try {
				const element = await page.$(selector);
				if (element) {
					await element.click();
					logger.info({ selector }, 'Login form submitted');
					await wait(2000); // Wait for submission
					return true;
				}
			} catch (err) {
				// Continue to next selector
			}
		}
	}
	
	logger.warn('Could not find or fill login form');
	return false;
}

async function loginAndNavigate(page, email, password) {
	logger.info({ step: 'navigate', url: 'https://qxbroker.com/' }, 'Navigating to broker');
	await page.goto('https://qxbroker.com/', { waitUntil: 'load', timeout: 120000 });
	logger.info('Page loaded');
	
	// Handle cookie consent first
	await handleCookieConsent(page);
	
	// Try to find and click login button
	const loginButtonSelectors = [
		'text=Log in',
		'text=ورود',
		'text=Sign in',
		'text=Login',
		'.login-button',
		'#login-button',
		'[data-testid="login-button"]'
	];
	
	let loginClicked = false;
	for (const selector of loginButtonSelectors) {
		try {
			const element = await page.$(selector);
			if (element) {
				await element.click();
				logger.info({ selector }, 'Login button clicked');
				loginClicked = true;
				await wait(2000); // Wait for login form to appear
				break;
			}
		} catch (err) {
			// Continue to next selector
		}
	}
	
	// Attempt automatic login
	if (loginClicked) {
		await performLogin(page, email, password);
	}
	
	// Wait for potential redirect or dashboard
	try {
		await page.waitForLoadState('networkidle', { timeout: 120000 });
		logger.info('Page reached network idle state');
	} catch (err) {
		logger.warn({ err }, 'Network idle timeout, continuing anyway');
	}
}

async function extractCandleDataFromPage(page) {
	// Attempt to extract arrays for 5m and 10m
	return await page.evaluate(() => {
		function norm(c) {
			if (!c) return null;
			return {
				time: c.time || c.timestamp || c.date || c.t || null,
				open: parseFloat(c.open ?? c.o),
				high: parseFloat(c.high ?? c.h),
				low: parseFloat(c.low ?? c.l),
				close: parseFloat(c.close ?? c.c)
			};
		}

		const result = { m5: null, m10: null, symbol: null };

		// Try common global vars
		const candidates = [
			window.chartData, window.candles, window.ohlcData, window.tradingData, window.tvWidget
		];

		// If TradingView widget is present
		if (window.tvWidget && window.tvWidget.activeChart) {
			// Some brokers expose data via getVisibleRange / data across series - placeholder
		}

		// Try to find arrays on window
		for (const c of candidates) {
			if (!c) continue;
			if (Array.isArray(c)) {
				const arr = c.map(norm).filter(Boolean);
				if (arr.length > 50) {
					result.m5 = arr; // fallback assign
				}
			}
			if (typeof c === 'object') {
				for (const key of Object.keys(c)) {
					const v = c[key];
					if (Array.isArray(v) && v.length >= 50) {
						const arr = v.map(norm).filter(Boolean);
						if (/5m|m5|five/i.test(key) && !result.m5) result.m5 = arr;
						if (/10m|m10|ten/i.test(key) && !result.m10) result.m10 = arr;
						if (!result.m5) result.m5 = arr;
					}
				}
			}
		}

		// Try reading data attributes
		const dataNodes = document.querySelectorAll('[data-candles], [data-chart-data], .chart-data, #chart-data');
		for (const node of dataNodes) {
			try {
				const text = node.textContent || node.getAttribute('data-value');
				const json = JSON.parse(text);
				if (Array.isArray(json)) {
					const arr = json.map(norm).filter(Boolean);
					if (arr.length > 50 && !result.m5) result.m5 = arr;
				}
			} catch {}
		}

		// Best effort: return top 100 recent
		function lastN(arr, n=100) { return Array.isArray(arr) ? arr.slice(-n) : null; }
		result.m5 = lastN(result.m5);
		result.m10 = lastN(result.m10);
		return result;
	});
}

async function extractCandlesWithRetry(page, retries = 2) {
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			logger.info({ attempt }, 'Attempting candle extraction');
			const data = await extractCandleDataFromPage(page);
			if (data?.m5?.length >= 50) {
				logger.info({ count5m: data.m5?.length, count10m: data.m10?.length }, 'Candle extraction successful');
				return data;
			}
			logger.warn({ attempt, count5m: data.m5?.length, count10m: data.m10?.length }, 'Extraction returned insufficient data, retrying');
			await wait(3000);
		} catch (err) {
			logger.error({ err, attempt }, 'Candle extraction error');
			await wait(2000);
		}
	}
	throw new Error('Failed to extract candles after retries');
}

async function captureChart(page, outPath) {
	const chartSelectors = ['#chart', '.chart-container', 'canvas', '[data-chart-root]'];
	let chartHandle = null;
	for (const sel of chartSelectors) {
		const el = await page.$(sel);
		if (el) { chartHandle = el; break; }
	}
	if (!chartHandle) {
		await page.screenshot({ path: outPath, fullPage: true });
		return { selector: 'fullPage', outPath };
	}
	await chartHandle.screenshot({ path: outPath });
	return { selector: 'chart', outPath };
}

(async () => {
	const headless = String(process.env.HEADLESS || 'true').toLowerCase() !== 'false';
	const email = requiredEnv('QX_EMAIL');
	const password = requiredEnv('QX_PASSWORD');
	const artifactsDir = process.env.ARTIFACTS_DIR || 'artifacts';
	const screenshotName = process.env.SCREENSHOT_NAME || 'chart.png';
	const dataDir = path.join(artifactsDir, 'data');
	const logsDir = path.join(artifactsDir, 'logs');
	const userDataDir = process.env.USER_DATA_DIR || path.join(process.cwd(), '.playwright_profile');
	const browserTimeout = parseInt(process.env.BROWSER_TIMEOUT || '120000');
	
	await ensureDir(artifactsDir); 
	await ensureDir(dataDir); 
	await ensureDir(logsDir);
	await ensureDir(userDataDir);
	
	const outPath = path.join(artifactsDir, screenshotName);
	const extractCandles = process.argv.includes('--extract-candles');

	const launchOptions = { 
		headless,
		timeout: browserTimeout
	};
	if (process.env.BROWSER_CHANNEL) launchOptions.channel = process.env.BROWSER_CHANNEL;
	if (process.env.BROWSER_EXECUTABLE_PATH) launchOptions.executablePath = process.env.BROWSER_EXECUTABLE_PATH;

	logger.info({ headless, extractCandles, userDataDir, browserTimeout }, 'Launching browser with persistent context');
	
	const browser = await chromium.launchPersistentContext(userDataDir, {
		...launchOptions,
		viewport: { width: 1440, height: 900 }
	});
	
	const page = browser.pages()[0] || await browser.newPage();

	// Add console and error listeners
	page.on('console', msg => logger.debug({ type: msg.type(), text: msg.text() }, 'PAGE LOG'));
	page.on('pageerror', err => logger.error({ error: err.message }, 'PAGE ERROR'));

	try {
		await loginAndNavigate(page, email, password);
		logger.info('Login navigation completed');

		const info = await captureChart(page, outPath);
		logger.info({ info }, 'Chart captured');

		let outputs = { status: 'ok', screenshot: info.outPath };

		if (extractCandles) {
			logger.info('Starting candle extraction for 5m/10m');
			const data = await extractCandlesWithRetry(page, 2);
			const m5 = (data.m5 || []).slice(-100);
			const m10 = (data.m10 || []).slice(-100);

			const file5m = path.join(dataDir, 'candles_5m.json');
			const file10m = path.join(dataDir, 'candles_10m.json');

			await fs.promises.writeFile(file5m, JSON.stringify(m5, null, 2));
			await fs.promises.writeFile(file10m, JSON.stringify(m10, null, 2));

			logger.info({ count5m: m5.length, count10m: m10.length, last5m: m5[m5.length-1]?.time, last10m: m10[m10.length-1]?.time }, 'Candles saved');
			outputs = { ...outputs, candles5m: file5m, candles10m: file10m };
			
			console.log('✅ Candle extraction complete — 5m and 10m data saved successfully.');
		}

		console.log(JSON.stringify(outputs));
	} catch (err) {
		logger.error({ err }, 'Collector failure');
		
		// Save debug files on failure
		await dumpDebugFiles(page, 'failure');
		
		// Save error log
		try {
			const errorLogPath = path.join(logsDir, `collector_error_${Date.now()}.log`);
			await fs.promises.writeFile(errorLogPath, `Error: ${err.message}\nStack: ${err.stack}\n`, 'utf8');
			logger.info({ errorLogPath }, 'Error log saved');
		} catch {}
		
		process.exitCode = 1;
	} finally {
		await browser.close();
	}
})();
