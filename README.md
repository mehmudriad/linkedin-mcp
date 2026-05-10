# LinkedIn MCP Server

Connect LinkedIn to your terminal through [Claude Code](https://claude.ai/code) using the Model Context Protocol (MCP). Search profiles, browse companies, read posts, and send messages — all from your command line without touching a browser.

---

## What this does

This project wires LinkedIn into Claude Code as an MCP tool server. Once connected, you can ask Claude things like:

- _"Search for mechanical engineers at OPEX Corporation"_
- _"Get the profile of someone with slug `williamhgates`"_
- _"Show me recent posts from my LinkedIn feed"_
- _"Send a connection request to this person"_

Two implementations are included:

| Approach | Files | Auth method |
|----------|-------|-------------|
| **Python MCP server** | `server.py` | `linkedin-api` library + cookies or env vars |
| **Puppeteer browser scripts** | `login.js`, `fetch_profiles.js`, `scrape_profiles.js` | Real browser login → saved cookies |

---

## Quick start

### Option A — Python MCP server (recommended)

**1. Install dependencies**

```bash
pip install uv
uv sync
```

**2. Set credentials**

```bash
export LINKEDIN_EMAIL="your@email.com"
export LINKEDIN_PASSWORD="yourpassword"
```

Or create a `.env` file (already in `.gitignore`):

```
LINKEDIN_EMAIL=your@email.com
LINKEDIN_PASSWORD=yourpassword
```

**3. Register with Claude Code**

```bash
claude mcp add linkedin -- uv run python server.py
```

**4. Use it**

Open Claude Code and ask anything LinkedIn-related. The MCP tools are available automatically.

---

### Option B — Puppeteer browser login

Use this if the Python library gets blocked or you need to solve a CAPTCHA manually.

**1. Install dependencies**

```bash
npm install
```

**2. Login and save cookies**

```bash
LINKEDIN_EMAIL="your@email.com" LINKEDIN_PASSWORD="yourpassword" node login.js
```

A real browser window opens. Solve any CAPTCHA if prompted. Cookies are saved to `linkedin_cookies.json` (gitignored).

**3. Fetch profiles (optional)**

Visit profiles and extract Featured section links:

```bash
LINKEDIN_EMAIL="your@email.com" LINKEDIN_PASSWORD="yourpassword" \
FETCH_PROFILES=williamhgates,satya-nadella node login.js
```

Or use the standalone fetcher:

```bash
# Edit TARGETS in fetch_profiles.js first
LINKEDIN_EMAIL="your@email.com" LINKEDIN_PASSWORD="yourpassword" node fetch_profiles.js
```

**4. Scrape with saved cookies (headless)**

```bash
# Edit TARGETS in scrape_profiles.js first
node scrape_profiles.js
```

---

## MCP tools (Python server)

| Tool | Description |
|------|-------------|
| `get_profile(public_id)` | Full profile by LinkedIn slug |
| `get_my_profile()` | Your own profile |
| `get_my_connections()` | Your connections |
| `search_people(keywords)` | Search people by name, title, company |
| `search_companies(keywords)` | Search companies |
| `get_profile_posts(public_id)` | Recent posts from a profile |
| `get_feed_posts()` | Your LinkedIn feed |
| `get_post_comments(post_urn)` | Comments on a post |
| `get_post_reactions(urn_id)` | Reactions on a post |
| `get_profile_contact_info(public_id)` | Contact info from a profile |
| `react_to_post(urn_id, reaction)` | Like / react to a post |
| `add_connection(public_id, message)` | Send a connection request |
| `send_message(recipient_id, message)` | Send a direct message |

---

## What gets scraped (Puppeteer scripts)

- Profile URL visited
- `Featured` section links (resumes, portfolios, external links)
- PDF / resume links anywhere on the page
- Full-page screenshot saved to `/tmp/`

---

## Security

- **Never commit credentials.** Use environment variables or a `.env` file.
- `linkedin_cookies.json` and `.env` are in `.gitignore` — keep them there.
- LinkedIn's ToS prohibits automated scraping. Use responsibly.

---

## Project structure

```
linkedin-mcp/
├── server.py           # Python MCP server (FastMCP + linkedin-api)
├── login.js            # Puppeteer login + optional profile fetch
├── fetch_profiles.js   # Standalone: login fresh + visit profiles
├── scrape_profiles.js  # Headless scraper using saved cookies
├── pyproject.toml      # Python dependencies
├── package.json        # Node dependencies
└── .gitignore          # Excludes cookies, .env, node_modules
```

---

## Requirements

- Python 3.11+, `uv`
- Node.js 18+, `npm`
- A LinkedIn account
- [Claude Code](https://claude.ai/code) (for MCP integration)
