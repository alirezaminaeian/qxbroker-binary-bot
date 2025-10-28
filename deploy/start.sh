#!/bin/bash
# Deployment script for QXBroker Binary Options Bot

set -e

echo "🚀 Starting deployment of QXBroker Binary Options Bot..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npx playwright install --with-deps

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p artifacts/screenshots
mkdir -p artifacts/data
mkdir -p artifacts/logs
mkdir -p artifacts/reports

# Check environment variables
echo "🔍 Checking environment variables..."
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "📝 Please edit .env file with your actual credentials"
    else
        echo "❌ .env.example not found. Please create .env file manually."
        exit 1
    fi
fi

# Load environment variables
source .env

# Check required variables
REQUIRED_VARS=("QX_EMAIL" "QX_PASSWORD" "TELEGRAM_TOKEN" "TELEGRAM_CHAT_ID")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set"
        exit 1
    fi
done

echo "✅ All required environment variables are set"

# Run tests
echo "🧪 Running tests..."
npm test

# Test collector (optional)
echo "🔍 Testing collector..."
if npm run collect:screenshot; then
    echo "✅ Collector test passed"
else
    echo "⚠️  Collector test failed - check your QXBroker credentials"
fi

# Install PM2 if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Create PM2 ecosystem file
echo "⚙️  Creating PM2 ecosystem file..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'qxbroker-bot',
    script: 'src/main.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      HEADLESS: 'true'
    },
    error_file: './artifacts/logs/err.log',
    out_file: './artifacts/logs/out.log',
    log_file: './artifacts/logs/combined.log',
    time: true
  }]
};
EOF

echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your actual credentials"
echo "2. Run: pm2 start ecosystem.config.js"
echo "3. Monitor with: pm2 logs qxbroker-bot"
echo "4. Check status with: pm2 status"
echo ""
echo "🔧 Useful commands:"
echo "- pm2 restart qxbroker-bot"
echo "- pm2 stop qxbroker-bot"
echo "- pm2 delete qxbroker-bot"
echo "- pm2 monit"
