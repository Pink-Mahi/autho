# Bitcoin-Native Product Ownership & Escrow Protocol
## Version 1.0.0 - MVP Specification

---

## 1. PHILOSOPHY & PRINCIPLES

### Core Tenets
- **Bitcoin is the ONLY money**: All payments in BTC (on-chain and/or Lightning)
- **No blockchain bloat**: Append-only event log, NOT continuous block production
- **Deterministic & Final**: Like wire transfers - irreversible, no arbitration
- **Federated Trust**: M-of-N operator quorum, no single point of failure
- **Minimal Resources**: Operators earn fees only on successful settlements
- **Cryptographic Verification**: Clients verify everything locally

---

## 2. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                    BITCOIN BLOCKCHAIN                        │
│  (Periodic Anchoring: Merkle Root of Event Log Committed)   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Anchor Tx
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              FEDERATED OPERATOR NETWORK (5-of-9)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Operator │  │ Operator │  │ Operator │  │ Operator │   │
│  │    1     │  │    2     │  │    3     │  │   ...9   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                               │
│  • Validate state transitions                                │
│  • Co-sign events (M-of-N quorum)                           │
│  • Maintain append-only event log                           │
│  • Earn BTC fees on settlements                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Query/Submit Events
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATIONS                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Buyer Scan  │  │   Seller    │  │Manufacturer │        │
│  │  Handshake  │  │   Wallet    │  │   Portal    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                               │
│  • Verify quorum signatures locally                          │
│  • Validate state machine rules                             │
│  • Detect counterfeits/double-sells                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. TRUST MODEL

### Federated Operators
- **Quorum Requirement**: M-of-N signatures (e.g., 5-of-9)
- **Independence**: Operators run by different entities (exchanges, manufacturers, auditors)
- **Incentive Alignment**: Earn BTC fees only on successful settlements
- **No Single Point of Failure**: M-1 operators can fail/lie without breaking system
- **Slashing**: Operators caught signing conflicting states lose reputation (future: bond)

### Bitcoin Anchoring
- **Periodic Commitment**: Every N events or T hours, commit Merkle root to Bitcoin
- **Immutable History**: Once anchored, event log becomes part of Bitcoin's security
- **Proof of Freshness**: Clients can verify state is recent and not stale
- **No Continuous Mining**: Only anchor when economically justified

### Client-Side Verification
- **Zero Trust**: Clients verify all signatures and state transitions locally
- **Quorum Check**: Reject responses without M-of-N operator signatures
- **State Machine**: Validate transitions follow protocol rules
- **Manufacturer Registry**: Verify issuer public key matches registry

---

## 4. DATA STRUCTURES

### 4.1 Manufacturer Registry

```typescript
interface Manufacturer {
  manufacturerId: string;        // Unique ID (hash of initial registration)
  name: string;                  // Brand name
  issuerPublicKey: string;       // Secp256k1 public key (Bitcoin-compatible)
  status: ManufacturerStatus;    // ACTIVE | SUSPENDED | REVOKED
  registeredAt: number;          // Unix timestamp
  registrationTxHash?: string;   // Bitcoin tx hash if anchored
  metadataUri?: string;          // Optional: IPFS/web link to brand info
}

enum ManufacturerStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  REVOKED = "REVOKED"
}
```

### 4.2 Item Model

```typescript
interface Item {
  itemId: string;                // Globally unique (hash of minting event)
  manufacturerId: string;        // Foreign key to manufacturer
  metadataHash: string;          // SHA256 of item metadata (model, serial, etc.)
  currentState: ItemState;       // Current lifecycle state
  currentOwnerWallet: string;    // Truncated/hashed for privacy (full in events)
  mintedAt: number;              // Unix timestamp
  lastEventHash: string;         // Hash of most recent event
  lastEventHeight: number;       // Logical height in event log
}

enum ItemState {
  MINTED = "MINTED",             // Created but not assigned
  ACTIVE_HELD = "ACTIVE_HELD",   // Owned, not for sale
  LOCKED_IN_ESCROW = "LOCKED_IN_ESCROW",  // Pending sale
  IN_CUSTODY = "IN_CUSTODY",     // Manufacturer/service center vault
  BURNED = "BURNED"              // Destroyed/recalled
}
```

