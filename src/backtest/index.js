// Backtest module for strategy validation
import fs from 'fs';
import path from 'path';
import { getSignal, normalizeCandles } from '../strategy/index.js';

/**
 * Load candle data from JSON file
 */
export async function loadCandleData(filePath) {
	try {
		const data = await fs.promises.readFile(filePath, 'utf8');
		return JSON.parse(data);
	} catch (err) {
		console.error('Error loading candle data:', err.message);
		return null;
	}
}

/**
 * Simulate binary options trade outcome
 * @param {Object} signal - Signal object
 * @param {Array} candles - Candle data for price validation
 * @param {number} expiryMinutes - Expiry time in minutes
 * @returns {Object} Trade result
 */
export function simulateTrade(signal, candles, expiryMinutes = 10) {
	if (!signal || !candles || candles.length === 0) {
		return { result: 'invalid', reason: 'Missing data' };
	}
	
	const normalizedCandles = normalizeCandles(candles);
	const signalTime = new Date(signal.timestamp);
	const expiryTime = new Date(signalTime.getTime() + (expiryMinutes * 60 * 1000));
	
	// Find candle at expiry time
	const expiryCandle = normalizedCandles.find(candle => {
		const candleTime = new Date(candle.time);
		return candleTime >= expiryTime;
	});
	
	if (!expiryCandle) {
		return { result: 'invalid', reason: 'No expiry candle found' };
	}
	
	const entryPrice = signal.price;
	const expiryPrice = expiryCandle.close;
	
	let result;
	if (signal.direction === 'call') {
		result = expiryPrice > entryPrice ? 'win' : 'loss';
	} else if (signal.direction === 'put') {
		result = expiryPrice < entryPrice ? 'win' : 'loss';
	} else {
		result = 'invalid';
	}
	
	return {
		result,
		entryPrice,
		expiryPrice,
		entryTime: signalTime.toISOString(),
		expiryTime: expiryTime.toISOString(),
		priceChange: expiryPrice - entryPrice,
		priceChangePercent: ((expiryPrice - entryPrice) / entryPrice) * 100
	};
}

/**
 * Run backtest on historical data
 * @param {Array} candles5m - 5-minute candles
 * @param {Array} candles10m - 10-minute candles
 * @param {Object} options - Backtest options
 * @returns {Object} Backtest results
 */
export function runBacktest(candles5m, candles10m, options = {}) {
	const {
		expiryMinutes = 10,
		startIndex = 50, // Skip first 50 candles for stability
		endIndex = null
	} = options;
	
	const normalized5m = normalizeCandles(candles5m);
	const normalized10m = normalizeCandles(candles10m);
	
	if (normalized5m.length < startIndex + 10) {
		return { error: 'Insufficient data for backtest' };
	}
	
	const endIdx = endIndex || normalized5m.length - 1;
	const signals = [];
	const trades = [];
	
	// Generate signals for each candle
	for (let i = startIndex; i < endIdx; i++) {
		const signal = getSignal(
			normalized5m.slice(0, i + 1),
			normalized10m.slice(0, Math.floor(i / 2) + 1)
		);
		
		if (signal) {
			signals.push(signal);
			
			// Simulate trade
			const trade = simulateTrade(signal, normalized5m.slice(i), expiryMinutes);
			trades.push({
				...signal,
				trade
			});
		}
	}
	
	// Calculate metrics
	const totalSignals = signals.length;
	const totalTrades = trades.length;
	const wins = trades.filter(t => t.trade.result === 'win').length;
	const losses = trades.filter(t => t.trade.result === 'loss').length;
	const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
	
	// Calculate average price change
	const avgPriceChange = trades.length > 0 
		? trades.reduce((sum, t) => sum + t.trade.priceChangePercent, 0) / trades.length 
		: 0;
	
	// Calculate max drawdown (simplified)
	let maxDrawdown = 0;
	let currentDrawdown = 0;
	let peak = 0;
	
	trades.forEach(trade => {
		if (trade.trade.result === 'win') {
			currentDrawdown = 0;
			peak = Math.max(peak, 1);
		} else if (trade.trade.result === 'loss') {
			currentDrawdown++;
			maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
		}
	});
	
	return {
		summary: {
			totalSignals,
			totalTrades,
			wins,
			losses,
			winRate: Math.round(winRate * 100) / 100,
			avgPriceChange: Math.round(avgPriceChange * 100) / 100,
			maxDrawdown
		},
		signals,
		trades,
		period: {
			start: normalized5m[startIndex]?.time,
			end: normalized5m[endIdx]?.time,
			duration: `${Math.round((endIdx - startIndex) * 5 / 60)} hours`
		}
	};
}

/**
 * Generate backtest report
 * @param {Object} results - Backtest results
 * @returns {string} HTML report
 */
export function generateReport(results) {
	const { summary, period } = results;
	
	return `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>گزارش بک‌تست ربات باینری آپشن</title>
    <style>
        body { font-family: 'Tahoma', sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { text-align: center; color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: #f8f9fa; border-radius: 5px; text-align: center; min-width: 120px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .metric-label { font-size: 14px; color: #666; }
        .win-rate { color: #28a745; }
        .loss-rate { color: #dc3545; }
        .period { margin-top: 20px; padding: 10px; background: #e9ecef; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>گزارش بک‌تست ربات باینری آپشن</h1>
            <p>بر اساس الگوهای شمعی ژاپنی (استیو نیسون)</p>
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
            <div class="metric">
                <div class="metric-value">${summary.totalSignals}</div>
                <div class="metric-label">کل سیگنال‌ها</div>
            </div>
            <div class="metric">
                <div class="metric-value">${summary.totalTrades}</div>
                <div class="metric-label">کل معاملات</div>
            </div>
            <div class="metric">
                <div class="metric-value win-rate">${summary.wins}</div>
                <div class="metric-label">برد</div>
            </div>
            <div class="metric">
                <div class="metric-value loss-rate">${summary.losses}</div>
                <div class="metric-label">باخت</div>
            </div>
            <div class="metric">
                <div class="metric-value win-rate">${summary.winRate}%</div>
                <div class="metric-label">نرخ برد</div>
            </div>
            <div class="metric">
                <div class="metric-value">${summary.avgPriceChange}%</div>
                <div class="metric-label">میانگین تغییر قیمت</div>
            </div>
            <div class="metric">
                <div class="metric-value loss-rate">${summary.maxDrawdown}</div>
                <div class="metric-label">حداکثر افت</div>
            </div>
        </div>
        
        <div class="period">
            <h3>دوره بک‌تست:</h3>
            <p><strong>شروع:</strong> ${period.start}</p>
            <p><strong>پایان:</strong> ${period.end}</p>
            <p><strong>مدت:</strong> ${period.duration}</p>
        </div>
        
        <div style="margin-top: 20px; text-align: center; color: #666;">
            <p>تولید شده در: ${new Date().toLocaleString('fa-IR')}</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Save backtest results to files
 */
export async function saveBacktestResults(results, outputDir = './artifacts') {
	await fs.promises.mkdir(outputDir, { recursive: true });
	
	// Save JSON results
	const jsonPath = path.join(outputDir, 'backtest-results.json');
	await fs.promises.writeFile(jsonPath, JSON.stringify(results, null, 2));
	
	// Save HTML report
	const htmlReport = generateReport(results);
	const htmlPath = path.join(outputDir, 'backtest-report.html');
	await fs.promises.writeFile(htmlPath, htmlReport);
	
	console.log(`Backtest results saved to: ${jsonPath}`);
	console.log(`Backtest report saved to: ${htmlPath}`);
	
	return { jsonPath, htmlPath };
}
