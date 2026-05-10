# linkedin-mcp

I wanted to search LinkedIn profiles and companies directly from my terminal — without opening a browser every time. The idea was to hook LinkedIn into [Claude Code](https://claude.ai/code) as an MCP (Model Context Protocol) server, so I could just ask things like "search for engineers at this company" or "get the profile for this person" and get a real answer back in my terminal session.

Getting there took three attempts. Here's what happened.

---

## Attempt 1 — Python library (`linkedin-api`)

The first thing I tried was the [`linkedin-api`](https://github.com/tomquirk/linkedin-api) Python library. It wraps LinkedIn's internal Voyager API and handles auth for you. I built `server.py` on top of it using FastMCP — exposed tools like `get_profile`, `search_people`, `search_companies`, etc., and registered it with Claude Code.

It worked at first. But the profile endpoint it relied on (`/identity/profiles/<urn>/profileView`) started returning `410 Gone`. The library hadn't been updated to handle the response change and crashed with a `KeyError` when it tried to read a field that no longer existed. Profiles were completely broken.

I kept the server.py file because the auth fallback and tool structure are still useful, but this approach alone wasn't reliable enough.

---

## Attempt 2 — Puppeteer + cookie extraction

Since the Python library was hitting deprecated endpoints, I tried a different angle: use a real browser to log in, grab the session cookies, and then reuse them for API calls.

`login.js` handles the browser login — it opens a visible Chrome window (so you can solve CAPTCHAs if LinkedIn throws one), logs in with your credentials, and saves the cookies to `linkedin_cookies.json`. From there, `scrape_profiles.js` loads those cookies into a headless browser and visits profiles directly.

This partially worked. The login was reliable. But when I spun up a second headless Puppeteer instance to use the saved cookies, LinkedIn's bot detection kicked in — the session was flagged and profile pages returned redirect loops instead of content. I also tried injecting the cookies back into the Python `linkedin-api` client (you can see this in `server.py`'s `get_client()` function), which got me a bit further but still hit rate limits and 401s on consecutive calls.

`fetch_profiles.js` is a variant that logs in fresh every run instead of reusing saved cookies — slightly more reliable but still not something you'd want to depend on.

---

## What finally worked — `linkedin-scraper-mcp`

After those two dead ends I looked for an MCP server that someone had already built properly. Found [`stickerdaniel/linkedin-mcp-server`](https://github.com/stickerdaniel/linkedin-mcp-server), which runs through `uvx` and uses Playwright under the hood with a persistent browser profile. It keeps the session alive across calls without re-authenticating each time, and it's built specifically for the MCP protocol.

Setup is just:

```bash
claude mcp add linkedin --scope user -- uvx linkedin-scraper-mcp@latest
```

The first time it runs, it opens a browser and asks you to log in. After that the session persists. You can then ask Claude Code anything and it'll use the LinkedIn tools directly — no browser, no re-login, no cookies to manage.

This is the approach I'd actually recommend. The Python server and Puppeteer scripts are still in the repo because they document what I tried and parts of them (especially the cookie injection logic) might be useful if you're working with the Voyager API directly.

---

## Setup

**For the working MCP server:**

Install the `uvx` runner if you don't have it:
```bash
pip install uv
```

Register the LinkedIn MCP server with Claude Code:
```bash
claude mcp add linkedin --scope user -- uvx linkedin-scraper-mcp@latest
```

First launch opens a browser — log in manually. Done. Claude Code now has LinkedIn tools available.

**For the Puppeteer scripts:**

```bash
npm install
```

Run the login script (opens a real browser):
```bash
LINKEDIN_EMAIL="your@email.com" LINKEDIN_PASSWORD="yourpassword" node login.js
```

To also visit profiles after login:
```bash
LINKEDIN_EMAIL="your@email.com" LINKEDIN_PASSWORD="yourpassword" \
FETCH_PROFILES=williamhgates,satya-nadella node login.js
```

Headless scrape using saved cookies:
```bash
# Edit TARGETS in scrape_profiles.js first
node scrape_profiles.js
```

**For the Python server:**

```bash
uv sync
```

Set credentials in a `.env` file (already gitignored):
```
LINKEDIN_EMAIL=your@email.com
LINKEDIN_PASSWORD=yourpassword
```

Run:
```bash
uv run python server.py
```

Or register with Claude Code:
```bash
claude mcp add linkedin-py -- uv run python server.py
```

---

## What's in the repo

```
server.py           # Python MCP server built on FastMCP + linkedin-api (Attempt 1 + cookie fallback)
login.js            # Puppeteer login — saves session cookies, optional profile fetch after login
fetch_profiles.js   # Standalone version — logs in fresh each run, visits profiles
scrape_profiles.js  # Headless scraper that reuses saved cookies from login.js
pyproject.toml      # Python deps
package.json        # Node deps
.gitignore          # Excludes linkedin_cookies.json, .env, node_modules
```

---

## Notes

- Never commit your credentials. Use env vars or `.env` (already in `.gitignore`).
- `linkedin_cookies.json` is also gitignored — keep it that way.
- LinkedIn doesn't officially support third-party API access. Use responsibly.
