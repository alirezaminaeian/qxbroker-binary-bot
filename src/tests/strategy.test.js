// Unit tests for strategy module
import { 
	isBullish, 
	isBearish, 
	isDoji, 
	isBullishEngulfing, 
	isBearishEngulfing,
	isHammer,
	isShootingStar,
	getSignal,
	normalizeCandles
} from '../strategy/index.js';

// Test data
const testCandles = [
	{ time: '2025-01-01T10:00:00Z', open: 1.1000, high: 1.1050, low: 1.0990, close: 1.1020 },
	{ time: '2025-01-01T10:05:00Z', open: 1.1020, high: 1.1030, low: 1.0980, close: 1.0990 },
	{ time: '2025-01-01T10:10:00Z', open: 1.0990, high: 1.1040, low: 1.0980, close: 1.1030 }
];

const bullishCandle = { open: 1.1000, high: 1.1050, low: 1.0990, close: 1.1020 };
const bearishCandle = { open: 1.1020, high: 1.1030, low: 1.0980, close: 1.0990 };
const dojiCandle = { open: 1.1000, high: 1.1005, low: 1.0995, close: 1.1000 };

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

// Test bullish candle detection
runTest('isBullish - bullish candle', () => isBullish(bullishCandle));
runTest('isBullish - bearish candle', () => !isBullish(bearishCandle));

// Test bearish candle detection
runTest('isBearish - bearish candle', () => isBearish(bearishCandle));
runTest('isBearish - bullish candle', () => !isBearish(bullishCandle));

// Test doji detection
runTest('isDoji - doji candle', () => isDoji(dojiCandle));
runTest('isDoji - normal candle', () => !isDoji(bullishCandle));

// Test engulfing patterns
const engulfingCandles = [
	{ open: 1.1020, high: 1.1030, low: 1.0980, close: 1.0990 }, // bearish
	{ open: 1.0980, high: 1.1040, low: 1.0970, close: 1.1030 }  // bullish engulfing
];

runTest('isBullishEngulfing', () => isBullishEngulfing(engulfingCandles, 1));

// Test hammer pattern
const hammerCandle = { open: 1.1000, high: 1.1005, low: 1.0950, close: 1.1002 };
runTest('isHammer', () => isHammer(hammerCandle));

// Test shooting star pattern
const shootingStarCandle = { open: 1.1000, high: 1.1050, low: 1.0995, close: 1.1002 };
runTest('isShootingStar', () => isShootingStar(shootingStarCandle));

// Test normalize candles
runTest('normalizeCandles', () => {
	const normalized = normalizeCandles(testCandles);
	return normalized.length === 3 && 
		   typeof normalized[0].time === 'string' &&
		   typeof normalized[0].open === 'number';
});

// Test signal generation
runTest('getSignal - insufficient data', () => {
	const signal = getSignal([], []);
	return signal === null;
});

runTest('getSignal - valid data', () => {
	const signal = getSignal(testCandles, testCandles);
	return signal === null || (typeof signal === 'object' && signal.direction);
});

console.log('\n📊 Strategy tests completed');
