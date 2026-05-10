#!/usr/bin/env node
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, 'linkedin_cookies.json');

// Define target LinkedIn profiles to scrape.
// Replace slugs with the LinkedIn URL path segment for each person
// e.g. linkedin.com/in/williamhgates → slug is 'williamhgates'
const TARGETS = [
  { name: 'Example Person 1', slug: 'williamhgates' },
  { name: 'Example Person 2', slug: 'satya-nadella' },
];

(async () => {
  const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  // Set cookies on linkedin.com domain
  await page.setCookie(...cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain || '.linkedin.com',
    path: c.path || '/',
    httpOnly: c.httpOnly || false,
    secure: c.secure || true,
  })));

  for (const target of TARGETS) {
    console.log(`\n=== ${target.name} (linkedin.com/in/${target.slug}) ===`);
    try {
      await page.goto(`https://www.linkedin.com/in/${target.slug}/`, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(r => setTimeout(r, 2000));

      // Check if logged in
      const loggedIn = await page.$('#global-nav-typeahead');
      console.log('Logged in:', !!loggedIn);

      // Extract Featured section
      const featured = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('section'));
        for (const sec of sections) {
          const heading = sec.querySelector('h2');
          if (heading && heading.textContent.trim().toLowerCase().includes('featured')) {
            const items = Array.from(sec.querySelectorAll('a[href]')).map(a => ({
              text: a.textContent.trim().slice(0, 80),
              href: a.href,
            }));
            return items;
          }
        }
        return [];
      });

      if (featured.length === 0) {
        console.log('No Featured section found');
      } else {
        featured.forEach(f => console.log(' -', f.text, '->', f.href));
      }

      // Also check for resume/PDF links anywhere on page
      const pdfLinks = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href*=".pdf"], a[href*="resume"], a[href*="portfolio"]'))
          .map(a => ({ text: a.textContent.trim().slice(0, 60), href: a.href }))
      );
      if (pdfLinks.length > 0) {
        console.log('PDF/Resume links:');
        pdfLinks.forEach(l => console.log(' -', l.text, '->', l.href));
      }

    } catch (e) {
      console.log('Error:', e.message);
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  await browser.close();
})();
