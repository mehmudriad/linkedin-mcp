# ─────────────────────────────────────────────────────────────
# server.py — LinkedIn MCP Server (Attempt 1 approach)
#
# This exposes LinkedIn actions as MCP tools that Claude Code
# can call directly from your terminal.
#
# HOW TO RUN:
#   Option A — register with Claude Code (recommended):
#     claude mcp add linkedin-py -- uv run python server.py
#
#   Option B — run manually to test:
#     uv run python server.py
#
# AUTH — two modes (picked automatically):
#   1. If linkedin_cookies.json exists → uses saved browser cookies
#      (generate it by running login.js first)
#   2. Otherwise → reads LINKEDIN_EMAIL and LINKEDIN_PASSWORD from
#      environment variables or a .env file
#
# CREDENTIALS — never hardcode them. Use a .env file:
#   LINKEDIN_EMAIL=your@email.com
#   LINKEDIN_PASSWORD=yourpassword
# ─────────────────────────────────────────────────────────────

import os
import json
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from linkedin_api import Linkedin

# Load .env file if present (won't override existing env vars)
load_dotenv()

# Initialize the MCP server — "linkedin" is the name Claude Code sees
mcp = FastMCP("linkedin")

# Single shared client — created once and reused across all tool calls
_client: Linkedin | None = None

# Path to cookies file saved by login.js
COOKIES_FILE = os.path.join(os.path.dirname(__file__), "linkedin_cookies.json")


def get_client() -> Linkedin:
    """
    Returns an authenticated LinkedIn client.
    Tries cookie-based auth first, falls back to username/password.
    """
    global _client
    if _client is None:
        if os.path.exists(COOKIES_FILE):
            # ── Cookie auth path ──────────────────────────────────────
            # Load cookies saved by login.js and inject them into the
            # linkedin-api session so it skips the login flow entirely.
            with open(COOKIES_FILE) as f:
                all_cookies = json.load(f)

            # JSESSIONID doubles as the CSRF token LinkedIn requires
            jsessionid = next((c["value"] for c in all_cookies if c["name"] == "JSESSIONID"), "")

            # Initialize with empty credentials — we're using cookies instead
            _client = Linkedin("", "", authenticate=False)

            # Inject every cookie into the requests session
            for c in all_cookies:
                _client.client.session.cookies.set(
                    c["name"], c["value"],
                    domain=c.get("domain", ".linkedin.com"),
                    path=c.get("path", "/")
                )

            # Set required headers so LinkedIn accepts the session
            _client.client.session.headers["csrf-token"] = jsessionid.strip('"')
            _client.client.session.headers["user-agent"] = (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
        else:
            # ── Username/password auth path ───────────────────────────
            # Reads from environment — set these in your .env file or
            # export them in your shell before running.
            email = os.environ["LINKEDIN_EMAIL"]
            password = os.environ["LINKEDIN_PASSWORD"]
            _client = Linkedin(email, password)

    return _client


# ─────────────────────────────────────────────────────────────
# MCP TOOLS
# Each function below becomes a tool Claude Code can call.
# The docstring is what Claude reads to understand what the tool does.
# ─────────────────────────────────────────────────────────────

@mcp.tool()
def get_profile(public_id: str) -> str:
    """Get full LinkedIn profile for a person by their profile slug.
    The slug is the last part of their LinkedIn URL:
    linkedin.com/in/williamhgates → public_id is 'williamhgates'
    """
    profile = get_client().get_profile(public_id)
    return json.dumps(profile, indent=2)


@mcp.tool()
def get_profile_posts(public_id: str, post_count: int = 10) -> str:
    """Get recent posts from a LinkedIn profile.
    public_id: LinkedIn slug (e.g. 'williamhgates')
    post_count: how many posts to return (default 10)
    """
    posts = get_client().get_profile_posts(public_id, post_count=post_count)
    return json.dumps(posts, indent=2)


@mcp.tool()
def get_feed_posts(limit: int = 10) -> str:
    """Get posts from your own LinkedIn feed (what you'd see on the homepage)."""
    posts = get_client().get_feed_posts(limit=limit)
    return json.dumps(posts, indent=2)


@mcp.tool()
def search_people(keywords: str, limit: int = 10) -> str:
    """Search LinkedIn for people by keywords.
    keywords: name, job title, company, skill — anything you'd type in the search bar
    limit: max results to return (default 10)
    """
    results = get_client().search_people(keywords=keywords, limit=limit)
    return json.dumps(results, indent=2)


@mcp.tool()
def react_to_post(urn_id: str, reaction: str = "LIKE") -> str:
    """React to a LinkedIn post.
    urn_id: the post URN (e.g. 'urn:li:activity:1234567890') — found in the post URL
    reaction: LIKE, PRAISE, APPRECIATION, EMPATHY, INTEREST, or ENTERTAINMENT
    """
    result = get_client().react_to_post(urn_id, reaction)
    return json.dumps({"success": result})


@mcp.tool()
def get_post_comments(post_urn: str, comment_count: int = 20) -> str:
    """Get comments on a LinkedIn post.
    post_urn: the post URN (e.g. 'urn:li:activity:1234567890')
    """
    comments = get_client().get_post_comments(post_urn, comment_count=comment_count)
    return json.dumps(comments, indent=2)


@mcp.tool()
def get_post_reactions(urn_id: str) -> str:
    """Get all reactions on a LinkedIn post.
    urn_id: the post URN (e.g. 'urn:li:activity:1234567890')
    """
    reactions = get_client().get_post_reactions(urn_id)
    return json.dumps(reactions, indent=2)


@mcp.tool()
def search_companies(keywords: str, limit: int = 10) -> str:
    """Search LinkedIn for companies by name or keyword."""
    results = get_client().search_companies(keywords=keywords, limit=limit)
    return json.dumps(results, indent=2)


@mcp.tool()
def add_connection(profile_public_id: str, message: str = "") -> str:
    """Send a connection request to someone.
    profile_public_id: their LinkedIn slug
    message: optional note to include with the request (max ~200 chars)
    """
    result = get_client().add_connection(profile_public_id, message=message)
    return json.dumps({"success": result})


@mcp.tool()
def send_message(recipient_profile_id: str, message: str) -> str:
    """Send a direct message to a LinkedIn connection.
    recipient_profile_id: their LinkedIn slug
    message: the message text to send
    """
    result = get_client().send_message(message_body=message, recipients=[recipient_profile_id])
    return json.dumps({"success": result})


@mcp.tool()
def get_profile_contact_info(public_id: str) -> str:
    """Get contact info (email, phone, website, etc.) from a profile.
    Only returns info the person has made visible to connections.
    """
    info = get_client().get_profile_contact_info(public_id)
    return json.dumps(info, indent=2)


@mcp.tool()
def get_my_profile() -> str:
    """Get your own LinkedIn profile — useful for confirming auth is working."""
    profile = get_client().get_user_profile()
    return json.dumps(profile, indent=2)


@mcp.tool()
def get_my_connections() -> str:
    """Get your LinkedIn connections list."""
    connections = get_client().get_profile_connections("self")
    return json.dumps(connections, indent=2)


# ─────────────────────────────────────────────────────────────
# Entry point — MCP uses stdio transport so Claude Code can
# communicate with this process over stdin/stdout.
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    mcp.run(transport="stdio")
