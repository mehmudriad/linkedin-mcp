#!/usr/bin/env node
// Logs into LinkedIn via real browser, saves cookies to disk for MCP server use
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, 'linkedin_cookies.json');
const EMAIL = process.env.LINKEDIN_EMAIL;
const PASSWORD = process.env.LINKEDIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD env vars');
  process.exit(1);
}

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false, // visible so you can solve CAPTCHA if needed
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navigating to LinkedIn login...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });

  await page.type('#username', EMAIL, { delay: 80 });
  await page.type('#password', PASSWORD, { delay: 80 });
  await page.click('[data-litms-control-urn="login-submit"]');

  console.log('Waiting for login... (solve any CAPTCHA in the browser window)');

  // Wait for redirect away from login page (up to 60s for CAPTCHA solving)
  await page.waitForFunction(
    () => !window.location.href.includes('/login') && !window.location.href.includes('/checkpoint'),
    { timeout: 60000 }
  ).catch(() => {
    console.log('Still on login/checkpoint page after 60s. Saving cookies anyway...');
  });

  const cookies = await page.cookies();
  const liAt = cookies.find(c => c.name === 'li_at');
  const jsessionid = cookies.find(c => c.name === 'JSESSIONID');

  if (!liAt) {
    console.error('Login failed — li_at cookie not found. Check credentials.');
    await browser.close();
    process.exit(1);
  }

  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  console.log(`\n✓ Logged in successfully!`);
  console.log(`✓ li_at: ${liAt.value.slice(0, 20)}...`);
  console.log(`✓ JSESSIONID: ${jsessionid?.value}`);
  console.log(`✓ Cookies saved to: ${COOKIES_FILE}`);

  await browser.close();
})();
