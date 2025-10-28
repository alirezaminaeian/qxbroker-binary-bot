import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

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

async function loginAndNavigate(page, email, password) {
	await page.goto('https://qxbroker.com/', { waitUntil: 'load', timeout: 120000 });
	// Heuristics-based login selectors; may need updates depending on broker DOM changes
	// Try to click login/open auth modal
	try { await page.click('text=Log in', { timeout: 5000 }); } catch {}
	try { await page.click('text=ورود', { timeout: 5000 }); } catch {}

	// Fill email/password if form exists
	const emailSelectors = ['input[type="email"]', 'input[name="email"]', 'input[autocomplete="email"]'];
	const passSelectors = ['input[type="password"]', 'input[name="password"]'];
	let emailFilled = false;
	for (const sel of emailSelectors) {
		const el = await page.$(sel);
		if (el) { await el.fill(email); emailFilled = true; break; }
	}
	let passFilled = false;
	for (const sel of passSelectors) {
		const el = await page.$(sel);
		if (el) { await el.fill(password); passFilled = true; break; }
	}
	if (emailFilled && passFilled) {
		// Submit
		const submitSelectors = ['button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("ورود")'];
		for (const ss of submitSelectors) {
			const btn = await page.$(ss);
			if (btn) { await btn.click(); break; }
		}
	}

	// Wait for potential redirect/dashboard
	await page.waitForLoadState('networkidle', { timeout: 120000 });
}

async function extractCandleData(page) {
	// Extract candle data from chart DOM - this is a placeholder implementation
	// Real implementation would depend on QXBroker's specific chart library
	try {
		// Try to find chart data in various common locations
		const chartDataSelectors = [
			'[data-candles]',
			'[data-chart-data]',
			'.chart-data',
			'#chart-data'
		];
		
		for (const selector of chartDataSelectors) {
			const element = await page.$(selector);
			if (element) {
				const data = await element.evaluate(el => {
					// Try to extract JSON data or parse chart data
					const text = el.textContent || el.getAttribute('data-value');
					try {
						return JSON.parse(text);
					} catch {
						return null;
					}
				});
				if (data) return data;
			}
		}
		
		// Fallback: try to extract from window object
		const windowData = await page.evaluate(() => {
			// Look for common chart data variables
			const possibleVars = ['chartData', 'candles', 'ohlcData', 'tradingData'];
			for (const varName of possibleVars) {
				if (window[varName]) {
					return window[varName];
				}
			}
			return null;
		});
		
		return windowData;
	} catch (err) {
		console.warn('Could not extract candle data:', err.message);
		return null;
	}
}

async function captureChart(page, outPath) {
	// Try to locate a chart container (heuristics). Adjust as needed after first run.
	const chartSelectors = [
		'#chart',
		'.chart-container',
		'canvas',
		'[data-chart-root]'
	];
	let chartHandle = null;
	for (const sel of chartSelectors) {
		const el = await page.$(sel);
		if (el) { chartHandle = el; break; }
	}
	if (!chartHandle) {
		// fallback to full page screenshot
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
	await ensureDir(artifactsDir);
	const outPath = path.join(artifactsDir, screenshotName);

	const browser = await chromium.launch({ headless });
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();

	try {
		await loginAndNavigate(page, email, password);
		const info = await captureChart(page, outPath);
		
		// Extract candle data
		const candleData = await extractCandleData(page);
		const candleDataPath = path.join(artifactsDir, 'candles.json');
		if (candleData) {
			await fs.promises.writeFile(candleDataPath, JSON.stringify(candleData, null, 2));
			console.log(JSON.stringify({ status: 'ok', ...info, candleData: candleDataPath }));
		} else {
			console.log(JSON.stringify({ status: 'ok', ...info, candleData: null }));
		}
	} catch (err) {
		console.error('Collector error:', err);
		process.exitCode = 1;
	} finally {
		await context.close();
		await browser.close();
	}
})();
