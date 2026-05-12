# linkedin-mcp

## What this is
MCP server connecting LinkedIn to Claude Code / terminal. Public repo: github.com/mehmudriad/linkedin-mcp. Lets Claude search LinkedIn companies, people, jobs directly from terminal.

## Current state
- Working via uvx: `uvx linkedin-scraper-mcp@latest`
- Uses stickerdaniel/linkedin-mcp-server with persistent Playwright session
- Public on GitHub (master) — dev branch local only
- linkedin_cookies.json gitignored — never committed

## Key decisions
- 3 approaches tried before final solution:
  1. linkedin-api Python library → failed (410 Gone)
  2. Puppeteer + cookie extraction → failed (bot detection)
  3. uvx linkedin-scraper-mcp → works ✓
- dev branch = local only, never pushed
- master = public GitHub

## Prompts that worked
<!-- Add prompts here -->

## Rules
- linkedin_cookies.json NEVER committed — stays gitignored
- .env NEVER committed
- All credentials use placeholders before any master commit
- dev branch local only — never publish dev to GitHub
