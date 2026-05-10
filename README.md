# linkedin-mcp

Connecting LinkedIn to a terminal through Claude Code as an MCP server. The goal was to search profiles and companies without touching a browser. It took three attempts to get working.

## Results

![MCP tools registered in Claude Code](assets/mcp_tools.png)
![Profile search from terminal](assets/search_result.png)
![Company employee lookup](assets/company_lookup.png)

## Attempt 1 — Python library (`linkedin-api`)

Started with [`linkedin-api`](https://github.com/tomquirk/linkedin-api), a library that wraps LinkedIn's internal Voyager API. Built `server.py` on top of it using FastMCP and registered it with Claude Code as a tool server.

It worked briefly. The profile endpoint it relied on (`/identity/profiles/<urn>/profileView`) started returning `410 Gone`. The library crashed with a `KeyError` reading a field that no longer existed in the response. Profiles were broken and there was no fix on the library side.

`server.py` is still in the repo — the auth fallback and tool structure are reusable — but this approach alone doesn't hold up.

## Attempt 2 — Puppeteer + cookie extraction

Switched to browser automation. `login.js` opens a real Chrome window, logs in with credentials, and saves the session cookies to `linkedin_cookies.json`. `scrape_profiles.js` then loads those cookies into a headless browser and visits profiles directly.

Login was reliable. The problem was the second step — spinning up a headless Puppeteer instance with saved cookies triggered LinkedIn's bot detection. Sessions got flagged and profile pages returned redirect loops. Injecting the cookies back into the Python `linkedin-api` client (see `server.py`'s `get_client()`) worked slightly better but still hit 401s on consecutive calls.

`fetch_profiles.js` is a variant that logs in fresh every run rather than reusing cookies — more reliable but slow and not practical for repeated use.

## Attempt 3 — `linkedin-scraper-mcp` (working)

Found [`stickerdaniel/linkedin-mcp-server`](https://github.com/stickerdaniel/linkedin-mcp-server), an MCP server built specifically for this. It runs through `uvx`, uses Playwright with a persistent browser profile, and keeps the session alive across calls without re-authenticating.

```bash
claude mcp add linkedin --scope user -- uvx linkedin-scraper-mcp@latest
```

First run opens a browser for manual login. After that the session persists and Claude Code has full LinkedIn tool access from the terminal.

## Setup

**Working MCP server:**

```bash
pip install uv
claude mcp add linkedin --scope user -- uvx linkedin-scraper-mcp@latest
```

Log in once when the browser opens. Done.

**Puppeteer scripts:**

```bash
npm install

# Login and save cookies
LINKEDIN_EMAIL="your@email.com" LINKEDIN_PASSWORD="yourpassword" node login.js

# Optionally visit profiles right after login
LINKEDIN_EMAIL="your@email.com" LINKEDIN_PASSWORD="yourpassword" FETCH_PROFILES=williamhgates,satya-nadella node login.js

# Headless scrape using saved cookies (edit TARGETS in scrape_profiles.js first)
node scrape_profiles.js
```

**Python server:**

```bash
uv sync
```

Create a `.env` file (already in `.gitignore`):
```
LINKEDIN_EMAIL=your@email.com
LINKEDIN_PASSWORD=yourpassword
```

```bash
uv run python server.py
# or register with Claude Code:
claude mcp add linkedin-py -- uv run python server.py
```

## Files

```
server.py           # Python MCP server — FastMCP + linkedin-api (Attempt 1 + cookie fallback)
login.js            # Puppeteer login — saves cookies, optional profile fetch
fetch_profiles.js   # Fresh login every run, visits target profiles
scrape_profiles.js  # Headless scraper using saved cookies from login.js
pyproject.toml      # Python deps
package.json        # Node deps
.gitignore          # Excludes linkedin_cookies.json, .env, node_modules
```

## Security

Never commit credentials. Use env vars or `.env`. The `linkedin_cookies.json` file is gitignored — keep it that way. LinkedIn does not officially support third-party API access.
