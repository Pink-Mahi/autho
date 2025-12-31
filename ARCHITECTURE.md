# Architecture Overview

## System Components

### 1. Core Layer (`src/core/`)

**Hashing (`hashing.ts`)**
- Canonical serialization with sorted keys
- Deterministic event hash calculation
- Item ID, Manufacturer ID, Offer ID generation
- SHA256-based cryptographic hashing

**State Machine (`state-machine.ts`)**
- Valid state transition enforcement
- Event validation logic
- State application to items
- Event chain integrity verification

### 2. Cryptographic Layer (`src/crypto/`)

**Crypto Utilities (`index.ts`)**
- ECDSA with secp256k1 (Bitcoin-compatible)
- Key pair generation
- Message signing and verification
- Merkle tree implementation
- Timestamped signatures (anti-replay)

### 3. Operator Layer (`src/operator/`)

**Event Store (`event-store.ts`)**
- File-based append-only event log
- Item state persistence
- Manufacturer registry storage
- Event indexing by item and height

**Operator Node (`node.ts`)**
- Event validation and submission
- Quorum signature coordination
- State machine enforcement
- Item proof generation

**API Server (`api-server.ts`)**
- RESTful HTTP API
- Event submission endpoints
- Item query endpoints
- Manufacturer registry access

### 4. Client Layer (`src/client/`)

**Verifier (`verifier.ts`)**
- Multi-operator query coordination
- Quorum consensus detection
- Signature verification
- Event chain validation
- Scan result generation

**Sale Manager (`sale-manager.ts`)**
- Offer creation and acceptance
- Escrow lock coordination
- Payment invoice generation
- Settlement orchestration
- Fee calculation and distribution

### 5. Payment Layer (`src/payment/`)

**Payment Adapters (`adapter.ts`)**
- Mock adapter (testing)
- Bitcoin RPC adapter (on-chain)
- Lightning Network adapter (instant)
- Invoice creation and verification
- Fund release coordination

### 6. Manufacturer Layer (`src/manufacturer/`)

**Issuer (`issuer.ts`)**
- Key pair management
- Registration event creation
- Item minting
- Event signing
- Manufacturer identity management

## Data Flow

### Item Minting Flow

```
Manufacturer → Create Mint Event → Sign with Private Key
    ↓
Operator 1 → Validate → Co-sign
Operator 2 → Validate → Co-sign
Operator 3 → Validate → Co-sign (Quorum Reached)
    ↓
All Operators → Store Event → Update Item State
```

### Scan Verification Flow

```
Client → Query Multiple Operators (Parallel)
    ↓
Operators → Return Item Proof + Signatures
    ↓
Client → Verify Quorum Consensus
Client → Verify All Signatures
Client → Verify Event Chain
Client → Verify Manufacturer
    ↓
Display: Authentic / Counterfeit
```

### Sale Settlement Flow

```
Buyer → Create Offer → Sign
    ↓
Seller → Accept Offer → Sign
    ↓
Operators → Lock Item in Escrow (LOCKED_IN_ESCROW)
    ↓
Buyer → Pay BTC Invoice
    ↓
Operators → Verify Payment → Settle
    ↓
Atomic:
  - BTC → Seller
  - Ownership → Buyer
  - Fees → Operators
  - State → ACTIVE_HELD
```

## Security Architecture

### Defense in Depth

**Layer 1: Cryptographic**
- ECDSA signatures (secp256k1)
- SHA256 hashing
- Merkle tree proofs
- Timestamped nonces

**Layer 2: Consensus**
- M-of-N operator quorum
- Federated trust model
- No single point of failure
- Economic incentive alignment

**Layer 3: State Machine**
- Deterministic transitions
- Invalid transitions rejected
- Event chain integrity
- Height-based ordering

**Layer 4: Bitcoin Anchoring**
- Periodic Merkle root commitment
- Inherits Bitcoin security
- Immutable history
- Proof of freshness

**Layer 5: Client Verification**
- Zero trust in operators
- Local signature verification
- Quorum consensus check
- State machine validation

