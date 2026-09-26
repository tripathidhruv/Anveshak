from datetime import datetime, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.chains.http_client import AdaptiveHttpClient

ESPLORA_BASE = "https://blockstream.info/api"
SATS_PER_BTC = Decimal(10) ** 8

# Esplora's confirmed-history page size: `/address/:a/txs` returns the newest ~50
# mempool txs plus the first 25 confirmed ones; `/address/:a/txs/chain/:last_seen_txid`
# returns 25 confirmed txs per page, continuing from just before `last_seen_txid`.
CONFIRMED_PAGE_SIZE = 25
# Generous but bounded page cap (25 * 10 = 250 confirmed records) to avoid an
# unbounded loop against a wallet with years of history.
MAX_PAGES = 10

class BitcoinChainClient:
    chain = "bitcoin"

    def __init__(self, http: AdaptiveHttpClient | None = None):
        self._http = http or AdaptiveHttpClient()

    def get_transfers(self, address: str, since: datetime | None = None) -> list[Transfer]:
        """Fetch and normalize UTXO transactions from Esplora.

        Paginates through confirmed history via Esplora's `/txs/chain/:last_seen_txid`
        cursor: the first page comes from `/address/:a/txs` (newest mempool + first 25
        confirmed), and each subsequent page continues from the oldest confirmed txid
        seen so far, stopping once a page has fewer than a full page of confirmed
        transactions (meaning we've reached the oldest history) or the page cap is hit.

        Esplora's address-history endpoints (`/address/:a/txs` and
        `/address/:a/txs/chain/:last_seen_txid`, per Blockstream/esplora's own API.md)
        take no query parameters at all -- pagination is exclusively by `last_seen_txid`
        cursor, and there is no `since`/timestamp/block-height equivalent to bound what
        the server returns (verified directly against the upstream API docs, not assumed
        -- this is the deliberate mirror of Task F7's mistake elsewhere: don't guess an
        API's contract, check it). Unlike TronGrid, there is no server-side time-window
        optimization available here to add; `since` remains a client-side post-fetch
        filter only (below), same as before this task.

        Args:
            address: Bitcoin address to fetch transfers for.
            since: Optional minimum timestamp filter (applied post-fetch -- no server-side
                equivalent exists in Esplora's API, see above).

        Returns:
            List of Transfer objects, sorted ascending by timestamp.
        """
        response = self._http.get(f"{ESPLORA_BASE}/address/{address}/txs")
        response.raise_for_status()
        page = response.json()
        all_txs: list[dict] = list(page)
        # Only confirmed txs count toward "is this a full page" — the first page's
        # mempool transactions are unbounded/unrelated to the confirmed-history cursor
        # and would otherwise make a short confirmed page look full (or vice versa).
        confirmed = [tx for tx in page if tx.get("status", {}).get("confirmed")]

        pages_fetched = 1
        while len(confirmed) == CONFIRMED_PAGE_SIZE and pages_fetched < MAX_PAGES:
            last_seen_txid = confirmed[-1]["txid"]
            response = self._http.get(f"{ESPLORA_BASE}/address/{address}/txs/chain/{last_seen_txid}")
            response.raise_for_status()
            page = response.json()
            if not page:
                break
            all_txs.extend(page)
            confirmed = [tx for tx in page if tx.get("status", {}).get("confirmed")]
            pages_fetched += 1

        transfers: list[Transfer] = []
        for tx in all_txs:
            transfers.extend(self._normalize_tx(tx, address))
        if since is not None:
            transfers = [t for t in transfers if t.timestamp >= since]
        return sorted(transfers, key=lambda t: t.timestamp)

    @staticmethod
    def _normalize_tx(tx: dict, address: str) -> list[Transfer]:
        """Normalize a single Esplora transaction into zero or more Transfer objects.

        UTXO normalization (heuristic, with limitations documented for trace attribution):

        1. If `address` appears in the transaction inputs (via prevout addresses):
           - This is an OUTGOING transfer from the address.
           - Emit one Transfer per output address that is NOT also an input address.
           - Rationale: in a change-producing tx, the sender often routes change back to
             themselves; skipping these self-change outputs prevents double-counting.
           - Edge case: if a sender deliberately sends to an address they also control
             elsewhere in the same tx, this heuristic will skip it. Document in limitations.

        2. If `address` appears only in the transaction outputs (not inputs):
           - This is an INCOMING transfer to the address.
           - Emit exactly ONE Transfer for the whole transaction, using the first input
             address (in the record's own original order) as a deterministic representative
             sender.
           - Rationale: per Bitcoin's common-input-ownership convention, all inputs of a
             single transaction are (almost always) controlled by the same owner, so a
             multi-input transaction is one real payer, not N — emitting one Transfer per
             distinct input address would both multiply the received amount by the input
             count and inflate "distinct payer" counts on an ordinary self-consolidation
             transaction.
           - If there are no resolvable input addresses (e.g. a coinbase-like record), emit
             nothing for this transaction.
           - Set raw["multi_input"] = True if there are multiple distinct input addresses;
             the detector layer uses this to treat multi-input txs cautiously (they may be
             mixing transactions where the causal relationship is weaker).

        3. Unconfirmed txs are skipped (return empty list).

        Args:
            tx: Esplora transaction record (with prevout inline on all inputs).
            address: The address we're filtering for.

        Returns:
            List of Transfer objects (0, 1, or more).

        Raises:
            ValueError: If the transaction record is malformed (missing required fields,
                       wrong types, etc.), with the tx id included in the message.
        """
        tx_id = tx.get("txid", "<unknown>")
        try:
            # Only emit transfers from confirmed transactions.
            if not tx.get("status", {}).get("confirmed"):
                return []

            ts = datetime.fromtimestamp(tx["status"]["block_time"], tz=timezone.utc)

            # Extract input addresses from prevout records (Esplora includes these inline).
            vin_addresses = [v["prevout"]["scriptpubkey_address"]
                            for v in tx.get("vin", []) if v.get("prevout")]
            vout = tx.get("vout", [])

            # Flag multi-input txs for the detector layer: if there are multiple distinct
            # input addresses, set multi_input=True so mixing/consolidation logic can
            # apply extra caution when attributing funds.
            multi_input = len(set(vin_addresses)) > 1
            out: list[Transfer] = []

            if address in vin_addresses:
                # OUTGOING: address is a sender. Emit one Transfer per output address
                # that is NOT also an input address (skip self-change).
                for v in vout:
                    to_addr = v.get("scriptpubkey_address")
                    if not to_addr or to_addr in vin_addresses:
                        # Skip outputs to addresses that also appear as inputs
                        # (these are likely change outputs going back to the sender).
                        continue
                    out.append(Transfer(
                        tx_hash=tx["txid"],
                        chain="bitcoin",
                        from_address=address,
                        to_address=to_addr,
                        amount=Decimal(v["value"]) / SATS_PER_BTC,
                        asset="BTC",
                        timestamp=ts,
                        fee=Decimal("0"),
                        raw={**tx, "multi_input": multi_input},
                    ))
            elif any(v.get("scriptpubkey_address") == address for v in vout):
                # INCOMING: address is a recipient (appears only in outputs).
                # Sum every output paying `address` — a tx can pay the same address in more
                # than one vout entry, and taking only the first would silently understate
                # the amount received.
                recv_value = sum(v["value"] for v in vout if v.get("scriptpubkey_address") == address)
                if vin_addresses:
                    # Emit exactly ONE Transfer for this transaction, using the first input
                    # address as a representative sender -- per Bitcoin's common-input-
                    # ownership convention, every input of a single transaction is (almost
                    # always) controlled by the same owner, so a multi-input transaction is
                    # one real payer, not N. Emitting one Transfer per distinct input address
                    # (the old behavior) both multiplied the received amount by the input
                    # count and inflated "distinct payer" counts on an ordinary
                    # self-consolidation transaction into looking like several real payers.
                    out.append(Transfer(
                        tx_hash=tx["txid"],
                        chain="bitcoin",
                        from_address=vin_addresses[0],
                        to_address=address,
                        amount=Decimal(recv_value) / SATS_PER_BTC,
                        asset="BTC",
                        timestamp=ts,
                        fee=Decimal("0"),
                        raw={**tx, "multi_input": multi_input},
                    ))
            return out
        except (KeyError, TypeError, AttributeError) as exc:
            raise ValueError(
                f"Malformed Esplora transaction record (txid={tx_id}): {exc!r}"
            ) from exc