### 4.3 Event Types

All events share a common structure:

```typescript
interface BaseEvent {
  eventId: string;               // SHA256(canonical serialization)
  eventType: EventType;
  itemId: string;                // Subject of event
  height: number;                // Logical sequence number
  timestamp: number;             // Unix timestamp
  previousEventHash: string;     // Hash chain linkage
  actorSignature: string;        // Signature of actor (manufacturer/seller/buyer)
  operatorSignatures: OperatorSignature[];  // M-of-N quorum
  anchorTxHash?: string;         // Bitcoin tx if anchored
}

interface OperatorSignature {
  operatorId: string;
  publicKey: string;
  signature: string;             // Signs eventId
}

enum EventType {
  MANUFACTURER_REGISTERED = "MANUFACTURER_REGISTERED",
  ITEM_MINTED = "ITEM_MINTED",
  ITEM_ASSIGNED = "ITEM_ASSIGNED",
  ITEM_LOCKED = "ITEM_LOCKED",
  ITEM_SETTLED = "ITEM_SETTLED",
  ITEM_UNLOCKED_EXPIRED = "ITEM_UNLOCKED_EXPIRED",
  ITEM_MOVED_TO_CUSTODY = "ITEM_MOVED_TO_CUSTODY",
  ITEM_BURNED = "ITEM_BURNED"
}
```

#### Specific Event Payloads

```typescript
interface ManufacturerRegisteredEvent extends BaseEvent {
  eventType: EventType.MANUFACTURER_REGISTERED;
  manufacturerId: string;
  name: string;
  issuerPublicKey: string;
  registrationFeeSats: number;   // BTC fee paid
}

interface ItemMintedEvent extends BaseEvent {
  eventType: EventType.ITEM_MINTED;
  manufacturerId: string;
  metadataHash: string;
  mintingFeeSats: number;
}

interface ItemAssignedEvent extends BaseEvent {
  eventType: EventType.ITEM_ASSIGNED;
  ownerWallet: string;           // Full wallet address
  ownerSignature: string;        // Proof of acceptance
}

interface ItemLockedEvent extends BaseEvent {
  eventType: EventType.ITEM_LOCKED;
  offerId: string;               // Unique offer ID
  sellerWallet: string;
  buyerWallet: string;
  priceSats: number;
  expiryTimestamp: number;       // Auto-unlock after this
  escrowFeeSats: number;
}

interface ItemSettledEvent extends BaseEvent {
  eventType: EventType.ITEM_SETTLED;
  offerId: string;
  buyerWallet: string;
  priceSats: number;
  paymentProof: PaymentProof;
  settlementFeeSats: number;
}

interface ItemUnlockedExpiredEvent extends BaseEvent {
  eventType: EventType.ITEM_UNLOCKED_EXPIRED;
  offerId: string;
  expiryTimestamp: number;
}

interface ItemMovedToCustodyEvent extends BaseEvent {
  eventType: EventType.ITEM_MOVED_TO_CUSTODY;
  custodianId: string;           // Manufacturer or authorized service center
  reason: string;                // "REPAIR" | "RECALL" | "WARRANTY"
}

interface ItemBurnedEvent extends BaseEvent {
  eventType: EventType.ITEM_BURNED;
  reason: string;                // "DESTROYED" | "RECALLED" | "COUNTERFEIT"
  burnProof?: string;            // Optional: photo/video hash
}
```

### 4.4 Payment Proof

```typescript
interface PaymentProof {
  paymentType: "ONCHAIN" | "LIGHTNING";
  txHash?: string;               // For on-chain
  paymentHash?: string;          // For Lightning
  preimage?: string;             // For Lightning
  amountSats: number;
  confirmations?: number;        // For on-chain
  verifiedAt: number;
}
```

