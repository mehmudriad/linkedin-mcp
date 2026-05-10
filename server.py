import os
import json
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from linkedin_api import Linkedin

load_dotenv()

mcp = FastMCP("linkedin")

_client: Linkedin | None = None

COOKIES_FILE = os.path.join(os.path.dirname(__file__), "linkedin_cookies.json")

def get_client() -> Linkedin:
    global _client
    if _client is None:
        if os.path.exists(COOKIES_FILE):
            with open(COOKIES_FILE) as f:
                all_cookies = json.load(f)
            jsessionid = next((c["value"] for c in all_cookies if c["name"] == "JSESSIONID"), "")
            _client = Linkedin("", "", authenticate=False)
            for c in all_cookies:
                _client.client.session.cookies.set(
                    c["name"], c["value"],
                    domain=c.get("domain", ".linkedin.com"),
                    path=c.get("path", "/")
                )
            _client.client.session.headers["csrf-token"] = jsessionid.strip('"')
            _client.client.session.headers["user-agent"] = (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
        else:
            email = os.environ["LINKEDIN_EMAIL"]
            password = os.environ["LINKEDIN_PASSWORD"]
            _client = Linkedin(email, password)
    return _client


@mcp.tool()
def get_profile(public_id: str) -> str:
    """Get full LinkedIn profile for a person by their profile ID (e.g. 'bill-gates')"""
    profile = get_client().get_profile(public_id)
    return json.dumps(profile, indent=2)


@mcp.tool()
def get_profile_posts(public_id: str, post_count: int = 10) -> str:
    """Get recent posts from a LinkedIn profile"""
    posts = get_client().get_profile_posts(public_id, post_count=post_count)
    return json.dumps(posts, indent=2)


@mcp.tool()
def get_feed_posts(limit: int = 10) -> str:
    """Get posts from your own LinkedIn feed"""
    posts = get_client().get_feed_posts(limit=limit)
    return json.dumps(posts, indent=2)


@mcp.tool()
def search_people(keywords: str, limit: int = 10) -> str:
    """Search LinkedIn for people by keywords (name, title, company, etc.)"""
    results = get_client().search_people(keywords=keywords, limit=limit)
    return json.dumps(results, indent=2)


@mcp.tool()
def react_to_post(urn_id: str, reaction: str = "LIKE") -> str:
    """
    React to a LinkedIn post.
    urn_id: the post URN (e.g. 'urn:li:activity:1234567890')
    reaction: LIKE, PRAISE, APPRECIATION, EMPATHY, INTEREST, ENTERTAINMENT
    """
    result = get_client().react_to_post(urn_id, reaction)
    return json.dumps({"success": result})


@mcp.tool()
def get_post_comments(post_urn: str, comment_count: int = 20) -> str:
    """Get comments on a LinkedIn post"""
    comments = get_client().get_post_comments(post_urn, comment_count=comment_count)
    return json.dumps(comments, indent=2)


@mcp.tool()
def get_post_reactions(urn_id: str) -> str:
    """Get reactions on a LinkedIn post"""
    reactions = get_client().get_post_reactions(urn_id)
    return json.dumps(reactions, indent=2)


@mcp.tool()
def search_companies(keywords: str, limit: int = 10) -> str:
    """Search LinkedIn for companies"""
    results = get_client().search_companies(keywords=keywords, limit=limit)
    return json.dumps(results, indent=2)


@mcp.tool()
def add_connection(profile_public_id: str, message: str = "") -> str:
    """Send a connection request to someone"""
    result = get_client().add_connection(profile_public_id, message=message)
    return json.dumps({"success": result})


@mcp.tool()
def send_message(recipient_profile_id: str, message: str) -> str:
    """Send a message to a LinkedIn connection"""
    result = get_client().send_message(message_body=message, recipients=[recipient_profile_id])
    return json.dumps({"success": result})


@mcp.tool()
def get_profile_contact_info(public_id: str) -> str:
    """Get contact info (email, phone, etc.) from a profile"""
    info = get_client().get_profile_contact_info(public_id)
    return json.dumps(info, indent=2)


@mcp.tool()
def get_my_profile() -> str:
    """Get your own LinkedIn profile"""
    profile = get_client().get_user_profile()
    return json.dumps(profile, indent=2)


@mcp.tool()
def get_my_connections() -> str:
    """Get your LinkedIn connections"""
    connections = get_client().get_profile_connections("self")
    return json.dumps(connections, indent=2)


if __name__ == "__main__":
    mcp.run(transport="stdio")
