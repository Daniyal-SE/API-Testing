# Assessment Engine Decisions (`ASSESSMENT_ENGINE_DECISIONS.md`)

1. **Reuse `app/runner/crawler.py` (`SafeCrawler`):** Rather than duplicating the crawler under `app/assessment/url_discovery/`, we preserve the working `SafeCrawler` in `app/runner/` and add `app/runner/seed_parsers.py` (`robots.txt` & `sitemap.xml`) plus `app/assessment/__init__.py` for Semester 8 extension boundaries.
2. **Page-Based Pagination Retained:** Existing FastAPI `GET /api/v1/url-inventory` uses `page` + `pageSize` (default `25`, max `100` via `settings.max_page_size`) matching the React frontend contract; cursor pagination is documented as a non-breaking future enhancement if needed.
3. **No Headless Browser (Playwright/Selenium):** Semester 7 discovery uses HTTPX + BeautifulSoup static HTML parsing; JS-rendered SPA route discovery is a documented limitation.
