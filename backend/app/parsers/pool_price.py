"""Parse POOL PRICE CHANGE messages.

Format: price=X, fixed_fee_rate=Y, variable_fee_rate=Z
Example: price=0.008158832651363841, fixed_fee_rate=0.0005, variable_fee_rate=0.0
"""

import re
from typing import Any

_POOL_PRICE_RE = re.compile(
    r"price=([0-9.eE+-]+),\s*fixed_fee_rate=([0-9.eE+-]+),\s*variable_fee_rate=([0-9.eE+-]+)"
)


def parse_pool_price(message: str) -> dict[str, Any] | None:
    m = _POOL_PRICE_RE.search(message)
    if not m:
        return None
    price = float(m.group(1))
    fixed_fee = float(m.group(2))
    var_fee = float(m.group(3))
    total_fee = fixed_fee + var_fee
    return {
        "pool_price": price,
        "fixed_fee_rate": fixed_fee,
        "variable_fee_rate": var_fee,
        "fee_adj_bid": price * (1 - total_fee),
        "fee_adj_ask": price * (1 + total_fee),
    }
