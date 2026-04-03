from fastapi import APIRouter, Query
from typing import Optional
from app.opensearch_client import get_client
from app.index_resolver import resolve_indices
from app.parsers.own_trade import parse_own_trade
from app.parsers.failed_trade import parse_failed_trade

router = APIRouter(prefix="/api", tags=["trades"])


@router.get("/trades")
def get_trades(
    hostname: str,
    start: str,
    end: str,
    pair: Optional[str] = None,
    successful: Optional[bool] = None,
):
    client = get_client()
    indices = resolve_indices(start, end)

    must_clauses = [
        {"term": {"hostname.keyword": hostname}},
        {
            "terms": {
                "tag.keyword": ["STRATEGY SEES OWN TRADE", "FAILED OWN TRADE"]
            }
        },
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

    body = {
        "query": {"bool": {"must": must_clauses}},
        "sort": [{"iso8601_time": "desc"}],
        "size": 10000,
    }

    resp = client.search(index=indices, body=body)
    hits = resp["hits"]["hits"]

    # Parse and deduplicate by txid
    # STRATEGY SEES OWN TRADE has richer data, so use it as primary
    trades_by_txid: dict[str, dict] = {}

    for hit in hits:
        src = hit["_source"]
        tag = src.get("tag", "")
        message = src.get("message", "")

        if tag == "STRATEGY SEES OWN TRADE":
            parsed = parse_own_trade(message)
        elif tag == "FAILED OWN TRADE":
            parsed = parse_failed_trade(message)
        else:
            continue

        if not parsed:
            continue

        parsed["timestamp"] = src.get("iso8601_time", "")
        parsed["pair_display"] = src.get("pair", "") or parsed.get("pair", "")
        parsed["market"] = parsed.get("market", "") or src.get("market", "")
        parsed["tag"] = tag

        txid = parsed.get("txid", "")
        if not txid:
            continue

        # Primary source wins (STRATEGY SEES OWN TRADE is richer)
        if txid not in trades_by_txid or tag == "STRATEGY SEES OWN TRADE":
            trades_by_txid[txid] = parsed

    trades = list(trades_by_txid.values())

    # Apply filters
    if pair:
        trades = [t for t in trades if pair in (t.get("pair_display", ""), t.get("pair", ""))]
    if successful is not None:
        trades = [t for t in trades if t.get("successful") == successful]

    # Sort by timestamp descending
    trades.sort(key=lambda t: t.get("timestamp", ""), reverse=True)

    return trades
