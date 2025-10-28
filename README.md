# QXBroker Binary Options Bot (Nison Candlesticks)

این مخزن شامل یک ربات کاملاً خودکار برای تولید سیگنال‌های باینری آپشن ۱۰ دقیقه‌ای بر اساس الگوهای شمعی ژاپنی (کتاب استیو نیسون) است. داده‌ها مستقیماً از چارت زنده کارگزار `qxbroker.com` جمع‌آوری می‌شود (Headless Browser).

## وضعیت
- این اولین کامیت اسکلت پروژه است.
- اسکریپت جمع‌آوری اولیه با Playwright اضافه شده که با اعتبارنامه محیطی وارد می‌شود و از چارت اسکرین‌شات می‌گیرد.

## راه‌اندازی سریع
1) پیش‌نیازها: Node.js 18+
2) نصب:
```bash
npm i
npx playwright install
```
3) متغیرهای محیطی (ایجاد فایل `.env` با مقادیر واقعی):
```bash
cp .env.example .env
# سپس مقادیر واقعی را در .env وارد کنید
```

**متغیرهای ضروری:**
- `QX_EMAIL` - ایمیل حساب QXBroker
- `QX_PASSWORD` - رمز عبور حساب QXBroker  
- `TELEGRAM_TOKEN` - توکن ربات تلگرام
- `TELEGRAM_CHAT_ID` - شناسه چت تلگرام

**متغیرهای اختیاری:**
- `HEADLESS` - حالت مرورگر بدون نمایش (پیش‌فرض: `true`)
- `QX_SYMBOLS` - جفت ارزهای تحت نظارت (پیش‌فرض: EURUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,USDCAD)
- `SCREENSHOT_PATH` - مسیر ذخیره اسکرین‌شات‌ها (پیش‌فرض: `./artifacts/screenshots/`)
- `CANDLE_DATA_PATH` - مسیر ذخیره داده کندل‌ها (پیش‌فرض: `./artifacts/data/`)
- `MIN_CONFIRMATION_FACTORS` - حداقل عوامل تأیید سیگنال (پیش‌فرض: `2`)

4) اجرای کلکتور نمونه (اسکرین‌شات چارت):
```bash
npm run collect:screenshot
```

## ساختار مخزن
```
/README.md
/docs/
/src/
  /collector/
  /strategy/
  /backtest/
  /telegram/
  /tests/
/ci/
/deploy/
/artifacts/
```

## امنیت
- هیچ اعتباری در کد هاردکد نشده است. از متغیرهای محیطی استفاده کنید.
- برای استقرار روی GitHub، Secrets را مطابق README بخش Deployment تنظیم کنید.

## استقرار روی Railway

### مراحل استقرار:

1. **ایجاد پروژه Railway:**
   - وارد Railway.app شوید
   - روی "New Project" کلیک کنید
   - "Deploy from GitHub repo" را انتخاب کنید
   - مخزن `qxbroker-binary-bot` را انتخاب کنید

2. **تنظیم متغیرهای محیطی:**
   ```
   TELEGRAM_TOKEN=8452602898:AAGoVucfJrq8bs_UiiBVSwDwErYjbOYbUDo
   TELEGRAM_CHAT_ID=472112702
   QX_EMAIL=alirezaminaeian213@gmail.com
   QX_PASSWORD=Am09124503581
   HEADLESS=true
   BROWSER_CHANNEL=msedge
   BROWSER_TIMEOUT=180000
   USER_DATA_DIR=/app/.playwright_profile
   SCREENSHOT_PATH=/app/artifacts/screens/
   ```

3. **نصب وابستگی‌ها:**
   Railway به طور خودکار وابستگی‌ها را نصب می‌کند.

4. **اجرای ربات:**
   ربات هر ۱۰ دقیقه یکبار اجرا می‌شود و سیگنال‌ها را ارسال می‌کند.

### مانیتورینگ:
- Health Check: `https://your-app.railway.app/health`
- لاگ‌ها در Railway Dashboard قابل مشاهده است.

## گام‌های بعدی
- استخراج کندل‌های ۵ و ۱۰ دقیقه از DOM چارت و همگام‌سازی.
- پیاده‌سازی الگوهای شمعی نیسون + قوانین تأیید چندعاملی.
- ارسال پیام تلگرام فارسی با تصویر ضمیمه و ضد تکرار.
- تست‌ها، بک‌تست، CI/CD و استقرار.