// Simple test for backtest module
import { runBacktest } from './index.js';

console.log('🧪 Testing backtest module...');

// Generate simple test data
const candles = [];
for (let i = 0; i < 50; i++) {
	candles.push({
		time: new Date(Date.now() - (50-i) * 5 * 60000).toISOString(),
		open: 1.1000 + i * 0.0001,
		high: 1.1005 + i * 0.0001,
		low: 0.9995 + i * 0.0001,
		close: 1.1002 + i * 0.0001
	});
}

const results = runBacktest(candles, candles, { startIndex: 10, endIndex: 40 });
console.log('📊 Results:', results.summary);
