from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import expect, sync_playwright

BASE_URL = "http://127.0.0.1:8080"
USERNAME = "blackbox_admin"
PASSWORD = "blackbox123"


def run():
    with sync_playwright() as p:
        browser = p.firefox.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(15000)

        print("Navigating to UI...")
        page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        expect(page.get_by_text("Welcome back")).to_be_visible()

        page.get_by_placeholder("Enter your username").fill(USERNAME)
        page.get_by_placeholder("••••••••").fill(PASSWORD)
        page.get_by_role("button", name="Sign In").click()

        # Handle both successful redirect and auth failure for transparent reporting
        try:
            page.wait_for_url(f"{BASE_URL}/dashboard", timeout=6000)
        except PlaywrightTimeoutError:
            if page.get_by_text("Login Failed").is_visible():
                raise AssertionError("Seeded user login failed in UI. Check backend auth or seeded credentials.")
            raise

        expect(page.get_by_role("heading", name="Dashboard")).to_be_visible()
        page.get_by_role("link", name="Consumers").click()
        expect(page).to_have_url(f"{BASE_URL}/consumers")
        expect(page.get_by_text("Manage all registered consumers")).to_be_visible()

        page.get_by_role("button", name="Logout").click()
        expect(page).to_have_url(f"{BASE_URL}/login")
        browser.close()

if __name__ == "__main__":
    run()
