import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { sendTelegramMessage } from './sender.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

async function ensureDir(dir) { await fs.promises.mkdir(dir, { recursive: true }); }

async function main() {
	console.log('📱 Starting Telegram signal sending...');
	
	const artifactsDir = 'artifacts';
	const signalsPath = path.join(artifactsDir, 'signals.json');
	const cachePath = path.join(artifactsDir, 'signals_sent.json');
	const screenshotPath = path.join(artifactsDir, 'chart.png');
	await ensureDir(artifactsDir);

	let signals = [];
	try { 
		signals = JSON.parse(await fs.promises.readFile(signalsPath, 'utf8')); 
		console.log(`📋 Found ${signals.length} signals in file`);
	} catch {
		console.log('📋 No signals file found');
	}
	
	let sent = [];
	try { 
		sent = JSON.parse(await fs.promises.readFile(cachePath, 'utf8')); 
		console.log(`📤 Previously sent: ${sent.length} signals`);
	} catch {
		console.log('📤 No sent cache found, creating new one');
	}

	const sentKeys = new Set(sent.map(s => `${s.symbol}_${s.pattern}_${s.time}`));
	const newSignals = signals.filter(s => !sentKeys.has(`${s.symbol}_${s.pattern}_${s.time}`));
	
	console.log(`🆕 New signals to send: ${newSignals.length}`);

	for (const sig of newSignals) {
		const directionFa = sig.direction === 'CALL' ? 'کال' : 'پوت';
		const text = `🚨 سیگنال باینری آپشن — 10 دقیقه\nجفت: ${sig.symbol}\nجهت: ${directionFa}\nتایم‌فریم تأیید: 10m → همسو با روند\nنقطه ورود (5m): ${sig.pattern}\nزمان ارسال: ${sig.time}\nشناسه سیگنال: SIG-${Date.now()}\n`;
		
		console.log('📤 Sending signal:', sig.symbol, sig.direction);
		
		try {
			const hasShot = await fs.promises.access(screenshotPath).then(() => true).catch(() => false);
			console.log('📸 Screenshot available:', hasShot);
			
			await sendTelegramMessage({ text, photoPath: hasShot ? screenshotPath : undefined });
			sent.push(sig);
			logger.info({ sig }, 'Signal sent to Telegram');
			console.log('✅ Signal sent successfully!');
		} catch (err) {
			logger.error({ err }, 'Failed to send signal');
			console.error('❌ Failed to send signal:', err.message);
		}
	}

	await fs.promises.writeFile(cachePath, JSON.stringify(sent, null, 2));
	console.log('✅ Telegram sending completed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(err => { console.error(err); process.exit(1); });
}

