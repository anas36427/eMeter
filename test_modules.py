import urllib.request
import json
import urllib.error

def test_endpoint(name, url, method="GET", data=None):
    print(f"Testing {name} Module...")
    try:
        req = urllib.request.Request(url, method=method)
        req.add_header('Content-Type', 'application/json')
        if data:
            req.data = json.dumps(data).encode('utf-8')
        
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            try:
                json_data = json.loads(body)
                print(f"✅ SUCCESS: {status} OK")
                print(f"   Data Preview: {str(json_data)[:100]}...\n")
            except json.JSONDecodeError:
                print(f"❌ ERROR: Response is not JSON.\n   Body: {body[:100]}\n")
    except urllib.error.HTTPError as e:
        print(f"⚠️ HTTP ERROR: {e.code} {e.reason}")
        print(f"   Response: {e.read().decode('utf-8')[:100]}...\n")
    except Exception as e:
        print(f"❌ FATAL ERROR: {str(e)}\n")

if __name__ == "__main__":
    print("=======================================")
    print("      E-METER API INTEGRATION TEST      ")
    print("=======================================\n")
    
    BASE_URL = "http://127.0.0.1:8001/api"
    
    test_endpoint("Consumers List", f"{BASE_URL}/consumers/")
    test_endpoint("Bills List", f"{BASE_URL}/bills/")
    test_endpoint("Readings List", f"{BASE_URL}/readings/")
    test_endpoint("Dashboard Stats", f"{BASE_URL}/dashboard-stats/")
    test_endpoint("Billing Settings", f"{BASE_URL}/settings/")
