import fs from 'fs';
import path from 'path';
import { getSignal, normalizeCandles, getTrend, isBullishEngulfing, isBearishEngulfing } from './index.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

async function readJson(filePath) {
	const data = await fs.promises.readFile(filePath, 'utf8');
	return JSON.parse(data);
}

async function ensureDir(dir) {
	await fs.promises.mkdir(dir, { recursive: true });
}

async function writeJson(filePath, data) {
	await ensureDir(path.dirname(filePath));
	await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
}

function detectBasicSignal(candles5m, candles10m, symbol='EURUSD') {
	const c5 = normalizeCandles(candles5m);
	const c10 = normalizeCandles(candles10m);
	if (c5.length < 3 || c10.length < 3) return null;
	const lastIndex = c5.length - 1;
	const trend10 = getTrend(c10);
	let pattern = null; let direction = null;
	
	if (isBullishEngulfing(c5, lastIndex)) { pattern = 'Bullish Engulfing'; direction = 'CALL'; }
	else if (isBearishEngulfing(c5, lastIndex)) { pattern = 'Bearish Engulfing'; direction = 'PUT'; }
	else { return null; }

	const aligned = (direction === 'CALL' && trend10 === 'bullish') || (direction === 'PUT' && trend10 === 'bearish');
	if (!aligned) return null;

	return {
		symbol,
		direction,
		pattern,
		confirmation: 'Trend alignment',
		time: new Date().toISOString()
	};
}

async function main() {
	console.log('🔍 Starting signal generation...');
	
	const artifactsDir = 'artifacts';
	const dataDir = path.join(artifactsDir, 'data');
	const reportsDir = path.join(artifactsDir, 'reports');
	const signalsPath = path.join(artifactsDir, 'signals.json');

	await ensureDir(artifactsDir); await ensureDir(dataDir); await ensureDir(reportsDir);

	const file5m = path.join(dataDir, 'candles_5m.json');
	const file10m = path.join(dataDir, 'candles_10m.json');

	console.log('📊 Reading candle data...');
	const candles5m = await readJson(file5m);
	const candles10m = await readJson(file10m);
	
	console.log(`5m candles: ${candles5m.length}, 10m candles: ${candles10m.length}`);

	const symbol = process.env.SYMBOL || 'EURUSD';
	const signal = detectBasicSignal(candles5m, candles10m, symbol);
	
	console.log('🎯 Signal detection result:', signal);

	let signals = [];
	try {
		signals = JSON.parse(await fs.promises.readFile(signalsPath, 'utf8'));
		console.log(`📋 Existing signals: ${signals.length}`);
	} catch {
		console.log('📋 No existing signals file, creating new one');
	}

	if (signal) {
		// prevent duplicates by time+pattern
		const dup = signals.find(s => s.time === signal.time && s.pattern === signal.pattern && s.symbol === signal.symbol);
		if (!dup) {
			signals.push(signal);
			await writeJson(signalsPath, signals);
			
			const day = new Date().toISOString().split('T')[0];
			const dailyLog = path.join(reportsDir, `daily_${day}.log`);
			const line = `[${signal.time}] ${signal.symbol} ${signal.direction} ${signal.pattern} | 10m confirmation: Trend alignment\n`;
			await fs.promises.appendFile(dailyLog, line, 'utf8');
			logger.info({ signal }, 'New signal generated and logged');
			console.log('✅ New signal generated and saved!');
		} else {
			logger.info('Duplicate signal skipped');
			console.log('⚠️ Duplicate signal skipped');
		}
	} else {
		logger.info('No valid signal at this time');
		console.log('ℹ️ No valid signal detected at this time');
	}
	
	console.log('✅ Signal generation completed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(err => { console.error(err); process.exit(1); });
}

