# Bitcoin-Native Product Ownership & Escrow Protocol

A lightweight, Bitcoin-aligned protocol for authenticating physical goods, preventing counterfeits, and enabling irreversible BTC-based resale with no human arbitration.

## 🎯 Core Philosophy

- **Bitcoin is the ONLY money** - All payments in BTC (on-chain and/or Lightning)
- **No blockchain bloat** - Append-only event log, NOT continuous block production
- **Deterministic & Final** - Like wire transfers: irreversible, no arbitration
- **Federated Trust** - M-of-N operator quorum, no single point of failure
- **Minimal Resources** - Operators earn fees only on successful settlements

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BITCOIN BLOCKCHAIN                        │
│  (Periodic Anchoring: Merkle Root of Event Log Committed)   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Anchor Tx
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              FEDERATED OPERATOR NETWORK (M-of-N)             │
│  • Validate state transitions                                │
│  • Co-sign events (quorum required)                          │
│  • Maintain append-only event log                            │
│  • Earn BTC fees on settlements                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Query/Submit Events
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATIONS                       │
│  • Verify quorum signatures locally                          │
│  • Validate state machine rules                              │
│  • Detect counterfeits/double-sells                          │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Installation

```bash
npm install
npm run build
```

### Run Demo

```bash
npm run dev
# or
ts-node examples/demo.ts
```

### Start Operator Node

```bash
npm run operator -- --port 3000 --data-dir ./operator-data
```

## 📦 Components

### 1. Operator Node

Federated nodes that validate and co-sign state transitions.

```typescript
import { OperatorNode, OperatorAPIServer } from 'bitcoin-ownership-protocol';

const config = {
  operatorId: 'operator-1',
  privateKey: '...',
  publicKey: '...',
  btcAddress: '...',
  port: 3000,
  peers: []
};

const quorum = { m: 3, n: 5 }; // 3-of-5 quorum

const node = new OperatorNode(config, quorum, './data');
await node.initialize();

const apiServer = new OperatorAPIServer(node, 3000);
await apiServer.start();
```

### 2. Manufacturer Issuer

Create and mint items with cryptographic proof of authenticity.

```typescript
import { ManufacturerIssuer } from 'bitcoin-ownership-protocol';

const manufacturer = new ManufacturerIssuer('Luxury Watch Co.');

const metadata = {
  model: 'Chronograph Elite X1',
  serialNumber: 'LWC-2024-001234',
  description: 'Limited edition luxury chronograph',
  imageUri: 'ipfs://QmXxxx...'
};

const mintEvent = manufacturer.createMintEvent(metadata, 5000);
```

### 3. Client Verifier

Scan and verify item authenticity with cryptographic handshake.

```typescript
import { ClientVerifier } from 'bitcoin-ownership-protocol';

const verifier = new ClientVerifier({ m: 3, n: 5 });
const scanResult = await verifier.scanItem(itemId, operators);

console.log(`Authentic: ${scanResult.isAuthentic}`);
console.log(`Manufacturer: ${scanResult.manufacturer.name}`);
console.log(`State: ${scanResult.currentState}`);
console.log(`Can Purchase: ${scanResult.canPurchase}`);
```

### 4. Sale Manager

Handle offers, escrow, and atomic settlements.

```typescript
import { SaleManager, MockPaymentAdapter } from 'bitcoin-ownership-protocol';

const paymentAdapter = new MockPaymentAdapter();
const saleManager = new SaleManager(paymentAdapter);

// Buyer creates offer
const offer = saleManager.createOffer(
  itemId,
  buyerWallet,
  buyerPrivateKey,
  50000000, // 0.5 BTC
  3600 // 1 hour expiry
);

// Seller accepts
const acceptance = saleManager.acceptOffer(offer, sellerWallet, sellerPrivateKey);

// Lock in escrow
const lockEvent = await saleManager.createEscrowLock(offer, acceptance, item, escrowFee);

// Buyer pays
const invoice = await saleManager.createPaymentInvoice(offer, escrowFee);
// ... payment happens ...

// Settle and transfer ownership
const paymentProof = await saleManager.verifyPayment(invoice.invoiceId);
const settleEvent = await saleManager.createSettlement(offer, lockEvent, paymentProof, settlementFee);
```

## 🔐 Security Features

### Prevents Double-Selling
- Item in `LOCKED_IN_ESCROW` cannot accept new offers
- State transition rules enforced by all operators
- Conflicting locks rejected by quorum

### Prevents Counterfeits
- Only verified manufacturers can mint items
- Manufacturer public key verified on every scan
- Event chain integrity checked cryptographically

### Prevents Replay Attacks
- Each event has unique height and timestamp
- Events reference previous event hash (chain)
- Operators reject duplicate event IDs

