#!/usr/bin/env python3
"""
Load Test Script for HyperNiche Services

Tests all services with configurable request counts to measure:
- Failure rate
- Average processing time
- Min/Max response times

Usage:
    python test_services_load.py                    # Run with defaults (10 requests each)
    python test_services_load.py --requests 100    # Run 100 requests per service
    python test_services_load.py --requests 1000   # Run 1000 requests per service
    python test_services_load.py --service keywords # Test only keywords service
    python test_services_load.py --concurrent 5    # Run 5 concurrent requests

Requirements:
    pip install aiohttp python-dotenv
"""

import asyncio
import aiohttp
import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
DEFAULT_REQUESTS = 10  # Default number of requests per service
DEFAULT_CONCURRENT = 3  # Default concurrent requests
REQUEST_TIMEOUT = 300  # 5 minutes timeout per request


@dataclass
class TestResult:
    """Result of a single test request."""
    service: str
    success: bool
    duration_seconds: float
    status_code: int
    error_message: Optional[str] = None
    response_preview: Optional[str] = None


@dataclass
class ServiceStats:
    """Aggregated statistics for a service."""
    service: str
    total_requests: int = 0
    successful: int = 0
    failed: int = 0
    total_duration: float = 0.0
    min_duration: float = float('inf')
    max_duration: float = 0.0
    errors: List[str] = field(default_factory=list)

    @property
    def failure_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return (self.failed / self.total_requests) * 100

    @property
    def avg_duration(self) -> float:
        if self.successful == 0:
            return 0.0
        return self.total_duration / self.successful

    def add_result(self, result: TestResult):
        self.total_requests += 1
        if result.success:
            self.successful += 1
            self.total_duration += result.duration_seconds
            self.min_duration = min(self.min_duration, result.duration_seconds)
            self.max_duration = max(self.max_duration, result.duration_seconds)
        else:
            self.failed += 1
            if result.error_message:
                self.errors.append(result.error_message[:100])


# Test payloads for each service
def get_keywords_payload(index: int) -> Dict[str, Any]:
    """Generate a keywords test payload."""
    companies = [
        ("Stripe", "https://stripe.com", "Payment processing platform"),
        ("Notion", "https://notion.so", "All-in-one workspace"),
        ("Figma", "https://figma.com", "Design collaboration tool"),
        ("Slack", "https://slack.com", "Team communication"),
        ("Vercel", "https://vercel.com", "Frontend deployment platform"),
    ]
    company = companies[index % len(companies)]
    return {
        "company_name": company[0],
        "company_url": company[1],
        "description": company[2],
        "language": "en",  # ISO code, not full name
        "region": "us",  # ISO code, not full name
        "target_count": 10,  # Small count for faster tests
    }


def get_blog_payload(index: int) -> Dict[str, Any]:
    """Generate a blog test payload."""
    keywords = [
        "how to process payments online",
        "best project management tools",
        "design system components",
        "team collaboration software",
        "serverless deployment guide",
    ]
    return {
        "keywords": [keywords[index % len(keywords)]],  # List of keywords
        "company_name": "Test Company",
        "company_url": "https://example.com",
        "language": "en",
        "region": "us",
        "word_count": 800,  # Min 500
    }


def get_context_payload(index: int) -> Dict[str, Any]:
    """Generate a context extraction test payload."""
    urls = [
        "https://stripe.com",
        "https://notion.so",
        "https://figma.com",
        "https://slack.com",
        "https://vercel.com",
    ]
    return {
        "url": urls[index % len(urls)],
    }


def get_mentions_payload(index: int) -> Dict[str, Any]:
    """Generate a mentions check test payload."""
    companies = [
        ("Stripe", {"products": ["Payment processing", "Billing"], "services": ["Online payments"]}),
        ("Notion", {"products": ["Workspace", "Wiki"], "services": ["Project management"]}),
        ("Figma", {"products": ["Design tool", "Prototyping"], "services": ["Design collaboration"]}),
        ("Slack", {"products": ["Messaging", "Channels"], "services": ["Team communication"]}),
        ("Vercel", {"products": ["Hosting", "Edge Functions"], "services": ["Deployment"]}),
    ]
    company = companies[index % len(companies)]
    return {
        "company_name": company[0],
        "company_analysis": {
            "companyInfo": company[1],
            "competitors": [],
        },
        "mode": "fast",  # Fast mode for quicker tests
        "language": "en",
        "country": "US",
    }


