"""Parse POOL PRICE FETCH messages (primary source for Slot/Block column).

Format: Price updated via geyser: old_price=X, new_price=Y, slot=Z | {...}
Example: Price updated via geyser: old_price=78.993, new_price=78.993, slot=410638082 | {...}

Note: There's also a "Found N stale pools" subtype which should be skipped.
"""

import re
from typing import Any

_GEYSER_RE = re.compile(
    r"Price updated via geyser:.*?new_price=([0-9.eE+-]+),\s*slot=(\d+)"
)


def parse_pool_price_fetch(message: str) -> dict[str, Any] | None:
    if "Price updated via geyser" not in message:
        return None
    m = _GEYSER_RE.search(message)
    if not m:
        return None
    return {
        "new_price": float(m.group(1)),
        "slot": int(m.group(2)),
    }
