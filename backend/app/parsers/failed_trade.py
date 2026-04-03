"""Parse FAILED OWN TRADE messages.

Format: [Helius WS] Usd gas paid: X, gas paid: Y | {'txid': '...', 'cid': None, 'coin_balance_changes': {SOL: -Z}, 'error_reason': '...', 'slot': N}

Note: cid is always None in this tag.
Note: coin_balance_changes uses unquoted Python keys ({SOL: -5.714e-06}) - use regex, not ast.literal_eval.
"""

import re
from typing import Any

_PREAMBLE_RE = re.compile(
    r"Usd gas paid:\s*([0-9.eE+-]+),\s*gas paid:\s*([0-9.eE+-]+)"
)
_TXID_RE = re.compile(r"'txid':\s*'([^']+)'")
_ERROR_RE = re.compile(r"'error_reason':\s*'([^']*)'")
_SLOT_RE = re.compile(r"'slot':\s*(\d+)")
_BALANCE_RE = re.compile(r"'coin_balance_changes':\s*\{(\w+):\s*([0-9.eE+-]+)\}")


def parse_failed_trade(message: str) -> dict[str, Any] | None:
    result: dict[str, Any] = {"successful": False}

    preamble = _PREAMBLE_RE.search(message)
    if preamble:
        result["gas_paid_usd"] = float(preamble.group(1))
        result["gas_paid"] = float(preamble.group(2))

    txid = _TXID_RE.search(message)
    if txid:
        result["txid"] = txid.group(1)
    else:
        return None  # txid is required

    error = _ERROR_RE.search(message)
    if error:
        result["error_reason"] = error.group(1)

    slot = _SLOT_RE.search(message)
    if slot:
        result["slot"] = int(slot.group(1))

    balance = _BALANCE_RE.search(message)
    if balance:
        result["coin_balance_changes"] = {balance.group(1): float(balance.group(2))}

    # These fields are not present in FAILED OWN TRADE
    result["side"] = None
    result["strategy_id"] = None
    result["slot_delay"] = None
    result["provider"] = None
    result["cid"] = None
    result["cid_base"] = None
    result["volume"] = None
    result["price"] = None

    return result
