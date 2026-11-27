# Assessment Engine Architecture (`ASSESSMENT_ENGINE_ARCHITECTURE.md`)

```
[FastAPI Control Plane] -> [PostgreSQL: immutable run_plan_json] -> [Redis/RQ Worker]
                                                                            |
                                                                            v
                                                              [Trusted RunnerController]
                                                                            |
                                                                            v
                                                    [Restricted Runner: SafeCrawler (HTTPX)]
                                                      - URL Normalizer & Canonicalizer
                                                      - Scope Policy Gate (origin/host/port/path/GET-only)
                                                      - DNS/IP SSRF Validator & Manual Redirect Gate
                                                      - Bounded HTML Link & Form Metadata Extractor
                                                      - Bounded robots.txt & sitemap.xml Seed Parsers
                                                                            |
                                                                            v
                                                    [UrlInventory + DiscoverySource (PostgreSQL)]
```
