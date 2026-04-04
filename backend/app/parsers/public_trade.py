"""Parse PUBLIC TRADE messages.

Format: BUY/SELL volume @ price USD VOL: X CU_LIMIT: X CU_PRICE: X TRADER: X SLOT: X TXID: X POOL_ADDRESS: X
Example: BUY 293.21 @ 0.00227 USD VOL: 52.63 CU_LIMIT: 47577 CU_PRICE: 0 TRADER: MfDu... SLOT: 410638206 TXID: 4wwi... POOL_ADDRESS: D6Nd...
"""

import re
from typing import Any

_PUBLIC_TRADE_RE = re.compile(
    r"(BUY|SELL)\s+([0-9.eE+-]+)\s+@\s+([0-9.eE+-]+)\s+"
    r"USD VOL:\s+([0-9.eE+-]+)\s+"
    r"CU_LIMIT:\s+(\d+)\s+"
    r"CU_PRICE:\s+(\S+)\s+"
    r"TRADER:\s+(\S+)\s+"
    r"SLOT:\s+(\d+)\s+"
    r"TXID:\s+(\S+)\s+"
    r"POOL_ADDRESS:\s+(\S+)"
)


def parse_public_trade(message: str) -> dict[str, Any] | None:
    m = _PUBLIC_TRADE_RE.search(message)
    if not m:
        return None
    cu_price_raw = m.group(6)
    cu_price = None if cu_price_raw == "None" else int(cu_price_raw) if cu_price_raw.isdigit() else cu_price_raw
    return {
        "side": m.group(1),
        "volume": float(m.group(2)),
        "price": float(m.group(3)),
        "usd_volume": float(m.group(4)),
        "cu_limit": int(m.group(5)),
        "cu_price": cu_price,
        "trader": m.group(7),
        "slot": int(m.group(8)),
        "txid": m.group(9),
        "pool_address": m.group(10),
    }
