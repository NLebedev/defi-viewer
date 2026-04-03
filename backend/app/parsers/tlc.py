"""Parse TLC (Binance order book) messages.

Format: [bid_price, bid_vol]@[ask_price, ask_vol] | {'update_id': ..., ...}
Example: [0.644, 5672.1]@[0.645, 1597.2] | {'update_id': 2372620186, ...}
"""

import re
from typing import Any

_TLC_RE = re.compile(
    r"\[([0-9.eE+-]+),\s*([0-9.eE+-]+)\]@\[([0-9.eE+-]+),\s*([0-9.eE+-]+)\]"
)


def parse_tlc(message: str) -> dict[str, Any] | None:
    m = _TLC_RE.search(message)
    if not m:
        return None
    return {
        "bid_price": float(m.group(1)),
        "bid_vol": float(m.group(2)),
        "ask_price": float(m.group(3)),
        "ask_vol": float(m.group(4)),
    }
