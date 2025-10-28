// Simple backtest runner
import { runBacktest, saveBacktestResults } from './index.js';

// Generate sample candle data for testing
function generateSampleCandles(count = 200) {
	const candles = [];
	const basePrice = 1.1000;
	const now = new Date();
	
	for (let i = 0; i < count; i++) {
		const time = new Date(now.getTime() - ((count - i) * 5 * 60 * 1000));
		const trend = Math.sin(i / 20) * 0.01; // Simulate trend
		const noise = (Math.random() - 0.5) * 0.005; // Random noise
		
		const open = basePrice + trend + noise;
		const close = open + (Math.random() - 0.5) * 0.003;
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
	
	return candles;
}

async function runSampleBacktest() {
	console.log('🧪 Running sample backtest...');
	
	// Generate sample data
	const candles5m = generateSampleCandles(200);
	const candles10m = generateSampleCandles(100); // Half the frequency
	
	// Run backtest
	const results = runBacktest(candles5m, candles10m, {
		expiryMinutes: 10,
		startIndex: 50,
		endIndex: 150
	});
	
	if (results.error) {
		console.error('❌ Backtest failed:', results.error);
		return;
	}
	
	// Display results
	console.log('\n📊 Backtest Results:');
	console.log('==================');
	console.log(`Total Signals: ${results.summary.totalSignals}`);
	console.log(`Total Trades: ${results.summary.totalTrades}`);
	console.log(`Wins: ${results.summary.wins}`);
	console.log(`Losses: ${results.summary.losses}`);
	console.log(`Win Rate: ${results.summary.winRate}%`);
	console.log(`Avg Price Change: ${results.summary.avgPriceChange}%`);
	console.log(`Max Drawdown: ${results.summary.maxDrawdown}`);
	console.log(`Period: ${results.period.duration}`);
	
	// Save results
	await saveBacktestResults(results, './artifacts');
	
	console.log('\n✅ Backtest completed successfully!');
}

// Run backtest if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runSampleBacktest().catch(error => {
		console.error('❌ Backtest failed:', error.message);
		process.exit(1);
	});
}