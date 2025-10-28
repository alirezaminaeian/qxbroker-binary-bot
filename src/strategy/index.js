// Strategy module based on Steve Nison's Japanese Candlestick Patterns
// This implements basic pattern detection for binary options signals

/**
 * Normalize candle data to standard format
 * @param {Array} rawCandles - Raw candle data from broker
 * @returns {Array} Normalized candles with {time, open, high, low, close}
 */
export function normalizeCandles(rawCandles) {
	if (!Array.isArray(rawCandles)) return [];
	
	return rawCandles.map(candle => {
		// Handle different possible formats
		if (typeof candle === 'object') {
			return {
				time: candle.time || candle.timestamp || candle.date,
				open: parseFloat(candle.open || candle.o),
				high: parseFloat(candle.high || candle.h),
				low: parseFloat(candle.low || candle.l),
				close: parseFloat(candle.close || candle.c)
			};
		}
		return null;
	}).filter(Boolean);
}

/**
 * Check if candle is bullish (close > open)
 */
export function isBullish(candle) {
	return candle.close > candle.open;
}

/**
 * Check if candle is bearish (close < open)
 */
export function isBearish(candle) {
	return candle.close < candle.open;
}

/**
 * Check if candle is doji (open ≈ close)
 */
export function isDoji(candle, threshold = 0.001) {
	const bodySize = Math.abs(candle.close - candle.open);
	const candleRange = candle.high - candle.low;
	return bodySize <= (candleRange * threshold);
}

/**
 * Check for Bullish Engulfing pattern
 * Requires: previous candle bearish, current candle bullish and engulfs previous
 */
export function isBullishEngulfing(candles, index) {
	if (index < 1) return false;
	const prev = candles[index - 1];
	const curr = candles[index];
	
	return isBearish(prev) && 
		   isBullish(curr) && 
		   curr.open < prev.close && 
		   curr.close > prev.open;
}

/**
 * Check for Bearish Engulfing pattern
 * Requires: previous candle bullish, current candle bearish and engulfs previous
 */
export function isBearishEngulfing(candles, index) {
	if (index < 1) return false;
	const prev = candles[index - 1];
	const curr = candles[index];
	
	return isBullish(prev) && 
		   isBearish(curr) && 
		   curr.open > prev.close && 
		   curr.close < prev.open;
}

/**
 * Check for Hammer pattern (reversal signal)
 * Requires: small body at top, long lower shadow, little/no upper shadow
 */
export function isHammer(candle) {
	const bodySize = Math.abs(candle.close - candle.open);
	const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
	const upperShadow = candle.high - Math.max(candle.open, candle.close);
	const totalRange = candle.high - candle.low;
	
	return bodySize <= (totalRange * 0.3) && 
		   lowerShadow >= (totalRange * 0.6) && 
		   upperShadow <= (totalRange * 0.1);
}

/**
 * Check for Shooting Star pattern (reversal signal)
 * Requires: small body at bottom, long upper shadow, little/no lower shadow
 */
export function isShootingStar(candle) {
	const bodySize = Math.abs(candle.close - candle.open);
	const upperShadow = candle.high - Math.max(candle.open, candle.close);
	const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
	const totalRange = candle.high - candle.low;
	
	return bodySize <= (totalRange * 0.3) && 
		   upperShadow >= (totalRange * 0.6) && 
		   lowerShadow <= (totalRange * 0.1);
}

/**
 * Check for Morning Star pattern (3-candle bullish reversal)
 */
export function isMorningStar(candles, index) {
	if (index < 2) return false;
	const first = candles[index - 2];
	const second = candles[index - 1];
	const third = candles[index];
	
	// First candle: bearish
	// Second candle: small body (doji or small)
	// Third candle: bullish and closes above first candle's midpoint
	const firstMidpoint = (first.open + first.close) / 2;
	
	return isBearish(first) && 
		   (isDoji(second) || Math.abs(second.close - second.open) < (second.high - second.low) * 0.3) &&
		   isBullish(third) && 
		   third.close > firstMidpoint;
}

/**
 * Check for Evening Star pattern (3-candle bearish reversal)
 */
export function isEveningStar(candles, index) {
	if (index < 2) return false;
	const first = candles[index - 2];
	const second = candles[index - 1];
	const third = candles[index];
	
	// First candle: bullish
	// Second candle: small body (doji or small)
	// Third candle: bearish and closes below first candle's midpoint
	const firstMidpoint = (first.open + first.close) / 2;
	
	return isBullish(first) && 
		   (isDoji(second) || Math.abs(second.close - second.open) < (second.high - second.low) * 0.3) &&
		   isBearish(third) && 
		   third.close < firstMidpoint;
}

/**
 * Get trend direction based on moving average
 */
export function getTrend(candles, period = 20) {
	if (candles.length < period) return 'neutral';
	
	const recent = candles.slice(-period);
	const avg = recent.reduce((sum, c) => sum + c.close, 0) / period;
	const current = candles[candles.length - 1].close;
	
	if (current > avg * 1.001) return 'bullish';
	if (current < avg * 0.999) return 'bearish';
	return 'neutral';
}

/**
 * Main signal generation function
 * @param {Array} candles5m - 5-minute candles
 * @param {Array} candles10m - 10-minute candles
 * @returns {Object|null} Signal object or null
 */
export function getSignal(candles5m, candles10m) {
	if (!candles5m || !candles10m || candles5m.length < 3 || candles10m.length < 3) {
		return null;
	}
	
	const normalized5m = normalizeCandles(candles5m);
	const normalized10m = normalizeCandles(candles10m);
	
	// Get trend from 10m timeframe
	const trend10m = getTrend(normalized10m);
	
	// Check patterns on 5m timeframe
	const lastIndex = normalized5m.length - 1;
	let detectedPattern = null;
	let direction = null;
	
	// Check for bullish patterns
	if (isBullishEngulfing(normalized5m, lastIndex)) {
		detectedPattern = 'Bullish Engulfing';
		direction = 'call';
	} else if (isHammer(normalized5m[lastIndex])) {
		detectedPattern = 'Hammer';
		direction = 'call';
	} else if (isMorningStar(normalized5m, lastIndex)) {
		detectedPattern = 'Morning Star';
		direction = 'call';
	}
	// Check for bearish patterns
	else if (isBearishEngulfing(normalized5m, lastIndex)) {
		detectedPattern = 'Bearish Engulfing';
		direction = 'put';
	} else if (isShootingStar(normalized5m[lastIndex])) {
		detectedPattern = 'Shooting Star';
		direction = 'put';
	} else if (isEveningStar(normalized5m, lastIndex)) {
		detectedPattern = 'Evening Star';
		direction = 'put';
	}
	
	// Require trend alignment as confirmation
	if (detectedPattern && direction) {
		const trendAligned = (direction === 'call' && trend10m === 'bullish') || 
							(direction === 'put' && trend10m === 'bearish');
		
		if (trendAligned) {
			return {
				symbol: 'EURUSD', // Default, should be passed as parameter
				direction,
				pattern: detectedPattern,
				confirmation: {
					trend10m,
					pattern5m: detectedPattern,
					factors: ['trend_alignment']
				},
				timestamp: new Date().toISOString(),
				price: normalized5m[lastIndex].close
			};
		}
	}
	
	return null;
}
