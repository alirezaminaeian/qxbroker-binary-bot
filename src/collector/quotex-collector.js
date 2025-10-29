import puppeteer from 'puppeteer';
import fs from 'fs';

async function collectCandles() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    
    // STEP 1: LOGIN
    await page.goto('https://qxbroker.com/en/login');
    await page.type('input[name="email"]', process.env.QX_EMAIL);
    await page.type('input[name="password"]', process.env.QX_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 30000 });
    
    // STEP 2: GO TO TRADE
    await page.goto('https://qxbroker.com/en/trade');
    await page.waitForSelector('.chart-container', { timeout: 30000 });
    
    // STEP 3: SELECT PAIR (EURUSD first)
    try {
        await page.select('.pair-selector', 'EURUSD');
        await page.waitForTimeout(3000);
    } catch {}
    
    // STEP 4: EXTRACT 50 CANDLES
    const candles = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.candle, .bar')).slice(-50).map(el => ({
            time: el.dataset.time || Date.now(),
            open: parseFloat(el.dataset.open),
            high: parseFloat(el.dataset.high),
            low: parseFloat(el.dataset.low),
            close: parseFloat(el.dataset.close)
        }));
    });
    
    // STEP 5: SCREENSHOT
    await page.screenshot({ path: 'artifacts/chart.png' });
    
    await browser.close();
    console.log(`COLLECTED: ${candles.length} candles`);
    return { candles, screenshot: 'artifacts/chart.png' };
}

export default collectCandles;

if (import.meta.url === `file://${process.argv[1]}`) {
    collectCandles().catch(err => { console.error(err); process.exit(1); });
}


