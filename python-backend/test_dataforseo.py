#!/usr/bin/env python3
"""
Test script to verify DataForSEO API credentials.
Run: python test_dataforseo.py
"""

import os
import sys
import base64
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv(".env.local")

def test_dataforseo():
    """Test DataForSEO API with a keyword data request."""
    login = os.getenv("DATAFORSEO_LOGIN")
    password = os.getenv("DATAFORSEO_PASSWORD")
    
    if not login:
        print("❌ DATAFORSEO_LOGIN not found in environment variables")
        print("   Check .env or .env.local file")
        return False
    
    if not password:
        print("❌ DATAFORSEO_PASSWORD not found in environment variables")
        print("   Check .env or .env.local file")
        return False
    
    print(f"✓ DATAFORSEO_LOGIN found: {login}")
    print(f"✓ DATAFORSEO_PASSWORD found: {'*' * 8}...{password[-4:]}")
    
    # Create Basic Auth header
    credentials = f"{login}:{password}"
    encoded = base64.b64encode(credentials.encode()).decode()
    
    url = "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live"
    headers = {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/json"
    }
    payload = [
        {
            "keywords": ["test keyword"],
            "location_code": 2840,  # United States
            "language_code": "en"
        }
    ]
    
    try:
        print("\n📡 Making test request to DataForSEO API...")
        response = httpx.post(url, headers=headers, json=payload, timeout=30)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            status_code = data.get("status_code")
            status_message = data.get("status_message")
            
            print(f"   API Status Code: {status_code}")
            print(f"   API Status Message: {status_message}")
            
            if status_code == 20000:
                print("✅ DataForSEO API is working!")
                
                # Check for task results
                tasks = data.get("tasks", [])
                if tasks:
                    task = tasks[0]
                    task_status = task.get("status_code")
                    task_message = task.get("status_message")
                    print(f"   Task Status: {task_status} - {task_message}")
                    
                    # Check for actual results
                    result = task.get("result", [])
                    if result:
                        keyword_data = result[0]
                        keyword = keyword_data.get("keyword", "N/A")
                        volume = keyword_data.get("search_volume", "N/A")
                        print(f"   Test keyword: '{keyword}' - Volume: {volume}")
                
                # Show cost info
                cost = data.get("cost", 0)
                print(f"   Request cost: ${cost}")
                
                return True
            elif status_code == 20100:
                print("✅ DataForSEO API credentials are valid!")
                print("   (Task queued or in progress)")
                return True
            elif status_code == 40100:
                print("❌ Authentication failed - Invalid credentials")
                print(f"   Message: {status_message}")
                return False
            elif status_code == 40200:
                print("❌ Payment required - Account has no credits")
                print(f"   Message: {status_message}")
                return False  # Credentials valid but no credits
            elif status_code == 40301:
                print("⚠️ Insufficient credits - Credentials valid but no balance")
                print(f"   Message: {status_message}")
                return True  # Credentials are valid
            else:
                print(f"⚠️ API returned status code: {status_code}")
                print(f"   Message: {status_message}")
                return status_code < 40000  # Success/Warning codes
                
        elif response.status_code == 401:
            print("❌ Authentication failed - Invalid credentials")
            print(f"   Response: {response.text[:200]}")
            return False
        elif response.status_code == 403:
            print("❌ Access forbidden - Check account status")
            print(f"   Response: {response.text[:200]}")
            return False
        else:
            print(f"❌ Unexpected HTTP status code: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
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
    print("DATAFORSEO API CREDENTIAL TEST")
    print("=" * 50)
    
    success = test_dataforseo()
    
    print("\n" + "=" * 50)
    if success:
        print("RESULT: ✅ DataForSEO credentials are VALID")
    else:
        print("RESULT: ❌ DataForSEO credentials are INVALID or missing")
    print("=" * 50)
    
    sys.exit(0 if success else 1)