### Prevents Forged States
- M-of-N operator signatures required
- Clients verify signatures locally
- No single operator can lie about state

### Prevents Screenshot Fraud
- Ownership proof requires live signature
- Signatures include timestamp and nonce
- Cannot replay old signatures

## 🔄 State Machine

```
MINTED
  ├─→ ACTIVE_HELD (via ITEM_ASSIGNED)
  ├─→ IN_CUSTODY (via ITEM_MOVED_TO_CUSTODY)
  └─→ BURNED (via ITEM_BURNED)

ACTIVE_HELD
  ├─→ LOCKED_IN_ESCROW (via ITEM_LOCKED)
  ├─→ IN_CUSTODY (via ITEM_MOVED_TO_CUSTODY)
  └─→ BURNED (via ITEM_BURNED)

LOCKED_IN_ESCROW
  ├─→ ACTIVE_HELD (via ITEM_SETTLED - new owner)
  ├─→ ACTIVE_HELD (via ITEM_UNLOCKED_EXPIRED - same owner)
  └─→ BURNED (via ITEM_BURNED - manufacturer recall)

IN_CUSTODY
  ├─→ ACTIVE_HELD (via ITEM_ASSIGNED - returned to owner)
  └─→ BURNED (via ITEM_BURNED)

BURNED
  └─→ (terminal state)
```

## 💰 Fee Structure

1. **Registration Fee** - Manufacturer pays to register (one-time)
2. **Minting Fee** - Per item minted
3. **Escrow Fee** - Per sale initiated (refunded if expired)
4. **Settlement Fee** - Per successful sale (% of price)

### Fee Distribution

- **80%** to operator quorum (split equally)
- **15%** to protocol treasury
- **5%** reserved for Bitcoin anchoring

## 🔗 Bitcoin Anchoring

Periodic commitment of event log Merkle root to Bitcoin blockchain:

- **Trigger 1**: Every N events (e.g., 1000 events)
- **Trigger 2**: Every T hours (e.g., 24 hours)
- **Trigger 3**: On-demand for high-value items

```typescript
// OP_RETURN format
OP_RETURN <protocol_id> <merkle_root> <height_range>
```

## 📱 Scan Handshake Flow

When a buyer scans an item (QR/NFC):

1. **Query Operators** - Client queries multiple operators in parallel
2. **Verify Quorum** - Check M-of-N operators agree on state
3. **Verify Signatures** - Validate all operator signatures
4. **Verify Manufacturer** - Check issuer public key matches registry
5. **Verify State** - Validate event chain integrity
6. **Display Result** - Show authentication status and purchase eligibility

## 🛒 Sale Flow

### Phase 1: Offer Creation
Buyer scans item and creates signed offer with price and expiry.

### Phase 2: Seller Acceptance
Seller proves ownership via wallet signature and accepts offer.

### Phase 3: Escrow Lock
Operators validate and lock item (state → `LOCKED_IN_ESCROW`).

### Phase 4: Payment
System generates BTC invoice, buyer pays.

### Phase 5: Settlement (ATOMIC)
- BTC released to seller
- Item ownership transferred to buyer
- Fees distributed to operators
- All actions final and irreversible

### Phase 6: Expiry Handling
If payment not received before expiry, item auto-unlocks.

## 🔌 Payment Adapters

### Mock Adapter (Testing)
```typescript
import { MockPaymentAdapter } from 'bitcoin-ownership-protocol';
const adapter = new MockPaymentAdapter();
```

### Bitcoin RPC Adapter
```typescript
import { BitcoinRPCAdapter } from 'bitcoin-ownership-protocol';
const adapter = new BitcoinRPCAdapter(
  'http://localhost:8332',
  'rpcuser',
  'rpcpassword'
);
```

### Lightning Network Adapter
```typescript
import { LightningAdapter } from 'bitcoin-ownership-protocol';
const adapter = new LightningAdapter(
  'https://localhost:8080',
  'macaroon_hex'
);
```

## 🎯 Use Cases

- **Luxury Goods** - Watches, jewelry, handbags
- **Collectibles** - Art, memorabilia, limited editions
- **Equipment** - High-value machinery, tools
- **Warranties** - Extended warranty tracking
- **In-Person Resale** - Face-to-face transactions first
- **Shipping** - Optional integration with carrier tracking

## 🔍 Third-Party Authenticators (Optional Extension)

The protocol supports **optional** third-party authenticators who can provide independent verification of items:

### What Authenticators Provide

- **Independent Verification** - Expert examination and attestation
- **Confidence Signals** - Supplementary information for buyers
- **Multiple Opinions** - Get attestations from multiple experts
- **Non-Transferable** - Attestations bound to items, not owners

### What Authenticators Do NOT Do

