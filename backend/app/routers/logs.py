from fastapi import APIRouter, Query
from typing import Optional
from app.opensearch_client import get_client
from app.index_resolver import resolve_indices

router = APIRouter(prefix="/api", tags=["logs"])


@router.get("/logs")
def get_logs(
    hostname: str,
    start: str,
    end: str,
    pair: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
):
    client = get_client()
    indices = resolve_indices(start, end)

    must_clauses = [
        {"term": {"hostname.keyword": hostname}},
        {
            "range": {
                "iso8601_time": {
                    "gte": start,
                    "lte": end,
                    "format": "strict_date_optional_time_nanos",
                }
            }
        },
    ]

    if pair:
        must_clauses.append({"term": {"pair.keyword": pair}})
    if tag:
        must_clauses.append({"term": {"tag.keyword": tag}})
    if search:
        must_clauses.append({"match": {"message": search}})

    body = {
        "query": {"bool": {"must": must_clauses}},
        "sort": [{"iso8601_time": "asc"}],
        "size": 10000,
    }

    resp = client.search(index=indices, body=body)
    hits = resp["hits"]["hits"]

    return [
        {
            "timestamp": h["_source"].get("iso8601_time", ""),
            "tag": h["_source"].get("tag", ""),
            "loglevel": h["_source"].get("loglevel", ""),
            "message": h["_source"].get("message", ""),
            "pair": h["_source"].get("pair", ""),
            "market": h["_source"].get("market", ""),
        }
        for h in hits
    ]
