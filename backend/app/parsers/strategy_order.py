"""Parse STRATEGY SEND ORDER messages.

Extracts from the state string:
- LAST THEOS: (bid_theo, ask_theo)
- POOLS: [bid_pool, ask_pool]
- GAS ADJ. POOLS: [bid, ask]
- LAST MAIN BEST PRICES: (bid, ask)
- LAST MAIN EXTRA BEST PRICES: (bid, ask)

Also extracts side/price/volume from preamble:
Format: [OrderProvider.X] BID/ASK volume@price | {...}

Note: Same order produces 3 events (RPC/JITO/ASTRALANE) - deduplicate by cid base.
"""

import re
from typing import Any

_THEOS_RE = re.compile(r"LAST THEOS:\s*\(([0-9.eE+-]+),\s*([0-9.eE+-]+)\)")
_POOLS_RE = re.compile(r"\|POOLS:\s*\[([0-9.eE+-]+),\s*([0-9.eE+-]+)\]")
_GAS_ADJ_RE = re.compile(r"GAS ADJ\. POOLS:\s*\[([0-9.eE+-]+),\s*([0-9.eE+-]+)\]")
_MAIN_PRICES_RE = re.compile(
    r"LAST MAIN BEST PRICES:\s*\(([0-9.eE+-]+),\s*([0-9.eE+-]+)\)"
)
_MAIN_EXTRA_RE = re.compile(
    r"LAST MAIN EXTRA BEST PRICES:\s*\(([0-9.eE+-]+),\s*([0-9.eE+-]+)\)"
)
_PREAMBLE_RE = re.compile(
    r"\[OrderProvider\.(\w+)\]\s*(BID|ASK)\s+([0-9.eE+-]+)@([0-9.eE+-]+)"
)
_CID_RE = re.compile(r"cid='([^']+)'")


def _extract_pair(pattern: re.Pattern, text: str) -> tuple[float, float] | None:
    m = pattern.search(text)
    if not m:
        return None
    return float(m.group(1)), float(m.group(2))


def parse_strategy_order(message: str) -> dict[str, Any] | None:
    result: dict[str, Any] = {}

    preamble = _PREAMBLE_RE.search(message)
    if preamble:
        result["provider"] = preamble.group(1)
        result["side"] = preamble.group(2)
        result["volume"] = float(preamble.group(3))
        result["price"] = float(preamble.group(4))

    cid_match = _CID_RE.search(message)
    if cid_match:
        cid = cid_match.group(1)
        result["cid"] = cid
        # Strip provider prefix (R_/J_/A_) to get base cid for deduplication
        result["cid_base"] = cid[2:] if len(cid) > 2 and cid[1] == "_" else cid

    theos = _extract_pair(_THEOS_RE, message)
    if theos:
        result["bid_theo"], result["ask_theo"] = theos

    pools = _extract_pair(_POOLS_RE, message)
    if pools:
        result["pool_bid"], result["pool_ask"] = pools

    gas_adj = _extract_pair(_GAS_ADJ_RE, message)
    if gas_adj:
        result["gas_adj_pool_bid"], result["gas_adj_pool_ask"] = gas_adj

    main_prices = _extract_pair(_MAIN_PRICES_RE, message)
    if main_prices:
        result["main_bid"], result["main_ask"] = main_prices

    main_extra = _extract_pair(_MAIN_EXTRA_RE, message)
    if main_extra:
        result["main_extra_bid"], result["main_extra_ask"] = main_extra

    return result if result else None
