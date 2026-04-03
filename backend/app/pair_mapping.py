"""Maps DEX pool pair names to their Binance (CEX) pair counterparts.

TLC tags use Binance pair names (e.g. RAY_USDT, SOL_USDT).
Pool-side tags use DEX pair names with fee suffix (e.g. RAY_WSOL(0.05%), WSOL_USDC(0.04%)).
"""

import re

# Token equivalences: treat these as the same underlying asset
TOKEN_EQUIVALENCES: dict[str, str] = {
    "WSOL": "SOL",
}

# Base asset -> Binance pair name
_CEX_PAIR_MAP: dict[str, str] = {
    "RAY": "RAY_USDT",
    "SOL": "SOL_USDT",
    "WSOL": "SOL_USDT",
    "JUP": "JUP_USDT",
    "WIF": "WIF_USDT",
    "PUMP": "PUMP_USDT",
    "KMNO": "KMNO_USDT",
    "WLFI": "WLFI_USDT",
}

# Full DEX pair -> Binance pair overrides
_FULL_PAIR_OVERRIDES: dict[str, str] = {
    "WSOL_USDC": "SOL_USDT",
    "WSOL_USDT": "SOL_USDT",
}

_FEE_SUFFIX_RE = re.compile(r"\([\d.]+%\)$")


def strip_fee_suffix(pair: str) -> str:
    return _FEE_SUFFIX_RE.sub("", pair)


def extract_fee(pair: str) -> str:
    m = _FEE_SUFFIX_RE.search(pair)
    return m.group(0) if m else ""


def get_base_asset(dex_pair: str) -> str:
    clean = strip_fee_suffix(dex_pair)
    parts = clean.split("_")
    return parts[0] if parts else clean


def dex_to_cex_pair(dex_pair: str) -> str | None:
    clean = strip_fee_suffix(dex_pair)
    if clean in _FULL_PAIR_OVERRIDES:
        return _FULL_PAIR_OVERRIDES[clean]
    base = get_base_asset(dex_pair)
    return _CEX_PAIR_MAP.get(base)


def get_cex_pairs_for_dex(dex_pair: str) -> list[str]:
    """Returns all CEX pairs needed for a DEX pair (main + extra)."""
    clean = strip_fee_suffix(dex_pair)
    parts = clean.split("_")
    pairs = []
    for part in parts:
        cex = _CEX_PAIR_MAP.get(part)
        if cex and cex not in pairs:
            pairs.append(cex)
    return pairs if pairs else []


def get_tokens(pair: str) -> set[str]:
    """Extract tokens from a pair name, expanding equivalences."""
    clean = strip_fee_suffix(pair)
    parts = clean.split("_")
    tokens = set()
    for p in parts:
        tokens.add(p)
        # Add equivalences both ways
        if p in TOKEN_EQUIVALENCES:
            tokens.add(TOKEN_EQUIVALENCES[p])
        for k, v in TOKEN_EQUIVALENCES.items():
            if v == p:
                tokens.add(k)
    return tokens


def is_related_pair(candidate_pair: str, selected_pair: str) -> bool:
    """Check if candidate_pair shares any tokens with selected_pair (with equivalences)."""
    selected_tokens = get_tokens(selected_pair)
    candidate_tokens = get_tokens(candidate_pair)
    return bool(selected_tokens & candidate_tokens)


def format_market_display(market: str, pair: str) -> str:
    """Format a market:pair for column header display."""
    fee = extract_fee(pair)
    clean = strip_fee_suffix(pair)
    if fee:
        return f"{market} ({clean} {fee.strip('()')})"
    return f"{market} ({clean})"
