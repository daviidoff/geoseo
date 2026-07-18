"""
Shared constants for OpenAnalytics pipeline.
"""

# Default Gemini model
GEMINI_MODEL = "gemini-3-flash-preview"

# Default timeout for HTTP requests (seconds)
DEFAULT_TIMEOUT = 30.0

# AI crawler user agents to check
AI_CRAWLERS = {
    'gptbot': {
        'name': 'GPTBot',
        'owner': 'OpenAI (ChatGPT)',
        'importance': 'critical',
        'score_impact': 8
    },
    'claudebot': {
        'name': 'Claude-Web',
        'owner': 'Anthropic (Claude)',
        'importance': 'high',
        'score_impact': 5
    },
    'claude-web': {
        'name': 'Claude-Web',
        'owner': 'Anthropic (Claude)',
        'importance': 'high',
        'score_impact': 5
    },
    'anthropic-ai': {
        'name': 'Anthropic-AI',
        'owner': 'Anthropic (Claude)',
        'importance': 'high',
        'score_impact': 5
    },
    'perplexitybot': {
        'name': 'PerplexityBot',
        'owner': 'Perplexity AI',
        'importance': 'high',
        'score_impact': 5
    },
    'ccbot': {
        'name': 'CCBot',
        'owner': 'Common Crawl (trains many LLMs)',
        'importance': 'medium',
        'score_impact': 4
    },
    'googleother': {
        'name': 'GoogleOther',
        'owner': 'Google (Gemini training)',
        'importance': 'medium',
        'score_impact': 4
    },
}

# HTTP headers for fetching
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AEO-HealthCheck/2.5; +https://scaile.tech)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

# Cloudflare challenge patterns
CLOUDFLARE_PATTERNS = [
    "Checking your browser",
    "cf-browser-verification",
    "Just a moment...",
    "_cf_chl_opt",
    "Attention Required! | Cloudflare",
    "Please Wait... | Cloudflare",
    "Enable JavaScript and cookies to continue",
    "cf-spinner",
    "challenge-platform",
    "checking your connection",
    "Verifying you are human",
    "We're currently checking",
]