- ❌ Do NOT grant ownership rights
- ❌ Do NOT affect payment flows
- ❌ Do NOT block or enable sales
- ❌ Do NOT change item state
- ❌ Are NOT required for transactions

### Example Usage

```typescript
import { AuthenticatorIssuer, ClientVerifier } from 'bitcoin-ownership-protocol';

// Authenticator creates attestation
const authenticator = new AuthenticatorIssuer('Swiss Watch Expert', 'Luxury Watches');
const attestation = authenticator.createAttestation(
  itemId,
  95,  // 95% confidence
  'Physical inspection and movement verification'
);

// Client scans item and sees attestations
const verifier = new ClientVerifier({ m: 3, n: 5 });
const scanResult = await verifier.scanItem(itemId, operators);

if (scanResult.attestations) {
  scanResult.attestations.forEach(att => {
    console.log(`${att.authenticator.name}: ${att.confidence}% confidence`);
    console.log(`Valid: ${att.isValid ? 'YES' : 'NO'}`);
  });
}
```

**See [AUTHENTICATORS.md](./AUTHENTICATORS.md) for complete documentation.**

## ⚠️ Limitations

### Current MVP Limitations

- **In-Person Sales** - Optimized for face-to-face transactions
- **QR Codes** - Can be copied (NFC upgrade planned)
- **Federated Trust** - Requires M honest operators
- **Payment Finality** - On-chain requires confirmations (Lightning instant)

### Threats NOT Mitigated

- **Physical Theft** - Protocol cannot prevent stealing physical item
- **Coercion** - Cannot prevent forced wallet signature
- **Quantum Computing** - ECDSA vulnerable (future: post-quantum crypto)
- **Legal Disputes** - No arbitration mechanism (by design)

## 🚧 Future Enhancements

1. **Cryptographic NFC Tags** - Tamper-evident, challenge-response auth
2. **Shipping Integration** - Escrow with carrier tracking
3. **Warranty Tracking** - Extend protocol for service records
4. **Privacy Upgrades** - Zero-knowledge ownership proofs
5. **Lightning Network** - Full integration for instant settlements
6. **Operator Bonding** - Economic penalties for misbehavior
7. **Mobile Apps** - iOS/Android clients with camera scanning

## 📚 API Reference

### Operator API

**Core Endpoints:**
```
GET  /health
GET  /api/operator/info
GET  /api/item/:itemId
GET  /api/item/:itemId/proof
GET  /api/item/:itemId/events
GET  /api/manufacturer/:manufacturerId
POST /api/event/submit
POST /api/event/propose
POST /api/event/sign
```

**Authenticator Endpoints (Optional Extension):**
```
GET  /api/authenticator/:authenticatorId
GET  /api/item/:itemId/attestations
```

### Event Types

**Core Events:**
- `MANUFACTURER_REGISTERED`
- `ITEM_MINTED`
- `ITEM_ASSIGNED`
- `ITEM_LOCKED`
- `ITEM_SETTLED`
- `ITEM_UNLOCKED_EXPIRED`
- `ITEM_MOVED_TO_CUSTODY`
- `ITEM_BURNED`

**Authenticator Events (Optional Extension):**
- `AUTHENTICATOR_REGISTERED`
- `ITEM_AUTHENTICATED`

## 🧪 Testing

```bash
npm test
```

## 📖 Documentation

- [Protocol Specification](./PROTOCOL_SPEC.md) - Full technical specification
- [Security Model](./SECURITY.md) - Threat model and security analysis
- [Authenticators Extension](./AUTHENTICATORS.md) - Third-party authentication system
- [Examples](./examples/) - Code examples and demos

## 🤝 Contributing

This is an MVP implementation. Contributions welcome for:

- NFC tag integration
- Lightning Network payment adapter
- Mobile client applications
- Operator bonding mechanisms
- Bitcoin anchoring automation

## 📄 License

MIT License - See LICENSE file for details

## 🔗 Resources

- [Bitcoin Core](https://bitcoin.org/)
- [Lightning Network](https://lightning.network/)
- [bitcoinjs-lib](https://github.com/bitcoinjs/bitcoinjs-lib)

## ⚡ Why This Matters

Traditional product authentication relies on:
- Centralized databases (single point of failure)
- Trusted third parties (rent-seeking intermediaries)
- Reversible payments (chargebacks, disputes)
- Human arbitrators (slow, expensive, biased)

**This protocol provides:**
- ✅ Cryptographic proof of authenticity
- ✅ Federated trust (no single point of failure)
- ✅ Bitcoin-native payments (final, irreversible)
- ✅ Deterministic state machine (no human arbitration)
- ✅ Client-side verification (zero trust)

**Result:** A system that behaves like Bitcoin itself - scarce, transferable, and final.

---

**Built with Bitcoin. For Bitcoin.**
