# QXBroker Binary Options Bot

این یک ربات خودکار برای تجارت binary options در QXBroker است که از استراتژی Nison استفاده می‌کند.

## ویژگی‌ها

- جمع‌آوری خودکار داده‌های کندل
- تولید سیگنال‌های معاملاتی بر اساس استراتژی Nison
- ارسال سیگنال‌ها به تلگرام
- اجرای خودکار هر 10 دقیقه
- Health check endpoint برای monitoring

## متغیرهای محیطی مورد نیاز

برای اجرای ربات، متغیرهای زیر را در Railway تنظیم کنید:

- `TELEGRAM_BOT_TOKEN`: توکن ربات تلگرام
- `TELEGRAM_CHAT_ID`: شناسه چت تلگرام
- `LOG_LEVEL`: سطح لاگ (پیش‌فرض: info)

## Deployment روی Railway

1. مخزن را به Railway متصل کنید
2. متغیرهای محیطی را تنظیم کنید
3. Railway به طور خودکار پروژه را deploy می‌کند

## Health Check

ربات یک health check endpoint در `/health` ارائه می‌دهد که وضعیت سرویس را نشان می‌دهد.
