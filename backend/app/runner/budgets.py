from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class CrawlBudgets:
    """Authoritative runner execution limits enforced independently of the UI."""

    max_crawl_depth: int
    max_requests: int
    per_host_rate_rps: float
    concurrency: int
    max_wall_clock_seconds: int
    max_response_bytes: int = 2_097_152


@dataclass
class BudgetTracker:
    """Tracks request count, rate pacing, wall-clock duration, and stop reason."""

    budgets: CrawlBudgets
    start_monotonic: float = field(default_factory=time.monotonic)
    requests_sent: int = 0
    _last_request_at: float | None = None
    stop_reason: str | None = None

    def elapsed_seconds(self) -> float:
        return time.monotonic() - self.start_monotonic

    def check_before_request(self, depth: int) -> tuple[bool, str | None]:
        if depth > self.budgets.max_crawl_depth:
            return False, "BUDGET_DEPTH_EXCEEDED"
        if self.requests_sent >= self.budgets.max_requests:
            self.stop_reason = "BUDGET_REQUESTS_EXHAUSTED"
            return False, self.stop_reason
        if self.elapsed_seconds() >= self.budgets.max_wall_clock_seconds:
            self.stop_reason = "BUDGET_DURATION_EXCEEDED"
            return False, self.stop_reason
        return True, None

    def pace_delay_seconds(self) -> float:
        """Compute required sleep interval to obey per_host_rate_rps."""
        if self.budgets.per_host_rate_rps <= 0:
            return 0.0
        min_interval = 1.0 / self.budgets.per_host_rate_rps
        if self._last_request_at is None:
            return 0.0
        elapsed = time.monotonic() - self._last_request_at
        return max(0.0, min_interval - elapsed)

    def record_request_dispatched(self) -> None:
        self._last_request_at = time.monotonic()
        self.requests_sent += 1