---

## 5. STATE MACHINE

### Valid State Transitions

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
  └─→ BURNED (via ITEM_BURNED - only if manufacturer recalls)

IN_CUSTODY
  ├─→ ACTIVE_HELD (via ITEM_ASSIGNED - returned to owner)
  └─→ BURNED (via ITEM_BURNED)

BURNED
  └─→ (terminal state)
```

### Transition Rules

1. **ITEM_MINTED**: Only by verified manufacturer (ACTIVE status)
2. **ITEM_ASSIGNED**: Requires owner wallet signature accepting ownership
3. **ITEM_LOCKED**: 
   - Current state must be ACTIVE_HELD
   - Requires seller wallet signature (must match currentOwnerWallet)
   - Expiry must be future timestamp
4. **ITEM_SETTLED**:
   - Current state must be LOCKED_IN_ESCROW
   - Requires valid payment proof
   - Payment amount must match locked price
   - Must occur before expiry
5. **ITEM_UNLOCKED_EXPIRED**:
   - Current state must be LOCKED_IN_ESCROW
   - Current timestamp must be > expiryTimestamp
   - Automatic (no signature required)
6. **ITEM_MOVED_TO_CUSTODY**:
   - Requires manufacturer signature
   - Cannot move LOCKED items (must expire/settle first)
7. **ITEM_BURNED**:
   - Requires manufacturer signature
   - Irreversible

---

## 6. CANONICAL HASHING

All hashes use **SHA256** with deterministic serialization.

### Event Hash Calculation

```typescript
function calculateEventHash(event: BaseEvent): string {
  const canonical = {
    eventType: event.eventType,
    itemId: event.itemId,
    height: event.height,
    timestamp: event.timestamp,
    previousEventHash: event.previousEventHash,
    // Include event-specific fields in sorted order
    ...sortedEventPayload(event)
  };
  
  // Serialize to JSON with sorted keys, no whitespace
  const serialized = JSON.stringify(canonical, Object.keys(canonical).sort());
  return sha256(serialized);
}
```

### Item ID Calculation

```typescript
function calculateItemId(mintEvent: ItemMintedEvent): string {
  return sha256(`${mintEvent.manufacturerId}:${mintEvent.metadataHash}:${mintEvent.timestamp}`);
}
```

### Manufacturer ID Calculation

```typescript
function calculateManufacturerId(regEvent: ManufacturerRegisteredEvent): string {
  return sha256(`${regEvent.name}:${regEvent.issuerPublicKey}:${regEvent.timestamp}`);
}
```

---

## 7. SIGNATURE SCHEME

### Cryptographic Primitives
- **Algorithm**: ECDSA with secp256k1 (Bitcoin-compatible)
- **Hashing**: SHA256
- **Encoding**: Hex for signatures, Base58Check for addresses

### Actor Signatures
- **Manufacturers**: Sign with issuer private key
- **Owners/Sellers**: Sign with wallet private key
- **Buyers**: Sign offers with wallet private key

### Operator Signatures
- Each operator signs the `eventId` (event hash)
- Quorum requirement: M-of-N (e.g., 5-of-9)
- Operators MUST verify:
  - State transition is valid
  - Actor signature is valid
  - Previous event hash matches
  - No conflicting events exist

### Signature Verification

```typescript
function verifyEventSignatures(event: BaseEvent, operators: Operator[]): boolean {
  // 1. Verify actor signature
  if (!verifyActorSignature(event)) return false;
  
  // 2. Verify quorum
  if (event.operatorSignatures.length < QUORUM_M) return false;
  
  // 3. Verify each operator signature
  let validSigs = 0;
  for (const opSig of event.operatorSignatures) {
    const operator = operators.find(o => o.operatorId === opSig.operatorId);
    if (!operator) continue;
    
    if (verifySignature(event.eventId, opSig.signature, opSig.publicKey)) {
      validSigs++;
    }
  }
  
  return validSigs >= QUORUM_M;
}
```

---

## 8. SCAN HANDSHAKE PROTOCOL

When a buyer scans an item (QR/NFC):

### Step 1: Query Operators
```typescript
// Client queries multiple operators in parallel
const responses = await Promise.all(
  operators.map(op => op.getItemProof(itemId))
);
```

### Step 2: Verify Quorum Consensus
```typescript
// Check that M-of-N operators agree on state
const consensusState = findConsensusState(responses, QUORUM_M);
if (!consensusState) {
  throw new Error("No quorum consensus - possible attack or network partition");
}
```

### Step 3: Verify Signatures
```typescript
// Verify all operator signatures on latest event
if (!verifyEventSignatures(consensusState.lastEvent, operators)) {
  throw new Error("Invalid operator signatures");
}
```

### Step 4: Verify Manufacturer
```typescript
// Verify item was issued by legitimate manufacturer
const manufacturer = await getManufacturer(item.manufacturerId);
if (manufacturer.status !== ManufacturerStatus.ACTIVE) {
  throw new Error("Item issued by suspended/revoked manufacturer");
}
```

### Step 5: Verify State Consistency
```typescript
// Verify event chain integrity
if (!verifyEventChain(item.itemId, consensusState.events)) {
  throw new Error("Event chain broken - possible tampering");
}
```

### Step 6: Display Result
```typescript
interface ScanResult {
  itemId: string;
  manufacturer: {
    name: string;
    status: ManufacturerStatus;
  };
  currentState: ItemState;
  isAuthentic: boolean;
  canPurchase: boolean;
  lastVerifiedAt: number;
  anchorStatus: {
    isAnchored: boolean;
    bitcoinTxHash?: string;
    blockHeight?: number;
  };
  warnings: string[];
}
```

---

## 9. SALE FLOW (NO ARBITRATION)

### Phase 1: Offer Creation
```typescript
// Buyer scans item and creates offer
const offer = {
  offerId: generateOfferId(),
  itemId: item.itemId,
  buyerWallet: buyerAddress,
  priceSats: agreedPrice,
  expiryTimestamp: now + OFFER_EXPIRY_SECONDS,
  buyerSignature: signOffer(offer, buyerPrivateKey)
};
```

### Phase 2: Seller Acceptance
```typescript
// Seller proves ownership and accepts
const acceptance = {
  offerId: offer.offerId,
  sellerWallet: sellerAddress,
  sellerSignature: signAcceptance(offer, sellerPrivateKey)
};

