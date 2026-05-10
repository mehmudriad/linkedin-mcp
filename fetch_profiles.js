#!/usr/bin/env node
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const EMAIL = process.env.LINKEDIN_EMAIL;
const PASSWORD = process.env.LINKEDIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD env vars');
  process.exit(1);
}

const TARGETS = [
  { name: 'Muhammad Bilal', slug: 'bilal54' },
  { name: 'Jacob Goodstein', slug: 'jacob-goodstein-6b8b37229' },
  { name: 'Belinda Gerz', slug: 'belinda-gerz' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  // Login
  console.log('Logging in...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#username', { timeout: 15000 });
  await page.type('#username', EMAIL, { delay: 80 });
  await page.type('#password', PASSWORD, { delay: 80 });
  await page.click('[data-litms-control-urn="login-submit"]');
  await page.waitForFunction(
    () => !window.location.href.includes('/login'),
    { timeout: 60000 }
  ).catch(() => console.log('Still on login page after 60s'));

  const url = page.url();
  if (url.includes('checkpoint') || url.includes('challenge')) {
    console.log('CHALLENGE detected — solve it in the browser, then press Enter here');
    await new Promise(r => process.stdin.once('data', r));
  }
  console.log('Logged in. URL:', page.url());

  // Visit each profile
  for (const target of TARGETS) {
    console.log(`\n=== ${target.name} ===`);
    await page.goto(`https://www.linkedin.com/in/${target.slug}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Extract Featured section links
    const featured = await page.evaluate(() => {
      const results = [];
      const sections = document.querySelectorAll('section.artdeco-card');
      for (const sec of sections) {
        const h2 = sec.querySelector('h2');
        if (h2 && h2.innerText.toLowerCase().includes('featured')) {
          const links = sec.querySelectorAll('a[href]');
          links.forEach(a => results.push({ text: a.innerText.trim().slice(0, 100), href: a.href }));
        }
      }
      return results;
    });

    if (featured.length === 0) {
      console.log('No Featured section');
    } else {
      console.log('Featured:');
      featured.forEach(f => console.log(' -', f.text, '->', f.href));
    }

    const screenshotPath = `/tmp/profile_${target.slug}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('Screenshot:', screenshotPath);

    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();
})();
