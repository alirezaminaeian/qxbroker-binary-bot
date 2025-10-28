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

## گام‌های بعدی
- استخراج کندل‌های ۵ و ۱۰ دقیقه از DOM چارت و همگام‌سازی.
- پیاده‌سازی الگوهای شمعی نیسون + قوانین تأیید چندعاملی.
- ارسال پیام تلگرام فارسی با تصویر ضمیمه و ضد تکرار.
- تست‌ها، بک‌تست، CI/CD و استقرار.