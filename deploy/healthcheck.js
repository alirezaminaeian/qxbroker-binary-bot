// Health check script for monitoring bot status
import fs from 'fs';
import path from 'path';
import { sendTelegramMessage } from '../src/telegram/sender.js';

const HEALTH_CHECK_INTERVAL = 60000; // 1 minute
const MAX_LOG_AGE = 300000; // 5 minutes
const ARTIFACTS_DIR = './artifacts';

class HealthChecker {
	constructor() {
		this.lastSignalTime = null;
		this.lastErrorTime = null;
		this.isRunning = true;
	}

	async checkLogFiles() {
		const logDir = path.join(ARTIFACTS_DIR, 'logs');
		
		try {
			const files = await fs.promises.readdir(logDir);
			const now = Date.now();
			
			for (const file of files) {
				const filePath = path.join(logDir, file);
				const stats = await fs.promises.stat(filePath);
				const age = now - stats.mtime.getTime();
				
				// Check for recent errors
				if (file.includes('err') && age < MAX_LOG_AGE) {
					const content = await fs.promises.readFile(filePath, 'utf8');
					if (content.includes('ERROR') || content.includes('Error')) {
						this.lastErrorTime = stats.mtime;
						return {
							status: 'error',
							message: `Recent error found in ${file}`,
							timestamp: stats.mtime.toISOString()
						};
					}
				}
			}
			
			return { status: 'ok', message: 'No recent errors found' };
		} catch (err) {
			return { status: 'error', message: `Log check failed: ${err.message}` };
		}
	}

	async checkDataFiles() {
		const dataDir = path.join(ARTIFACTS_DIR, 'data');
		
		try {
			const files = await fs.promises.readdir(dataDir);
			const now = Date.now();
			let latestDataTime = null;
			
			for (const file of files) {
				if (file.endsWith('.json')) {
					const filePath = path.join(dataDir, file);
					const stats = await fs.promises.stat(filePath);
					const age = now - stats.mtime.getTime();
					
					if (age < MAX_LOG_AGE) {
						latestDataTime = stats.mtime;
					}
				}
			}
			
			if (!latestDataTime) {
				return {
					status: 'warning',
					message: 'No recent data files found',
					timestamp: new Date().toISOString()
				};
			}
			
			return {
				status: 'ok',
				message: 'Recent data files found',
				timestamp: latestDataTime.toISOString()
			};
		} catch (err) {
			return { status: 'error', message: `Data check failed: ${err.message}` };
		}
	}

	async checkScreenshots() {
		const screenshotsDir = path.join(ARTIFACTS_DIR, 'screenshots');
		
		try {
			const files = await fs.promises.readdir(screenshotsDir);
			const now = Date.now();
			let latestScreenshotTime = null;
			
			for (const file of files) {
				if (file.endsWith('.png') || file.endsWith('.jpg')) {
					const filePath = path.join(screenshotsDir, file);
					const stats = await fs.promises.stat(filePath);
					const age = now - stats.mtime.getTime();
					
					if (age < MAX_LOG_AGE) {
						latestScreenshotTime = stats.mtime;
					}
				}
			}
			
			if (!latestScreenshotTime) {
				return {
					status: 'warning',
					message: 'No recent screenshots found',
					timestamp: new Date().toISOString()
				};
			}
			
			return {
				status: 'ok',
				message: 'Recent screenshots found',
				timestamp: latestScreenshotTime.toISOString()
			};
		} catch (err) {
			return { status: 'error', message: `Screenshot check failed: ${err.message}` };
		}
	}

	async performHealthCheck() {
		console.log(`🔍 Performing health check at ${new Date().toISOString()}`);
		
		const checks = await Promise.all([
			this.checkLogFiles(),
			this.checkDataFiles(),
			this.checkScreenshots()
		]);
		
		const logCheck = checks[0];
		const dataCheck = checks[1];
		const screenshotCheck = checks[2];
		
		const overallStatus = checks.some(c => c.status === 'error') ? 'error' :
							checks.some(c => c.status === 'warning') ? 'warning' : 'ok';
		
		const report = {
			timestamp: new Date().toISOString(),
			overallStatus,
			checks: {
				logs: logCheck,
				data: dataCheck,
				screenshots: screenshotCheck
			}
		};
		
		// Save health check report
		const reportPath = path.join(ARTIFACTS_DIR, 'health-check.json');
		await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
		
		// Send alert if there's an error
		if (overallStatus === 'error') {
			const alertMessage = `🚨 هشدار سلامت ربات
وضعیت: خطا
زمان: ${report.timestamp}

جزئیات:
- لاگ‌ها: ${logCheck.message}
- داده‌ها: ${dataCheck.message}
- اسکرین‌شات‌ها: ${screenshotCheck.message}

لطفاً وضعیت ربات را بررسی کنید.`;
			
			try {
				await sendTelegramMessage({ text: alertMessage });
				console.log('📱 Health alert sent to Telegram');
			} catch (err) {
				console.error('Failed to send health alert:', err.message);
			}
		}
		
		console.log(`✅ Health check completed. Status: ${overallStatus}`);
		return report;
	}

	start() {
		console.log('🏥 Starting health check service...');
		
		// Perform initial check
		this.performHealthCheck();
		
		// Set up interval
		setInterval(() => {
			this.performHealthCheck();
		}, HEALTH_CHECK_INTERVAL);
		
		console.log(`⏰ Health checks will run every ${HEALTH_CHECK_INTERVAL / 1000} seconds`);
	}

	stop() {
		console.log('🛑 Stopping health check service...');
		this.isRunning = false;
	}
}

// Run health checker if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const healthChecker = new HealthChecker();
	healthChecker.start();
	
	// Handle graceful shutdown
	process.on('SIGINT', () => {
		healthChecker.stop();
		process.exit(0);
	});
	
	process.on('SIGTERM', () => {
		healthChecker.stop();
		process.exit(0);
	});
}

export default HealthChecker;
