"""AI Crawler Access Checks - 4 AEO-specific checks

Analyzes robots.txt to determine which AI crawlers can access the site:
- GPTBot (OpenAI/ChatGPT)
- Claude-Web (Anthropic)
- PerplexityBot (Perplexity AI)
- CCBot (Common Crawl - trains many LLMs)
"""

import re
from typing import List, Dict, Any, Optional, Set


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


def parse_robots_txt(robots_txt: Optional[str]) -> Dict[str, Dict[str, bool]]:
    """Parse robots.txt and extract rules per user-agent.
    
    Returns:
        Dict mapping user-agent (lowercase) to {disallow_all: bool, allow_all: bool}
    """
    if not robots_txt:
        return {}
    
    rules = {}
    current_agents = []
    
    for line in robots_txt.split('\n'):
        line = line.strip()
        
        # Skip comments and empty lines
        if not line or line.startswith('#'):
            continue
        
        # Parse User-agent
        if line.lower().startswith('user-agent:'):
            agent = line.split(':', 1)[1].strip().lower()
            current_agents = [agent]
            if agent not in rules:
                rules[agent] = {'disallow_all': False, 'allow_all': True}
        
        # Parse Disallow
        elif line.lower().startswith('disallow:') and current_agents:
            path = line.split(':', 1)[1].strip()
            for agent in current_agents:
                if agent not in rules:
                    rules[agent] = {'disallow_all': False, 'allow_all': True}
                if path == '/' or path == '/*':
                    rules[agent]['disallow_all'] = True
                    rules[agent]['allow_all'] = False
                elif path:  # Any non-empty disallow
                    rules[agent]['allow_all'] = False
        
        # Parse Allow
        elif line.lower().startswith('allow:') and current_agents:
            path = line.split(':', 1)[1].strip()
            for agent in current_agents:
                if agent not in rules:
                    rules[agent] = {'disallow_all': False, 'allow_all': True}
                if path == '/' or path == '/*':
                    rules[agent]['disallow_all'] = False
                    rules[agent]['allow_all'] = True
    
    return rules


def is_crawler_allowed(rules: Dict[str, Dict[str, bool]], crawler_name: str) -> bool:
    """Check if a specific crawler is allowed based on robots.txt rules.
    
    Args:
        rules: Parsed robots.txt rules
        crawler_name: Lowercase crawler name to check
        
    Returns:
        True if crawler is allowed, False if blocked
    """
    # Check specific rule first
    if crawler_name in rules:
        return not rules[crawler_name]['disallow_all']
    
    # Check wildcard rule
    if '*' in rules:
        return not rules['*']['disallow_all']
    
    # Default: allowed if no rules
    return True


def run_aeo_crawler_checks(robots_txt: Optional[str]) -> List[Dict[str, Any]]:
    """Run all 4 AI crawler access checks.
    
    Args:
        robots_txt: Content of robots.txt file (None if not found)
        
    Returns:
        List of check results
    """
    issues = []
    rules = parse_robots_txt(robots_txt)
    
    # Track unique crawlers (Claude has multiple variants)
    checked_crawlers = set()
    
    # === 1. GPTBOT (OpenAI) ===
    gptbot_allowed = is_crawler_allowed(rules, 'gptbot')
    
    if not gptbot_allowed:
        issues.append({
            'check': 'gptbot_access',
            'category': 'aeo_crawler',
            'passed': False,
            'severity': 'error',
            'message': 'GPTBot is blocked in robots.txt',
            'recommendation': "Remove 'Disallow: /' for GPTBot to ensure visibility in ChatGPT",
            'score_impact': 8
        })
    else:
        issues.append({
            'check': 'gptbot_access',
            'category': 'aeo_crawler',
            'passed': True,
            'severity': 'pass',
            'message': 'GPTBot (OpenAI) is allowed',
            'recommendation': '',
            'score_impact': 8
        })
    
    # === 2. CLAUDE-WEB (Anthropic) ===
    claude_allowed = (
        is_crawler_allowed(rules, 'claudebot') and
        is_crawler_allowed(rules, 'claude-web') and
        is_crawler_allowed(rules, 'anthropic-ai')
    )
    
    if not claude_allowed:
        issues.append({
            'check': 'claude_access',
            'category': 'aeo_crawler',
            'passed': False,
            'severity': 'warning',
            'message': 'Claude-Web/Anthropic crawler is blocked',
            'recommendation': "Remove blocks for ClaudeBot, Claude-Web, and Anthropic-AI",
            'score_impact': 5
        })
    else:
        issues.append({
            'check': 'claude_access',
            'category': 'aeo_crawler',
            'passed': True,
            'severity': 'pass',
            'message': 'Claude-Web (Anthropic) is allowed',
            'recommendation': '',
            'score_impact': 5
        })
    
    # === 3. PERPLEXITYBOT ===
    perplexity_allowed = is_crawler_allowed(rules, 'perplexitybot')
    
    if not perplexity_allowed:
        issues.append({
            'check': 'perplexitybot_access',
            'category': 'aeo_crawler',
            'passed': False,
            'severity': 'warning',
            'message': 'PerplexityBot is blocked in robots.txt',
            'recommendation': "Remove 'Disallow: /' for PerplexityBot",
            'score_impact': 5
        })
    else:
        issues.append({
            'check': 'perplexitybot_access',
            'category': 'aeo_crawler',
            'passed': True,
            'severity': 'pass',
            'message': 'PerplexityBot is allowed',
            'recommendation': '',
            'score_impact': 5
        })
    
    # === 4. CCBOT (Common Crawl) ===
    ccbot_allowed = is_crawler_allowed(rules, 'ccbot')
    
    if not ccbot_allowed:
        issues.append({
            'check': 'ccbot_access',
            'category': 'aeo_crawler',
            'passed': False,
            'severity': 'notice',
            'message': 'CCBot (Common Crawl) is blocked',
            'recommendation': "Consider allowing CCBot - Common Crawl data trains many LLMs",
            'score_impact': 4
        })
    else:
        issues.append({
            'check': 'ccbot_access',
            'category': 'aeo_crawler',
            'passed': True,
            'severity': 'pass',
            'message': 'CCBot (Common Crawl) is allowed',
            'recommendation': '',
            'score_impact': 4
        })
    
    return issues


def extract_crawler_summary(robots_txt: Optional[str]) -> Dict[str, Any]:
    """Extract AI crawler access summary for the response."""
    rules = parse_robots_txt(robots_txt)
    
    allowed = []
    blocked = []
    
    # Check main AI crawlers
    crawler_checks = [
        ('gptbot', 'GPTBot'),
        ('claudebot', 'Claude-Web'),
        ('perplexitybot', 'PerplexityBot'),
        ('ccbot', 'CCBot'),
        ('googleother', 'GoogleOther'),
    ]
    
    for crawler_key, crawler_name in crawler_checks:
        if is_crawler_allowed(rules, crawler_key):
            allowed.append(crawler_name)
        else:
            blocked.append(crawler_name)
    
    return {
        'robots_txt_found': robots_txt is not None,
        'ai_crawlers_allowed': allowed,
        'ai_crawlers_blocked': blocked,
        'wildcard_disallow': rules.get('*', {}).get('disallow_all', False),
    }

