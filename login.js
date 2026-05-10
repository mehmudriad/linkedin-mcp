#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// login.js — Browser login + optional profile fetcher (Attempt 2)
//
// Opens a real Chrome window, logs into LinkedIn, and saves the
// session cookies to linkedin_cookies.json so other scripts can
// reuse them without logging in again.
//
// WHY A REAL BROWSER:
//   LinkedIn blocks headless/automated login attempts aggressively.
//   Using a visible browser lets you solve CAPTCHAs manually if needed.
//
// HOW TO RUN:
//   LINKEDIN_EMAIL="your@email.com" LINKEDIN_PASSWORD="yourpassword" node login.js
//
// OPTIONAL — visit profiles after login and extract Featured section links:
//   FETCH_PROFILES=slug1,slug2,slug3 LINKEDIN_EMAIL="..." LINKEDIN_PASSWORD="..." node login.js
//   (slug = the last part of a LinkedIn URL, e.g. linkedin.com/in/williamhgates → williamhgates)
//
// OUTPUT:
//   linkedin_cookies.json — saved in the same folder. DO NOT commit this file.
//   /tmp/li_login_page.png — screenshot taken right after loading the login page
//   /tmp/li_<slug>.png — full-page screenshot of each visited profile (if FETCH_PROFILES set)
// ─────────────────────────────────────────────────────────────

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Where to save the session cookies after login
const COOKIES_FILE = path.join(__dirname, 'linkedin_cookies.json');

// Read credentials from environment — never hardcode these
const EMAIL = process.env.LINKEDIN_EMAIL;
const PASSWORD = process.env.LINKEDIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD env vars');
  process.exit(1);
}

(async () => {
  console.log('Launching browser...');

  const browser = await puppeteer.launch({
    headless: false,                          // Keep browser visible so you can solve CAPTCHAs
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // ── Step 1: Load the login page ───────────────────────────
  console.log('Navigating to LinkedIn login...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });

  // Screenshot right after load — useful to debug if the page didn't render correctly
  await page.screenshot({ path: '/tmp/li_login_page.png' });

  // ── Step 2: Fill in credentials and submit ────────────────
  // Wait up to 30 seconds for the email field to appear
  await page.waitForSelector('#username', { timeout: 30000 });
  await page.type('#username', EMAIL, { delay: 80 });   // delay: 80ms simulates human typing speed
  await page.type('#password', PASSWORD, { delay: 80 });
  await page.click('[data-litms-control-urn="login-submit"]');

  console.log('Waiting for login... (solve any CAPTCHA in the browser window)');

  // ── Step 3: Wait for redirect away from login/checkpoint ──
  // Give up to 60 seconds — enough time to solve a CAPTCHA manually in the browser window
  await page.waitForFunction(
    () => !window.location.href.includes('/login') && !window.location.href.includes('/checkpoint'),
    { timeout: 60000 }
  ).catch(() => {
    // Not an error — cookies are still saved even if we timeout
    console.log('Still on login/checkpoint page after 60s. Saving cookies anyway...');
  });

  // ── Step 4: Extract and save session cookies ──────────────
  const cookies = await page.cookies();

  // li_at is the main session token — if it's missing, login failed
  const liAt = cookies.find(c => c.name === 'li_at');
  const jsessionid = cookies.find(c => c.name === 'JSESSIONID');

  if (!liAt) {
    console.error('Login failed — li_at cookie not found. Check credentials or solve the CAPTCHA.');
    await browser.close();
    process.exit(1);
  }

  // Save all cookies to disk — scrape_profiles.js and server.py can load these
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  console.log(`\n✓ Logged in successfully!`);
  console.log(`✓ li_at: ${liAt.value.slice(0, 20)}...`);
  console.log(`✓ JSESSIONID: ${jsessionid?.value}`);
  console.log(`✓ Cookies saved to: ${COOKIES_FILE}`);

  // ── Step 5 (optional): Visit profiles and extract Featured section links ──
  // Set FETCH_PROFILES env var to a comma-separated list of LinkedIn slugs.
  // Example: FETCH_PROFILES=williamhgates,satya-nadella node login.js
  if (process.env.FETCH_PROFILES) {
    const slugs = process.env.FETCH_PROFILES.split(',').map(s => s.trim()).filter(Boolean);
    const targets = slugs.map(slug => ({ name: slug, slug }));

    for (const target of targets) {
      console.log(`\n=== ${target.name} ===`);

      // waitUntil: 'load' instead of networkidle2 — profile pages load too much async content
      await page.goto(`https://www.linkedin.com/in/${target.slug}/`, { waitUntil: 'load', timeout: 30000 });

      // Wait 3 seconds for dynamic content (posts, Featured section) to render
      await new Promise(r => setTimeout(r, 3000));
      console.log('URL:', page.url());

      // Extract all links inside the Featured section
      // page.evaluate() runs JavaScript directly inside the browser page
      const featured = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('section').forEach(sec => {
          const h2 = sec.querySelector('h2');
          if (h2 && h2.innerText.toLowerCase().includes('featured')) {
            sec.querySelectorAll('a[href]').forEach(a => {
              // Skip links that point back to LinkedIn profiles
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

      // Save a full-page screenshot to /tmp/ for visual inspection
      const screenshotPath = `/tmp/li_${target.slug}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('Screenshot:', screenshotPath);

      // Brief pause between profiles to avoid triggering rate limits
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  await browser.close();
})();
