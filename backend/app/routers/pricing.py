from fastapi import APIRouter
from app.opensearch_client import get_client
from app.index_resolver import resolve_indices
from app.pair_mapping import is_related_pair, strip_fee_suffix, format_market_display
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

ALL_TAGS = [
    "TLC",
    "POOL PRICE CHANGE",
    "POOL PRICE FETCH",
    "STRATEGY SEND ORDER",
    "PUBLIC TRADE",
    "STRATEGY SEES OWN TRADE",
    "FAILED OWN TRADE",
]


def _market_key(market: str, pair: str) -> str:
    return f"{market}:{pair}"


def _parse_and_classify(tag: str, message: str, src: dict) -> dict | None:
    """Parse event and return with market context."""
    market = src.get("market", "") or ""
    pair = src.get("pair", "") or ""

    if tag == "TLC":
        parsed = parse_tlc(message)
        if not parsed:
            return None
        return {
            "type": "book",
            "market": market or "BINANCE_SPOT",
            "pair": pair,
            "bid_price": parsed["bid_price"],
            "bid_vol": parsed["bid_vol"],
            "ask_price": parsed["ask_price"],
            "ask_vol": parsed["ask_vol"],
        }

    elif tag == "POOL PRICE CHANGE":
        parsed = parse_pool_price(message)
        if not parsed:
            return None
        return {
            "type": "book",
            "market": market,
            "pair": pair,
            "bid_price": parsed["fee_adj_bid"],
            "ask_price": parsed["fee_adj_ask"],
        }

    elif tag == "POOL PRICE FETCH":
        parsed = parse_pool_price_fetch(message)
        if not parsed:
            return None
        return {
            "type": "slot",
            "market": market,
            "pair": pair,
            "slot": parsed["slot"],
        }

    elif tag == "STRATEGY SEND ORDER":
        parsed = parse_strategy_order(message)
        if not parsed:
            return None
        result = {
            "type": "theo",
            "market": market,
            "pair": pair,
            "bid_price": parsed.get("bid_theo"),
            "ask_price": parsed.get("ask_theo"),
        }
        if parsed.get("cid_base"):
            result["cid_base"] = parsed["cid_base"]
        return result

    elif tag == "PUBLIC TRADE":
        parsed = parse_public_trade(message)
        if not parsed:
            return None
        side = parsed["side"]
        vol = parsed["volume"]
        price = parsed["price"]
        return {
            "type": "trade",
            "market": market,
            "pair": pair,
            "trade": f"{side} {vol:.4f}@{price}",
            "slot": parsed.get("slot"),
        }

    elif tag in ("STRATEGY SEES OWN TRADE", "FAILED OWN TRADE"):
        if tag == "STRATEGY SEES OWN TRADE":
            parsed = parse_own_trade(message)
        else:
            parsed = parse_failed_trade(message)
        if not parsed:
            return None
        txid = parsed.get("txid", "")[:8]
        side = parsed.get("side", "") or ""
        err = parsed.get("error_reason", "")
        trade_str = f"TRADE {side} {txid}..."
        if err:
            trade_str += f" [{err}]"
        return {
            "type": "own_trade",
            "market": market,
            "pair": pair,
            "trade": trade_str,
            "successful": parsed.get("successful"),
        }

    return None


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

    # Query ALL relevant tags for this hostname+time, no pair filter
    # For a 60s window this is ~400 events total — very manageable
    body = {
        "query": {
            "bool": {
                "must": [
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
                    {"terms": {"tag.keyword": ALL_TAGS}},
                ]
            }
        },
        "sort": [{"iso8601_time": "asc"}],
        "size": 10000,
    }

    resp = client.search(index=indices, body=body)
    hits = resp["hits"]["hits"]

    # Parse all events, filter to related pairs
    events = []
    for hit in hits:
        src = hit["_source"]
        tag = src.get("tag", "")
        message = src.get("message", "")
        event = _parse_and_classify(tag, message, src)
        if not event:
            continue
        event_pair = event.get("pair", "")
        if not event_pair:
            continue
        # Filter: only keep pairs related to the selected pair
        if not is_related_pair(event_pair, pair):
            continue
        event["timestamp"] = src.get("iso8601_time", "")
        event["tag"] = tag
        events.append(event)

    # Discover all market:pair combos
    market_keys: dict[str, dict] = {}
    for ev in events:
        mk = _market_key(ev["market"], ev["pair"])
        if mk not in market_keys:
            market_keys[mk] = {
                "key": mk,
                "market": ev["market"],
                "pair": ev["pair"],
                "display": format_market_display(ev["market"], ev["pair"]),
            }

    # Sort markets: BINANCE first, then THEO, then DEX markets alphabetically
    def market_sort_key(m: dict) -> tuple:
        market = m["market"]
        if "BINANCE" in market:
            return (0, market, m["pair"])
        if m.get("_is_theo"):
            return (1, market, m["pair"])
        return (2, market, m["pair"])

    markets = sorted(market_keys.values(), key=market_sort_key)

    if raw:
        return {"markets": markets, "rows": events}

    # Event-sourcing: build rows with per-market values
    # State is per market-key
    state: dict[str, dict] = {}
    seen_order_cids: set[str] = set()
    slot_state: int | None = None
    rows: list[dict] = []

    for ev in events:
        mk = _market_key(ev["market"], ev["pair"])
        ev_type = ev["type"]

        # Deduplicate STRATEGY SEND ORDER by cid base
        if ev["tag"] == "STRATEGY SEND ORDER":
            cid_base = ev.get("cid_base")
            if cid_base:
                if cid_base in seen_order_cids:
                    continue
                seen_order_cids.add(cid_base)

        if mk not in state:
            state[mk] = {}

        changed = False
        mk_state = state[mk]

        if ev_type == "book":
            for key in ("bid_price", "bid_vol", "ask_price", "ask_vol"):
                if key in ev and ev[key] is not None and mk_state.get(key) != ev[key]:
                    mk_state[key] = ev[key]
                    changed = True

        elif ev_type == "theo":
            for key in ("bid_price", "ask_price"):
                if key in ev and ev[key] is not None and mk_state.get(key) != ev[key]:
                    mk_state[key] = ev[key]
                    changed = True

        elif ev_type == "slot":
            if ev.get("slot") and slot_state != ev["slot"]:
                slot_state = ev["slot"]
                changed = True

        elif ev_type in ("trade", "own_trade"):
            trade_str = ev.get("trade", "")
            if mk_state.get("trade") != trade_str:
                mk_state["trade"] = trade_str
                changed = True
            if ev.get("slot") and slot_state != ev.get("slot"):
                slot_state = ev["slot"]
                changed = True

        if changed:
            # Build row: collect current state for all markets
            row: dict = {
                "timestamp": ev["timestamp"],
                "slot": slot_state,
                "values": {},
            }
            for m_key in market_keys:
                ms = state.get(m_key, {})
                if ms:
                    row["values"][m_key] = {**ms}

            rows.append(row)

            # Reset transient trade fields
            if ev_type in ("trade", "own_trade"):
                mk_state.pop("trade", None)

    # Add theo as a separate market column
    # Collect theo data from STRATEGY SEND ORDER events
    theo_key = None
    for ev in events:
        if ev["tag"] == "STRATEGY SEND ORDER":
            mk = _market_key(ev["market"], ev["pair"])
            # Rename the market key to indicate it's theo
            theo_display_key = f"THEO:{ev['pair']}"
            if theo_display_key not in market_keys:
                market_keys[theo_display_key] = {
                    "key": theo_display_key,
                    "market": "THEO",
                    "pair": ev["pair"],
                    "display": f"THEO ({strip_fee_suffix(ev['pair'])})",
                }
                markets.append(market_keys[theo_display_key])
            # Move theo values from the original market key to THEO key
            for row in rows:
                vals = row.get("values", {})
                if mk in vals and "bid_price" in vals[mk]:
                    # Check if this was a theo update by looking at the market
                    pass  # Already handled above
            break

    # Actually, let me simplify: STRATEGY SEND ORDER already gets its own market key
    # since its market field is the pool market (e.g., RAYDIUM_CLMM) but it represents theo.
    # Let me post-process to rename STRATEGY SEND ORDER entries to THEO.

    # Re-process: separate theo from pool book data
    # Reset and redo with proper theo separation
    state2: dict[str, dict] = {}
    seen_order_cids2: set[str] = set()
    slot_state2: int | None = None
    rows2: list[dict] = []
    market_keys2: dict[str, dict] = {}

    for ev in events:
        mk = _market_key(ev["market"], ev["pair"])
        ev_type = ev["type"]

        # For theo type, use a separate THEO market key
        if ev_type == "theo":
            mk = f"THEO:{ev['pair']}"
            if mk not in market_keys2:
                market_keys2[mk] = {
                    "key": mk,
                    "market": "THEO",
                    "pair": ev["pair"],
                    "display": f"THEO ({strip_fee_suffix(ev['pair'])})",
                }
            cid_base = ev.get("cid_base")
            if cid_base:
                if cid_base in seen_order_cids2:
                    continue
                seen_order_cids2.add(cid_base)
        else:
            if mk not in market_keys2:
                market_keys2[mk] = {
                    "key": mk,
                    "market": ev["market"],
                    "pair": ev["pair"],
                    "display": format_market_display(ev["market"], ev["pair"]),
                }

        if mk not in state2:
            state2[mk] = {}

        changed = False
        mk_state = state2[mk]

        if ev_type in ("book", "theo"):
            for key in ("bid_price", "bid_vol", "ask_price", "ask_vol"):
                if key in ev and ev[key] is not None and mk_state.get(key) != ev[key]:
                    mk_state[key] = ev[key]
                    changed = True

        elif ev_type == "slot":
            if ev.get("slot") and slot_state2 != ev["slot"]:
                slot_state2 = ev["slot"]
                changed = True

        elif ev_type in ("trade", "own_trade"):
            trade_str = ev.get("trade", "")
            if mk_state.get("trade") != trade_str:
                mk_state["trade"] = trade_str
                mk_state["_is_own"] = ev_type == "own_trade"
                mk_state["_successful"] = ev.get("successful")
                changed = True
            if ev.get("slot") and slot_state2 != ev.get("slot"):
                slot_state2 = ev["slot"]
                changed = True

        if changed:
            row: dict = {
                "timestamp": ev["timestamp"],
                "slot": slot_state2,
                "values": {},
            }
            for m_key, ms in state2.items():
                if ms:
                    row["values"][m_key] = {**ms}
            rows2.append(row)

            if ev_type in ("trade", "own_trade"):
                mk_state.pop("trade", None)
                mk_state.pop("_is_own", None)
                mk_state.pop("_successful", None)

    # Sort markets: BINANCE first, then pools, then THEO last
    def sort_key(m: dict) -> tuple:
        market = m["market"]
        if "BINANCE" in market:
            return (0, market, m["pair"])
        if market == "THEO":
            return (9, market, m["pair"])
        return (1, market, m["pair"])

    sorted_markets = sorted(market_keys2.values(), key=sort_key)

    return {"markets": sorted_markets, "rows": rows2}