// Verify seller owns item
if (item.currentOwnerWallet !== sellerWallet) {
  throw new Error("Seller does not own item");
}
```

### Phase 3: Escrow Lock
```typescript
// Operators validate and lock item
const lockEvent: ItemLockedEvent = {
  eventType: EventType.ITEM_LOCKED,
  itemId: item.itemId,
  offerId: offer.offerId,
  sellerWallet: sellerAddress,
  buyerWallet: buyerAddress,
  priceSats: offer.priceSats,
  expiryTimestamp: offer.expiryTimestamp,
  escrowFeeSats: calculateEscrowFee(offer.priceSats),
  // ... signatures
};

// Item now LOCKED_IN_ESCROW - cannot be double-sold
```

### Phase 4: Payment
```typescript
// Generate BTC invoice
const invoice = await paymentAdapter.createInvoice({
  amountSats: offer.priceSats + lockEvent.escrowFeeSats,
  description: `Purchase item ${item.itemId}`,
  expirySeconds: offer.expiryTimestamp - now
});

// Buyer pays
await buyerWallet.pay(invoice);
```

### Phase 5: Settlement (ATOMIC)
```typescript
// Operators detect payment and settle
const paymentProof = await paymentAdapter.verifyPayment(invoice);

if (paymentProof.verified) {
  // 1. Create settlement event
  const settleEvent: ItemSettledEvent = {
    eventType: EventType.ITEM_SETTLED,
    itemId: item.itemId,
    offerId: offer.offerId,
    buyerWallet: buyerAddress,
    priceSats: offer.priceSats,
    paymentProof: paymentProof,
    settlementFeeSats: calculateSettlementFee(offer.priceSats),
    // ... signatures
  };
  
  // 2. Update item ownership
  item.currentOwnerWallet = buyerAddress;
  item.currentState = ItemState.ACTIVE_HELD;
  
  // 3. Release BTC to seller
  await paymentAdapter.releaseFunds(
    sellerAddress,
    offer.priceSats - settleEvent.settlementFeeSats
  );
  
  // 4. Distribute fees to operators
  await distributeFees(settleEvent.settlementFeeSats, operators);
}
```

### Phase 6: Expiry Handling
```typescript
// If payment not received before expiry
if (now > offer.expiryTimestamp && item.currentState === ItemState.LOCKED_IN_ESCROW) {
  const unlockEvent: ItemUnlockedExpiredEvent = {
    eventType: EventType.ITEM_UNLOCKED_EXPIRED,
    itemId: item.itemId,
    offerId: offer.offerId,
    expiryTimestamp: offer.expiryTimestamp,
    // ... signatures
  };
  
  // Item returns to ACTIVE_HELD with original owner
  item.currentState = ItemState.ACTIVE_HELD;
}
```

---

## 10. SECURITY GUARANTEES

### Prevents Double-Selling
- Item in LOCKED_IN_ESCROW cannot accept new offers
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

---

## 11. BITCOIN ANCHORING

### Anchoring Schedule
- **Trigger 1**: Every N events (e.g., 1000 events)
- **Trigger 2**: Every T hours (e.g., 24 hours)
- **Trigger 3**: On-demand for high-value items

### Anchor Transaction Format
```typescript
interface AnchorTransaction {
  merkleRoot: string;           // Root of event Merkle tree
  heightRange: [number, number]; // [startHeight, endHeight]
  operatorSignatures: string[]; // M-of-N operators co-sign
  bitcoinTxHash: string;        // OP_RETURN tx hash
}
```

### OP_RETURN Payload
```
OP_RETURN <protocol_id> <merkle_root> <height_range>
```

### Verification
```typescript
function verifyAnchor(event: BaseEvent, anchorTx: AnchorTransaction): boolean {
  // 1. Verify event is in Merkle tree
  const proof = generateMerkleProof(event.eventId, anchorTx.merkleRoot);
  if (!verifyMerkleProof(proof)) return false;
  
  // 2. Verify anchor tx exists on Bitcoin
  const btcTx = await bitcoinClient.getTransaction(anchorTx.bitcoinTxHash);
  if (!btcTx || btcTx.confirmations < 6) return false;
  
  // 3. Verify OP_RETURN matches
  const opReturn = extractOpReturn(btcTx);
  return opReturn.merkleRoot === anchorTx.merkleRoot;
}
```

---

## 12. FEE STRUCTURE

### Fee Types
1. **Registration Fee**: Manufacturer pays to register (one-time)
2. **Minting Fee**: Per item minted
3. **Escrow Fee**: Per sale initiated (refunded if expired)
4. **Settlement Fee**: Per successful sale (% of price)

### Fee Distribution
```typescript
const FEE_SPLIT = {
  operators: 0.80,      // 80% to operator quorum
  protocol: 0.15,       // 15% to protocol treasury
  anchor: 0.05          // 5% reserved for Bitcoin anchoring
};

