const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const pagesToCapture = [
  { name: '01-login', url: 'http://localhost:3000/login' },
  { name: '02-admin-dashboard', url: 'http://localhost:3000/admin/dashboard' },
  { name: '03-student-register', url: 'http://localhost:3000/student/register' },
  { name: '04-admin-timetable', url: 'http://localhost:3000/admin/timetable' },
  { name: '05-student-schedule', url: 'http://localhost:3000/student/schedule' },
  { name: '06-admin-reports', url: 'http://localhost:3000/admin/reports' },
  { name: '07-student-register-validation', url: 'http://localhost:3000/student/register' }
];

async function capture() {
  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  for (const item of pagesToCapture) {
    console.log(`Navigating to ${item.url}...`);
    try {
      await page.goto(item.url, { waitUntil: 'networkidle2', timeout: 15000 });
      // Wait an extra second to let things settle (like flash messages)
      await new Promise(r => setTimeout(r, 1000));
      const outFile = path.join(outDir, `${item.name}.png`);
      await page.screenshot({ path: outFile, fullPage: true });
      console.log(`Saved screenshot: ${outFile}`);
    } catch (err) {
      console.error(`Failed to capture ${item.name}: ${err.message}`);
    }
  }

  await browser.close();
  console.log('Done!');
}

capture().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
