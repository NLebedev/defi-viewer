"""Parse STRATEGY SEES OWN TRADE messages.

Format: Strategy got notified about own trade | {'trade': CexDexTrade(txid='...', pair=X, ...)}
Contains both successful and failed trades (successful=True/False).
"""

import re
from typing import Any

_FIELD_PATTERNS: dict[str, tuple[re.Pattern, type]] = {
    "txid": (re.compile(r"txid='([^']+)'"), str),
    "pair": (re.compile(r"(?<!\w)pair=(\w+)"), str),
    "market": (re.compile(r"market=(\w+)"), str),
    "successful": (re.compile(r"successful=(True|False)"), str),
    "gas_paid": (re.compile(r"(?<!\w)gas_paid=([0-9.eE+-]+)"), float),
    "gas_paid_usd": (re.compile(r"gas_paid_usd=([0-9.eE+-]+)"), float),
    "fee_paid": (re.compile(r"fee_paid=([0-9.eE+-]+)"), float),
    "fee_paid_usd": (re.compile(r"fee_paid_usd=([0-9.eE+-]+)"), float),
    "volume": (re.compile(r"(?<!\w)volume=([0-9.eE+-]+|None)"), str),
    "usd_volume": (re.compile(r"usd_volume=([0-9.eE+-]+)"), float),
    "price": (re.compile(r"(?<!\w)price=([0-9.eE+-]+|None)"), str),
    "side": (re.compile(r"(?<!\w)side=([0-9]+|None)"), str),
    "error_reason": (re.compile(r"error_reason='([^']*)'"), str),
    "strategy_id": (re.compile(r"strategy_id='([^']+)'"), str),
    "cid": (re.compile(r"(?<!\w)cid='([^']+)'"), str),
    "pool_address": (re.compile(r"pool_address=Pubkey\(\s*(\w+)"), str),
    "pool_fee": (re.compile(r"pool_fee=([0-9.eE+-]+)"), float),
    "slot": (re.compile(r"(?<!\w)slot=(\d+)"), int),
    "slot_delay": (re.compile(r"slot_delay=(\d+)"), int),
    "send_slot": (re.compile(r"send_slot=(\d+)"), int),
    "processed_slot": (re.compile(r"processed_slot=(\d+)"), int),
    "tried_to_cancel": (re.compile(r"tried_to_cancel=(True|False)"), str),
    "is_hedging": (re.compile(r"is_hedging=(True|False)"), str),
    "strategy_trigger": (re.compile(r"strategy_trigger=<StrategyRunTrigger\.(\w+):"), str),
}


def parse_own_trade(message: str) -> dict[str, Any] | None:
    if "CexDexTrade(" not in message:
        return None

    result: dict[str, Any] = {}
    for field, (pattern, conv) in _FIELD_PATTERNS.items():
        m = pattern.search(message)
        if m:
            raw = m.group(1)
            if raw == "None":
                result[field] = None
            elif conv == float:
                result[field] = float(raw)
            elif conv == int:
                result[field] = int(raw)
            elif field == "successful":
                result[field] = raw == "True"
            elif field in ("tried_to_cancel", "is_hedging"):
                result[field] = raw == "True"
            elif field == "side":
                result[field] = "BID" if raw == "0" else "ASK" if raw == "1" else raw
            else:
                result[field] = raw

    # Derive provider from cid prefix
    cid = result.get("cid", "")
    if cid and len(cid) > 2 and cid[1] == "_":
        prefix_map = {"R": "RPC", "J": "JITO", "A": "ASTRALANE"}
        result["provider"] = prefix_map.get(cid[0], "UNKNOWN")
        result["cid_base"] = cid[2:]
    else:
        result["provider"] = "UNKNOWN"
        result["cid_base"] = cid

    return result if result else None
