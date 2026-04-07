from playwright.sync_api import sync_playwright
import json
import sys
import time

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4321"
PAGES = [
    ("home", "/"),
    ("post", "/posts/fuwari/"),
    ("phantom", "/phantom-tank/"),
    ("cover", "/cover/"),
    ("files", "/files/"),
    ("nat", "/nat-check/"),
]

results = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, path in PAGES:
        page = browser.new_page(viewport={"width": 1440, "height": 960})
        metrics = {}

        start = time.perf_counter()
        page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        load_ms = round((time.perf_counter() - start) * 1000, 2)

        page.wait_for_timeout(1500)

        perf = page.evaluate(
            """
            () => {
              const nav = performance.getEntriesByType('navigation')[0];
              const resources = performance.getEntriesByType('resource');
              const scripts = resources.filter((item) => item.initiatorType === 'script');
              const styles = resources.filter((item) => item.initiatorType === 'link' || item.name.endsWith('.css'));
              const transferSize = resources.reduce((sum, item) => sum + (item.transferSize || 0), 0);
              const scriptTransferSize = scripts.reduce((sum, item) => sum + (item.transferSize || 0), 0);
              return {
                domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
                loadEventEnd: nav ? nav.loadEventEnd : null,
                jsRequests: scripts.length,
                cssRequests: styles.length,
                totalRequests: resources.length,
                transferSize,
                scriptTransferSize,
              };
            }
            """
        )

        metrics.update(perf)
        metrics["name"] = name
        metrics["path"] = path
        metrics["loadMs"] = load_ms
        results.append(metrics)
        page.close()

    browser.close()

print(json.dumps(results, ensure_ascii=False, indent=2))
