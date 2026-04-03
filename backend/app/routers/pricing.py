from fastapi import APIRouter, Query
from typing import Optional
from app.opensearch_client import get_client
from app.index_resolver import resolve_indices
from app.pair_mapping import dex_to_cex_pair, get_cex_pairs_for_dex
from app.parsers import (
    parse_tlc,
    parse_pool_price,
    parse_pool_price_fetch,
    parse_strategy_order,
    parse_public_trade,
    parse_own_trade,
    parse_failed_trade,
)

router = APIRouter(prefix="/api", tags=["pricing"])

# Tags queried for the pricing table
POOL_TAGS = [
    "POOL PRICE CHANGE",
    "POOL PRICE FETCH",
    "STRATEGY SEND ORDER",
    "PUBLIC TRADE",
    "STRATEGY SEES OWN TRADE",
    "FAILED OWN TRADE",
]


def _build_query(hostname: str, start: str, end: str, dex_pair: str):
    """Build a bool query that fetches pool-side tags by DEX pair and TLC by CEX pair."""
    time_range = {
        "range": {
            "iso8601_time": {
                "gte": start,
                "lte": end,
                "format": "strict_date_optional_time_nanos",
            }
        }
    }
    hostname_filter = {"term": {"hostname.keyword": hostname}}

    # Pool-side query: filter by DEX pair
    pool_query = {
        "bool": {
            "must": [
                hostname_filter,
                time_range,
                {"terms": {"tag.keyword": POOL_TAGS}},
                {"term": {"pair.keyword": dex_pair}},
            ]
        }
    }

    # TLC query: filter by Binance pair(s)
    cex_pairs = get_cex_pairs_for_dex(dex_pair)
    if cex_pairs:
        tlc_query = {
            "bool": {
                "must": [
                    hostname_filter,
                    time_range,
                    {"term": {"tag.keyword": "TLC"}},
                    {"terms": {"pair.keyword": cex_pairs}},
                ]
            }
        }
        return {"bool": {"should": [pool_query, tlc_query], "minimum_should_match": 1}}

    return pool_query


def _parse_event(tag: str, message: str) -> dict | None:
    """Parse a log event based on its tag and return structured column data."""
    if tag == "TLC":
        return parse_tlc(message)
    elif tag == "POOL PRICE CHANGE":
        return parse_pool_price(message)
    elif tag == "POOL PRICE FETCH":
        return parse_pool_price_fetch(message)
    elif tag == "STRATEGY SEND ORDER":
        return parse_strategy_order(message)
    elif tag == "PUBLIC TRADE":
        return parse_public_trade(message)
    elif tag == "STRATEGY SEES OWN TRADE":
        parsed = parse_own_trade(message)
        if parsed:
            parsed["_type"] = "own_trade"
        return parsed
    elif tag == "FAILED OWN TRADE":
        parsed = parse_failed_trade(message)
        if parsed:
            parsed["_type"] = "failed_trade"
        return parsed
    return None


def _update_state(state: dict, tag: str, parsed: dict) -> bool:
    """Update running state dict with parsed event data. Returns True if any value changed."""
    changed = False

    if tag == "TLC":
        for key in ("bid_price", "bid_vol", "ask_price", "ask_vol"):
            if key in parsed and state.get(key) != parsed[key]:
                state[key] = parsed[key]
                changed = True

    elif tag == "POOL PRICE CHANGE":
        for key in ("pool_price", "fee_adj_bid", "fee_adj_ask"):
            if key in parsed and state.get(key) != parsed[key]:
                state[key] = parsed[key]
                changed = True

    elif tag == "POOL PRICE FETCH":
        if "slot" in parsed and state.get("slot") != parsed["slot"]:
            state["slot"] = parsed["slot"]
            changed = True

    elif tag == "STRATEGY SEND ORDER":
        for key in ("bid_theo", "ask_theo"):
            if key in parsed and state.get(key) != parsed[key]:
                state[key] = parsed[key]
                changed = True

    elif tag == "PUBLIC TRADE":
        trade_str = f"{parsed.get('side', '')} {parsed.get('volume', '')}@{parsed.get('price', '')}"
        if state.get("pool_trade") != trade_str:
            state["pool_trade"] = trade_str
            changed = True
        if "slot" in parsed and state.get("slot") != parsed["slot"]:
            state["slot"] = parsed["slot"]
            changed = True

    elif tag in ("STRATEGY SEES OWN TRADE", "FAILED OWN TRADE"):
        txid = parsed.get("txid", "")
        side = parsed.get("side", "")
        err = parsed.get("error_reason", "")
        own_str = f"{side or ''} {txid[:8]}{'...' if len(txid) > 8 else ''}"
        if err:
            own_str += f" [{err}]"
        if state.get("own_trade") != own_str:
            state["own_trade"] = own_str
            state["own_trade_detail"] = parsed
            changed = True

    return changed


@router.get("/pricing")
def get_pricing(
    hostname: str,
    pair: str,
    start: str,
    end: str,
    raw: bool = False,
):
    client = get_client()
    indices = resolve_indices(start, end)
    query = _build_query(hostname, start, end, pair)

    body = {
        "query": query,
        "sort": [{"iso8601_time": "asc"}],
        "size": 10000,
    }

    resp = client.search(index=indices, body=body)
    hits = resp["hits"]["hits"]

    if raw:
        # Return every event as its own row
        rows = []
        for hit in hits:
            src = hit["_source"]
            tag = src.get("tag", "")
            parsed = _parse_event(tag, src.get("message", ""))
            if parsed:
                rows.append({
                    "timestamp": src.get("iso8601_time", ""),
                    "tag": tag,
                    "pair": src.get("pair", ""),
                    **parsed,
                })
        return rows

    # Event-sourcing deduplication
    state: dict = {}
    rows: list[dict] = []
    seen_order_cids: set[str] = set()

    for hit in hits:
        src = hit["_source"]
        tag = src.get("tag", "")
        message = src.get("message", "")

        # Deduplicate STRATEGY SEND ORDER by cid base
        if tag == "STRATEGY SEND ORDER":
            parsed = parse_strategy_order(message)
            if parsed and parsed.get("cid_base"):
                if parsed["cid_base"] in seen_order_cids:
                    continue
                seen_order_cids.add(parsed["cid_base"])
        else:
            parsed = _parse_event(tag, message)

        if not parsed:
            continue

        if _update_state(state, tag, parsed):
            rows.append({
                "timestamp": src.get("iso8601_time", ""),
                "slot": state.get("slot"),
                "bid_price": state.get("bid_price"),
                "bid_vol": state.get("bid_vol"),
                "ask_price": state.get("ask_price"),
                "ask_vol": state.get("ask_vol"),
                "pool_price": state.get("pool_price"),
                "fee_adj_bid": state.get("fee_adj_bid"),
                "fee_adj_ask": state.get("fee_adj_ask"),
                "bid_theo": state.get("bid_theo"),
                "ask_theo": state.get("ask_theo"),
                "pool_trade": state.get("pool_trade"),
                "own_trade": state.get("own_trade"),
            })
            # Reset transient fields after emitting
            if tag == "PUBLIC TRADE":
                state.pop("pool_trade", None)
            if tag in ("STRATEGY SEES OWN TRADE", "FAILED OWN TRADE"):
                state.pop("own_trade", None)
                state.pop("own_trade_detail", None)

    return rows
