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
  await page.screenshot({ path: '/tmp/li_login_page.png' });

  await page.waitForSelector('#username', { timeout: 30000 });
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

  // If FETCH_PROFILES env var is set, visit profiles and extract Featured sections
  // Set FETCH_PROFILES to a comma-separated list of LinkedIn slugs, e.g.:
  //   FETCH_PROFILES=williamhgates,satya-nadella node login.js
  if (process.env.FETCH_PROFILES) {
    const slugs = process.env.FETCH_PROFILES.split(',').map(s => s.trim()).filter(Boolean);
    const targets = slugs.map(slug => ({ name: slug, slug }));

    for (const target of targets) {
      console.log(`\n=== ${target.name} ===`);
      await page.goto(`https://www.linkedin.com/in/${target.slug}/`, { waitUntil: 'load', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      console.log('URL:', page.url());

      const featured = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('section').forEach(sec => {
          const h2 = sec.querySelector('h2');
          if (h2 && h2.innerText.toLowerCase().includes('featured')) {
            sec.querySelectorAll('a[href]').forEach(a => {
              if (a.href && !a.href.includes('linkedin.com/in/')) {
                results.push({ text: a.innerText.trim().slice(0, 100), href: a.href });
              }
            });
          }
        });
        return results;
      });

      if (featured.length === 0) {
        console.log('No Featured section found');
      } else {
        console.log('Featured:');
        featured.forEach(f => console.log(' -', f.text, '->', f.href));
      }

      const screenshotPath = `/tmp/li_${target.slug}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('Screenshot:', screenshotPath);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  await browser.close();
})();
