"""Bounded, sanitized output capture for untrusted runner stdout/stderr."""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.logging import sanitize_log_string

_ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")


def sanitize_runner_output(raw_text: str, max_bytes: int = 4_194_304) -> tuple[str, bool]:
    """Strip ANSI escape sequences, sanitize secrets/control chars, and cap output size."""
    cleaned = _ANSI_ESCAPE_RE.sub("", raw_text)
    encoded = cleaned.encode("utf-8", errors="replace")
    truncated = len(encoded) > max_bytes
    if truncated:
        cleaned = encoded[:max_bytes].decode("utf-8", errors="ignore")
    cleaned = sanitize_log_string(cleaned, max_len=max_bytes)
    return cleaned, truncated


@dataclass
class BoundedOutputCapture:
    max_bytes: int = 4_194_304
    truncated: bool = False

    def read_stream(self, stream: object) -> str:
        if stream is None:
            return ""
        raw = stream.read(self.max_bytes + 1)  # type: ignore[attr-defined]
        if isinstance(raw, bytes):
            raw_text = raw.decode("utf-8", errors="replace")
        else:
            raw_text = str(raw)
        if len(raw_text.encode("utf-8", errors="replace")) > self.max_bytes:
            self.truncated = True
            encoded = raw_text.encode("utf-8", errors="replace")[: self.max_bytes]
            return encoded.decode("utf-8", errors="ignore")
        return raw_text