def get_health_payload(index: int) -> Dict[str, Any]:
    """Generate a health check test payload."""
    urls = [
        "https://stripe.com",
        "https://notion.so",
        "https://figma.com",
        "https://slack.com",
        "https://vercel.com",
    ]
    return {
        "url": urls[index % len(urls)],
    }


# Service configurations
SERVICES = {
    "keywords": {
        "endpoint": "/api/v1/keywords/generate",
        "method": "POST",
        "get_payload": get_keywords_payload,
        "description": "Keyword Generation (AI-powered SEO keywords)",
    },
    "blog": {
        "endpoint": "/api/v1/blog/jobs",
        "method": "POST",
        "get_payload": get_blog_payload,
        "description": "Blog Generation (AI-powered content)",
    },
    "context": {
        "endpoint": "/api/v1/context/analyze",
        "method": "POST",
        "get_payload": get_context_payload,
        "description": "Context Extraction (Company analysis)",
    },
    "mentions": {
        "endpoint": "/api/v1/mentions/check",
        "method": "POST",
        "get_payload": get_mentions_payload,
        "description": "Mentions Check (AI platform visibility)",
    },
    "health-check": {
        "endpoint": "/api/v1/health-check/check",
        "method": "POST",
        "get_payload": get_health_payload,
        "description": "Health Check (AEO website scoring)",
    },
}


async def make_request(
    session: aiohttp.ClientSession,
    service_name: str,
    service_config: Dict,
    index: int,
    semaphore: asyncio.Semaphore,
    base_url: str,
) -> TestResult:
    """Make a single test request to a service."""
    async with semaphore:
        url = f"{base_url}{service_config['endpoint']}"
        payload = service_config["get_payload"](index)

        start_time = time.time()

        try:
            async with session.post(
                url,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT),
            ) as response:
                duration = time.time() - start_time

                try:
                    data = await response.json()
                    response_preview = json.dumps(data)[:200] if data else None
                except:
                    response_preview = await response.text()
                    response_preview = response_preview[:200] if response_preview else None

                success = response.status in (200, 201, 202)
                error_msg = None if success else f"HTTP {response.status}: {response_preview}"

                return TestResult(
                    service=service_name,
                    success=success,
                    duration_seconds=duration,
                    status_code=response.status,
                    error_message=error_msg,
                    response_preview=response_preview,
                )

        except asyncio.TimeoutError:
            duration = time.time() - start_time
            return TestResult(
                service=service_name,
                success=False,
                duration_seconds=duration,
                status_code=0,
                error_message="Request timeout",
            )
        except aiohttp.ClientError as e:
            duration = time.time() - start_time
            return TestResult(
                service=service_name,
                success=False,
                duration_seconds=duration,
                status_code=0,
                error_message=f"Client error: {str(e)}",
            )
        except Exception as e:
            duration = time.time() - start_time
            return TestResult(
                service=service_name,
                success=False,
                duration_seconds=duration,
                status_code=0,
                error_message=f"Unexpected error: {str(e)}",
            )


async def test_service(
    service_name: str,
    service_config: Dict,
    num_requests: int,
    concurrent: int,
    base_url: str,
) -> ServiceStats:
    """Test a service with multiple requests."""
    stats = ServiceStats(service=service_name)
    semaphore = asyncio.Semaphore(concurrent)

    print(f"\n{'='*60}")
    print(f"Testing {service_name.upper()}: {service_config['description']}")
    print(f"  Requests: {num_requests}, Concurrent: {concurrent}")
    print(f"  Endpoint: {base_url}{service_config['endpoint']}")
    print(f"{'='*60}")

    async with aiohttp.ClientSession() as session:
        tasks = [
            make_request(session, service_name, service_config, i, semaphore, base_url)
            for i in range(num_requests)
        ]

        # Process results as they complete
        completed = 0
        for coro in asyncio.as_completed(tasks):
            result = await coro
            stats.add_result(result)
            completed += 1

            # Progress indicator
            status = "✓" if result.success else "✗"
            print(f"  [{completed}/{num_requests}] {status} {result.duration_seconds:.2f}s", end="")
            if not result.success:
                print(f" - {result.error_message[:50] if result.error_message else 'Unknown error'}", end="")
            print()

    return stats