function distributeFees(totalFeeSats: number, operators: Operator[]) {
  const operatorShare = totalFeeSats * FEE_SPLIT.operators / operators.length;
  const protocolShare = totalFeeSats * FEE_SPLIT.protocol;
  const anchorReserve = totalFeeSats * FEE_SPLIT.anchor;
  
  // Pay each operator
  operators.forEach(op => {
    paymentAdapter.send(op.btcAddress, operatorShare);
  });
  
  // Pay protocol treasury
  paymentAdapter.send(PROTOCOL_TREASURY_ADDRESS, protocolShare);
  
  // Reserve for anchoring
  anchorReservePool += anchorReserve;
}
```

---

## 13. PRIVACY CONSIDERATIONS

### Public Information
- Item exists and is authentic
- Current state (ACTIVE/LOCKED/CUSTODY/BURNED)
- Manufacturer identity
- Event timestamps and heights

### Private Information
- Full owner wallet address (truncated in public state)
- Sale prices (only in locked/settled events)
- Buyer/seller identities (only in transaction events)

### Privacy-Preserving Techniques
1. **Truncated Addresses**: Public state shows only first/last 4 chars
2. **Ownership Proofs**: Require live signature, not stored
3. **Optional Encryption**: Event metadata can be encrypted for parties
4. **Future**: Zero-knowledge proofs for ownership without revealing address

---

## 14. LIMITATIONS & FUTURE WORK

### Current Limitations
- **In-Person Sales**: Optimized for face-to-face transactions
- **QR Codes**: Can be copied (NFC upgrade planned)
- **Federated Trust**: Requires M honest operators
- **Payment Finality**: On-chain requires confirmations (Lightning instant)

### Future Enhancements
1. **Cryptographic NFC Tags**: Tamper-evident, challenge-response auth
2. **Shipping Integration**: Escrow with carrier tracking
3. **Warranty Tracking**: Extend protocol for service records
4. **Privacy Upgrades**: Zero-knowledge ownership proofs
5. **Lightning Network**: Full integration for instant settlements
6. **Operator Bonding**: Economic penalties for misbehavior
7. **Cross-Chain Bridges**: Accept wrapped BTC (with caution)

---

## 15. THREAT MODEL

### Threats Mitigated
✅ **Counterfeit Items**: Cryptographic proof of manufacturer issuance  
✅ **Double-Selling**: State machine prevents concurrent sales  
✅ **Replay Attacks**: Event chain and timestamps prevent reuse  
✅ **Forged Ownership**: Requires live wallet signature  
✅ **Operator Collusion**: M-of-N quorum prevents single-operator fraud  
✅ **Payment Fraud**: Bitcoin's finality ensures irreversible payment  

### Threats Partially Mitigated
⚠️ **QR Code Cloning**: Buyer must verify seller ownership signature  
⚠️ **Network Partition**: Clients may see stale state (check multiple operators)  
⚠️ **Operator Majority Collusion**: M operators can forge state (requires bonding)  

### Threats NOT Mitigated
❌ **Physical Theft**: Protocol cannot prevent stealing physical item  
❌ **Coercion**: Cannot prevent forced wallet signature  
❌ **Quantum Computing**: ECDSA vulnerable (future: post-quantum crypto)  
❌ **Legal Disputes**: No arbitration mechanism (by design)  

---

## 16. COMPARISON TO ALTERNATIVES

| Feature | This Protocol | Ethereum NFTs | Centralized DB |
|---------|--------------|---------------|----------------|
| Currency | BTC only | ETH + gas | Fiat |
| Finality | Irreversible | Reversible (reorgs) | Reversible |
| Fees | On settlement | Per transaction | Subscription |
| Trust Model | Federated | Miner majority | Single company |
| Verification | Client-side | RPC node | API server |
| Arbitration | None | Smart contract | Support ticket |
| Bitcoin Native | ✅ Yes | ❌ No | ❌ No |

---

## CONCLUSION

This protocol provides a **Bitcoin-aligned, lightweight, and deterministic** system for authenticating physical goods and enabling irreversible resale. It combines the security of Bitcoin with the efficiency of federated consensus, avoiding the bloat of continuous blockchains while maintaining cryptographic integrity.

**Key Innovation**: Treating product ownership like Bitcoin itself - scarce, transferable, and final.
