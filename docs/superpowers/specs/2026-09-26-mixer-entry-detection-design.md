# Real mixer-entry detection — design

Status: decided by user directive ("fix these limitations... decide all on your own"), 2026-09-26.
No brainstorming Q&A — user explicitly asked not to be consulted. Scope decided by controller,
documented here for the record per this project's standing practice of writing a spec before a plan.

## What this actually fixes

`docs/SCOPE.md` has claimed since day one: "KAIZEN can flag entry into a mixer." **This was never
implemented — grep of the entire backend confirms zero mixer-related code exists anywhere.**
This is a real gap between documented and actual behavior, not a hypothetical improvement.

## What this does NOT fix, and why that's correct, not a shortfall

Mixer opacity ("cannot see through one") is a real cryptographic property of a well-designed
mixer, not an engineering gap this project can close with more code. Tornado Cash's whole design
goal is breaking the on-chain link between a deposit and a withdrawal via a zk-SNARK anonymity
set — there is no legitimate timing/amount heuristic that reliably de-anonymizes it (unlike a
bridge, which publishes real 1:1 deposit/withdrawal correlation signals that make
`find_bridge_links()` a legitimate heuristic). Building a fake "we can see through the mixer"
feature would be dishonest and would misdirect an actual investigation. This spec explicitly
does not attempt it. `docs/SCOPE.md`'s existing "Following funds through mixers beyond flagging
that the trail enters one" out-of-scope line stays correct and unchanged.

## Real, verified mixer contract addresses

Independently verified via direct Etherscan fetch (not a search-summary or doc-site prose,
following this project's own established "primary source, not aggregator claims" discipline —
a prior research pass this same session already caught a doc-site fabricating a specific-looking
address):

| Denomination | Address | Verified |
|---|---|---|
| 0.1 ETH | `0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc` | Etherscan public name tag "Tornado.Cash: 0.1 ETH" |
| 1 ETH | `0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936` | Confirmed directly: verified contract, name tag "Tornado.Cash: 1 ETH" |
| 10 ETH | `0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF` | Etherscan public name tag "Tornado.Cash: 10 ETH" |
| 100 ETH | `0xA160cdAB225685dA1d56aa342Ad8841c3b53f291` | Confirmed directly: verified contract, name tag "Tornado.Cash: 100 ETH", holds ~236,600 ETH |

**Important, current fact** (verified via WebSearch against Treasury/legal press sources, not
assumed from training-data memory): Tornado Cash was OFAC-sanctioned in August 2022, then
**delisted in March 2025** following a federal appeals court ruling (*Van Loon v. Treasury*).
As of this writing (2026-09-26) these addresses are **not currently OFAC-sanctioned**. They are
listed here purely as known, real, verified mixer protocol contracts — this feature does not
claim or depend on current sanctions status, and the module docstring says so explicitly to
avoid this exact class of stale-fact error resurfacing later.

Ethereum only. No TRON-native equivalent with a comparable single-contract-address anonymity
pool exists at this project's verification bar; Bitcoin mixing services are typically off-chain
custodial services with no canonical contract address to register. This mirrors the same
honest per-chain scoping already established for bridge detection.

## Architecture

New module `backend/app/mixers/registry.py`, structurally identical to the (already-reviewed,
already-shipped) `app/bridge/registry.py` pattern:

```python
@dataclass(frozen=True)
class MixerContract:
    name: str
    chain: str
    contract_address: str
    source_url: str

KNOWN_MIXERS: list[MixerContract] = [...]  # the 4 entries above

def is_mixer_contract(address: str, chain: str) -> MixerContract | None: ...
```

`tracer.py`'s `trace()` gains one more check, unconditional (no opt-in parameter needed, unlike
bridge crossing — this makes no new chain-API call, it only checks a popped address against a
static registry before the existing fetch): when the address about to be processed matches
`is_mixer_contract(address, active_client.chain)`, append a `TraceHop` with a new, honest
`stop_reason="entered_mixer"` and stop there — no fetch, no further BFS from this address.

`traces.py` gains: a new `_STOP_REASON_PLAIN_ENGLISH["entered_mixer"]` string ("This wallet sent
the money into a cryptocurrency mixing service, which is specifically designed to hide where
money goes next — we cannot trace beyond this point"), and the same candidates-filter exclusion
bridge contracts already got (`is_mixer_contract(h.wallet_address, h.chain) is None`) — a mixer
contract has enormous numbers of distinct depositors by design and must never be evaluated as a
fake exchange collection wallet.

## Testing/acceptance

- Full existing suite stays green.
- Unit tests: `is_mixer_contract` lookup (case-insensitive per Ethereum's own convention),
  tracer stop behavior (a hop into a known mixer stops with `entered_mixer`, no further hops
  follow from it, no chain-API call is made for that address).
- Integration test: a real trace whose money enters a known mixer address correctly stops there
  with the plain-English reason, and the mixer address never appears as a reported exchange.
- `docs/SCOPE.md`'s mixer line updated from aspirational to actually-shipped, unchanged framing
  on what remains impossible (seeing through it).