def print_summary(all_stats: List[ServiceStats]):
    """Print a summary of all test results."""
    print("\n")
    print("=" * 80)
    print("LOAD TEST SUMMARY")
    print("=" * 80)
    print(f"\n{'Service':<15} {'Requests':<10} {'Success':<10} {'Failed':<10} {'Fail %':<10} {'Avg Time':<12} {'Min':<10} {'Max':<10}")
    print("-" * 97)

    total_requests = 0
    total_success = 0
    total_failed = 0

    for stats in all_stats:
        total_requests += stats.total_requests
        total_success += stats.successful
        total_failed += stats.failed

        min_dur = f"{stats.min_duration:.2f}s" if stats.min_duration != float('inf') else "N/A"
        max_dur = f"{stats.max_duration:.2f}s" if stats.max_duration > 0 else "N/A"
        avg_dur = f"{stats.avg_duration:.2f}s" if stats.avg_duration > 0 else "N/A"

        status = "✓" if stats.failure_rate == 0 else ("⚠" if stats.failure_rate < 10 else "✗")

        print(f"{status} {stats.service:<13} {stats.total_requests:<10} {stats.successful:<10} {stats.failed:<10} {stats.failure_rate:<9.1f}% {avg_dur:<12} {min_dur:<10} {max_dur:<10}")

        # Print unique errors if any
        if stats.errors:
            unique_errors = list(set(stats.errors))[:3]  # Show up to 3 unique errors
            for err in unique_errors:
                print(f"    └─ Error: {err}")

    print("-" * 97)
    overall_fail_rate = (total_failed / total_requests * 100) if total_requests > 0 else 0
    print(f"  {'TOTAL':<13} {total_requests:<10} {total_success:<10} {total_failed:<10} {overall_fail_rate:.1f}%")
    print()

    # Final verdict
    if overall_fail_rate == 0:
        print("✅ ALL TESTS PASSED - 0% failure rate")
    elif overall_fail_rate < 5:
        print(f"⚠️  MOSTLY PASSED - {overall_fail_rate:.1f}% failure rate (acceptable)")
    else:
        print(f"❌ TESTS FAILED - {overall_fail_rate:.1f}% failure rate (needs investigation)")

    print()


async def check_server_health(base_url: str):
    """Check if the server is running."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{base_url}/health", timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✓ Server is healthy: {data.get('status', 'unknown')}")
                    print(f"  Services: {', '.join(data.get('services', []))}")
                    return True
                else:
                    print(f"✗ Server returned status {response.status}")
                    return False
    except Exception as e:
        print(f"✗ Cannot connect to server at {base_url}: {e}")
        return False


async def main():
    parser = argparse.ArgumentParser(description="Load test HyperNiche services")
    parser.add_argument(
        "--requests", "-n",
        type=int,
        default=DEFAULT_REQUESTS,
        help=f"Number of requests per service (default: {DEFAULT_REQUESTS})",
    )
    parser.add_argument(
        "--concurrent", "-c",
        type=int,
        default=DEFAULT_CONCURRENT,
        help=f"Number of concurrent requests (default: {DEFAULT_CONCURRENT})",
    )
    parser.add_argument(
        "--service", "-s",
        choices=list(SERVICES.keys()),
        help="Test only a specific service",
    )
    parser.add_argument(
        "--base-url", "-u",
        default=API_BASE_URL,
        help=f"API base URL (default: {API_BASE_URL})",
    )

    args = parser.parse_args()

    # Update base URL if provided
    base_url = args.base_url

    print("=" * 80)
    print("HYPERNICHE SERVICES LOAD TEST")
    print("=" * 80)
    print(f"\nConfiguration:")
    print(f"  API URL: {base_url}")
    print(f"  Requests per service: {args.requests}")
    print(f"  Concurrent requests: {args.concurrent}")
    print(f"  Timeout per request: {REQUEST_TIMEOUT}s")
    print()

    # Check server health first
    print("Checking server health...")
    if not await check_server_health(base_url):
        print("\n❌ Server is not available. Please start the server first:")
        print(f"   cd python-backend && uvicorn api:app --reload --port 8000")
        sys.exit(1)

    # Determine which services to test
    if args.service:
        services_to_test = {args.service: SERVICES[args.service]}
    else:
        services_to_test = SERVICES

    # Run tests
    all_stats = []
    start_time = time.time()

    for service_name, service_config in services_to_test.items():
        stats = await test_service(
            service_name,
            service_config,
            args.requests,
            args.concurrent,
            base_url,
        )
        all_stats.append(stats)

    total_duration = time.time() - start_time

    # Print summary
    print_summary(all_stats)

    print(f"Total test duration: {total_duration:.1f}s")
    print(f"Timestamp: {datetime.now().isoformat()}")


if __name__ == "__main__":
    asyncio.run(main())
