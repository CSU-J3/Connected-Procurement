"""Minimal stdlib HTTP helpers shared by the collectors (urllib only; no requests
dependency). User-Agent, timeout, and a small retry on transient failures."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any

USER_AGENT = "connected-procurement-collector (research; +https://connected-procurement.vercel.app)"
DEFAULT_TIMEOUT = 60


def _open(req: urllib.request.Request, timeout: int, retries: int):
    last: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return urllib.request.urlopen(req, timeout=timeout)
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
            # Do not retry on a definite 4xx (except 429); it will not get better.
            if isinstance(e, urllib.error.HTTPError) and e.code != 429 and 400 <= e.code < 500:
                raise
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
    assert last is not None
    raise last


def get_json(url: str, timeout: int = DEFAULT_TIMEOUT, retries: int = 2) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with _open(req, timeout, retries) as r:
        return json.loads(r.read())


def post_json(url: str, payload: dict, timeout: int = DEFAULT_TIMEOUT, retries: int = 2) -> Any:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"User-Agent": USER_AGENT, "Content-Type": "application/json", "Accept": "application/json"},
    )
    with _open(req, timeout, retries) as r:
        return json.loads(r.read())


def get_text(url: str, timeout: int = DEFAULT_TIMEOUT, retries: int = 2) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with _open(req, timeout, retries) as r:
        return r.read().decode("utf-8", "replace")


def get_bytes(url: str, timeout: int = DEFAULT_TIMEOUT, retries: int = 2) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with _open(req, timeout, retries) as r:
        return r.read()
