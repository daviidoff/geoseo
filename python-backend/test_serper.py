#!/usr/bin/env python3
"""
Test script to verify Serper API credentials.
Run: python test_serper.py
"""

import os
import sys
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv(".env.local")

def test_serper():
    """Test Serper API with a simple search query."""
    api_key = os.getenv("SERPER_API_KEY")
    
    if not api_key:
        print("❌ SERPER_API_KEY not found in environment variables")
        print("   Check .env or .env.local file")
        return False
    
    print(f"✓ SERPER_API_KEY found: {api_key[:8]}...{api_key[-4:]}")
    
    url = "https://google.serper.dev/search"
    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json"
    }
    payload = {
        "q": "test query",
        "num": 1
    }
    
    try:
        print("\n📡 Making test request to Serper API...")
        response = httpx.post(url, headers=headers, json=payload, timeout=30)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            organic = data.get("organic", [])
            print(f"✅ Serper API is working!")
            print(f"   Received {len(organic)} organic results")
            if organic:
                print(f"   First result: {organic[0].get('title', 'N/A')[:50]}...")
            return True
        elif response.status_code == 401:
            print("❌ Authentication failed - Invalid API key")
            print(f"   Response: {response.text}")
            return False
        elif response.status_code == 403:
            print("❌ Access forbidden - Check API key permissions")
            print(f"   Response: {response.text}")
            return False
        elif response.status_code == 429:
            print("⚠️ Rate limit exceeded - API key is valid but quota exhausted")
            print(f"   Response: {response.text}")
            return True  # Key is valid, just rate limited
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except httpx.ConnectError as e:
        print(f"❌ Connection error: {e}")
        return False
    except httpx.TimeoutException:
        print("❌ Request timed out")
        return False
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("SERPER API CREDENTIAL TEST")
    print("=" * 50)
    
    success = test_serper()
    
    print("\n" + "=" * 50)
    if success:
        print("RESULT: ✅ Serper credentials are VALID")
    else:
        print("RESULT: ❌ Serper credentials are INVALID or missing")
    print("=" * 50)
    
    sys.exit(0 if success else 1)