## Scalability Considerations

### Current MVP

- **Throughput**: ~100 events/second per operator
- **Storage**: File-based (suitable for MVP)
- **Latency**: ~500ms for quorum coordination
- **Operators**: 5-9 recommended

### Future Optimizations

1. **Database Backend**: PostgreSQL/MongoDB for production
2. **Event Batching**: Batch multiple events per block
3. **Parallel Validation**: Multi-threaded event processing
4. **CDN Distribution**: Cached item proofs
5. **Sharding**: Partition items by manufacturer

## Deployment Architecture

### Production Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (Nginx)                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  Operator 1   │  │  Operator 2   │  │  Operator 3   │
│  (Exchange A) │  │  (Exchange B) │  │  (Auditor C)  │
│               │  │               │  │               │
│  - API Server │  │  - API Server │  │  - API Server │
│  - Event Store│  │  - Event Store│  │  - Event Store│
│  - BTC Node   │  │  - BTC Node   │  │  - BTC Node   │
└───────────────┘  └───────────────┘  └───────────────┘
```

### Operator Independence

- Different hosting providers
- Different geographic regions
- Different organizations
- Different Bitcoin nodes
- Independent key management

## Technology Stack

### Core
- **Language**: TypeScript
- **Runtime**: Node.js 18+
- **Crypto**: bitcoinjs-lib, tiny-secp256k1

### Operator
- **API**: Express.js
- **Storage**: File system (MVP), PostgreSQL (production)
- **Bitcoin**: Bitcoin Core RPC

### Client
- **Verification**: Pure TypeScript (browser/node)
- **HTTP**: Fetch API
- **Crypto**: Web Crypto API compatible

### Payment
- **On-chain**: Bitcoin Core RPC
- **Lightning**: LND REST API
- **Testing**: Mock adapter

## Configuration Management

### Operator Config
```typescript
{
  operatorId: string,
  privateKey: string,
  publicKey: string,
  btcAddress: string,
  port: number,
  peers: string[]
}
```

### Quorum Config
```typescript
{
  m: number,  // Required signatures
  n: number   // Total operators
}
```

### Network Config
```typescript
{
  operators: Operator[],
  quorum: QuorumConfig,
  protocolTreasuryAddress: string,
  anchorFrequency: {
    events: number,
    hours: number
  }
}
```

## Monitoring & Observability

### Metrics to Track

1. **Event Metrics**
   - Events per second
   - Event validation time
   - Quorum coordination time

2. **Operator Metrics**
   - Uptime percentage
   - Signature success rate
   - Consensus participation

3. **Payment Metrics**
   - Settlement success rate
   - Average settlement time
   - Fee distribution

4. **Security Metrics**
   - Invalid event attempts
   - Signature verification failures
   - Quorum consensus failures

### Logging Strategy

- **Info**: Normal operations
- **Warn**: Recoverable issues
- **Error**: Failed validations
- **Critical**: Security incidents

## Upgrade Path

### Phase 1: MVP (Current)
- QR code scanning
- File-based storage
- Mock payments
- 5 operators

### Phase 2: Production
- NFC tag integration
- Database backend
- Real Bitcoin/Lightning
- 9 operators

### Phase 3: Scale
- Mobile apps
- Shipping integration
- Warranty tracking
- 15+ operators

### Phase 4: Advanced
- Zero-knowledge proofs
- Cross-chain bridges
- Operator bonding
- Formal verification

## Testing Strategy

### Unit Tests
- Crypto functions
- State machine logic
- Event validation
- Signature verification

### Integration Tests
- Operator coordination
- Client verification
- Payment flows
- Event chain integrity

### End-to-End Tests
- Full sale flow
- Multi-operator consensus
- Failure scenarios
- Attack simulations

### Security Tests
- Replay attack prevention
- Double-spend prevention
- Signature forgery attempts
- Quorum manipulation

---

**This architecture provides a solid foundation for a Bitcoin-native product ownership system that is secure, scalable, and aligned with Bitcoin's principles of finality and decentralization.**
