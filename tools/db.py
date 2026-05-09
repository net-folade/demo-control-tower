"""Supabase client helpers for the pipeline tools.

Every ingestion script imports `get_client()` and uses `upsert()` for idempotent
writes. Reads from `.env` at the repo root via python-dotenv.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable, Sequence

from dotenv import load_dotenv
from supabase import Client, create_client

_REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_REPO_ROOT / ".env")

_client: Client | None = None


def get_client() -> Client:
    """Return a singleton Supabase client authenticated with the service-role key."""
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_KEY"]
        _client = create_client(url, key)
    return _client


def upsert(
    table: str,
    rows: Sequence[dict],
    on_conflict: str | None = None,
    chunk_size: int = 500,
) -> int:
    """Insert or update rows in `table`.

    `on_conflict` is a comma-separated list of columns that form the
    unique/primary key for the upsert. Rows are sent in chunks to stay
    well under Supabase's request size limits.

    Returns the number of rows submitted.
    """
    if not rows:
        return 0

    client = get_client()
    total = 0
    for batch in _chunks(rows, chunk_size):
        query = client.table(table).upsert(list(batch), on_conflict=on_conflict)
        query.execute()
        total += len(batch)
    return total


def _chunks(seq: Sequence[dict], n: int) -> Iterable[Sequence[dict]]:
    for i in range(0, len(seq), n):
        yield seq[i : i + n]
