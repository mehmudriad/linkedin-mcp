#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// fetch_profiles.js — Fresh login + profile fetcher (Attempt 2 variant)
//
// Unlike scrape_profiles.js which reuses saved cookies, this script
// logs in fresh every time. More reliable if saved cookies have expired,
// but slower since it goes through the full login flow each run.
//
// HOW TO RUN:
//   LINKEDIN_EMAIL="your@email.com" LINKEDIN_PASSWORD="yourpassword" node fetch_profiles.js
//
// HOW TO CONFIGURE TARGETS:
//   Edit the TARGETS array below. The slug is the last segment of a LinkedIn URL.
//   Example: linkedin.com/in/williamhgates → slug is 'williamhgates'
//
// OUTPUT:
//   Console: Featured section links for each profile
//   /tmp/profile_<slug>.png — screenshot of the visible part of each profile page
// ─────────────────────────────────────────────────────────────

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Read credentials from environment — never hardcode these
const EMAIL = process.env.LINKEDIN_EMAIL;
const PASSWORD = process.env.LINKEDIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD env vars');
  process.exit(1);
}

// ── CONFIGURE YOUR TARGETS HERE ───────────────────────────────
// Add or remove objects in this array.
// name: display label used in console output (can be anything)
// slug: the LinkedIn URL slug for that person
const TARGETS = [
  { name: 'Example Person 1', slug: 'williamhgates' },
  { name: 'Example Person 2', slug: 'satya-nadella' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: false,   // Visible browser — allows CAPTCHA solving if LinkedIn challenges you
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',  // Hides Puppeteer's automation flag from detection
    ],
  });

  const page = await browser.newPage();

  // Set a real browser user agent — reduces bot detection risk
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  // ── Step 1: Log in ────────────────────────────────────────
  console.log('Logging in...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#username', { timeout: 15000 });
  await page.type('#username', EMAIL, { delay: 80 });
  await page.type('#password', PASSWORD, { delay: 80 });
  await page.click('[data-litms-control-urn="login-submit"]');

  // Wait up to 60 seconds for the login redirect
  await page.waitForFunction(
    () => !window.location.href.includes('/login'),
    { timeout: 60000 }
  ).catch(() => console.log('Still on login page after 60s'));

  // ── Step 2: Handle challenge/CAPTCHA if triggered ─────────
  // LinkedIn sometimes redirects to a verification page after login.
  // If that happens, solve it manually in the browser window, then
  // press Enter in this terminal to continue.
  const url = page.url();
  if (url.includes('checkpoint') || url.includes('challenge')) {
    console.log('CHALLENGE detected — solve it in the browser, then press Enter here');
    await new Promise(r => process.stdin.once('data', r));
  }
  console.log('Logged in. URL:', page.url());

  // ── Step 3: Visit each target profile ────────────────────
  for (const target of TARGETS) {
    console.log(`\n=== ${target.name} ===`);
    await page.goto(`https://www.linkedin.com/in/${target.slug}/`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for dynamic sections (posts, Featured) to render after initial load
    await new Promise(r => setTimeout(r, 3000));

    // Extract links from the Featured section using in-browser JavaScript
    // section.artdeco-card is the LinkedIn card component class
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

    // Save screenshot (visible area only, not full page) to /tmp/
    const screenshotPath = `/tmp/profile_${target.slug}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('Screenshot:', screenshotPath);

    // Pause between profiles — reduces chance of rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();
})();
