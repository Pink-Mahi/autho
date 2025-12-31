# Third-Party Authenticators Extension

## Overview

This document describes the **strictly additive** authenticator extension to the Bitcoin-Native Product Ownership & Escrow Protocol. Authenticators provide independent verification of physical items without affecting ownership, payment flows, or core protocol operations.

## Key Principles

### ✅ What Authenticators ARE

- **Independent verifiers** - Third-party experts who examine and attest to items
- **Informational only** - Provide additional confidence signals to buyers
- **Non-transferable** - Attestations are bound to items, not owners
- **Optional** - Items function normally without any attestations
- **Additive** - Extend the protocol without modifying existing flows

### ❌ What Authenticators are NOT

- **NOT owners** - Authentication does not grant ownership rights
- **NOT required** - Items can be sold without attestations
- **NOT payment processors** - No involvement in BTC transactions
- **NOT arbitrators** - No dispute resolution capability
- **NOT transferable assets** - Attestations cannot be bought/sold

## Architecture

### New Entity: Authenticator

```typescript
interface Authenticator {
  authenticatorId: string;        // Unique ID (hash-based)
  name: string;                   // Display name
  publicKey: string;              // ECDSA public key
  specialization: string;         // Free-form (e.g., "Luxury Watches")
  status: AuthenticatorStatus;    // ACTIVE | SUSPENDED | REVOKED
  registeredAt: number;           // Unix timestamp
  registrationTxHash?: string;    // Optional Bitcoin anchor
  metadataUri?: string;           // Optional profile/credentials
}
```

### Authentication Attestation

```typescript
interface AuthenticationAttestation {
  attestationId: string;          // Unique ID
  itemId: string;                 // Item being authenticated
  authenticatorId: string;        // Who issued this
  confidence: number;             // 0-100 confidence score
  scope: string;                  // What was verified (e.g., "Physical inspection")
  notes?: string;                 // Optional details
  expiryTimestamp?: number;       // Optional expiration
  issuedAt: number;               // When issued
  authenticatorSignature: string; // Cryptographic signature
}
```

## New Event Types

### AUTHENTICATOR_REGISTERED

Registers a new authenticator in the system.

```typescript
interface AuthenticatorRegisteredEvent extends BaseEvent {
  eventType: EventType.AUTHENTICATOR_REGISTERED;
  authenticatorId: string;
  name: string;
  publicKey: string;
  specialization: string;
  registrationFeeSats: number;
}
```

**Properties:**
- Requires M-of-N operator quorum signatures
- Does NOT create or modify any items
- Does NOT affect existing ownership flows
- Authenticator pays BTC registration fee

### ITEM_AUTHENTICATED

Records an authentication attestation for an item.

```typescript
interface ItemAuthenticatedEvent extends BaseEvent {
  eventType: EventType.ITEM_AUTHENTICATED;
  attestation: AuthenticationAttestation;
}
```

**Properties:**
- Requires M-of-N operator quorum signatures
- Does NOT change item state (remains in current state)
- Does NOT affect ownership or transfer rights
- Does NOT block or enable sales
- Purely informational

## Operator Validation

Operators validate authentication events with the following checks:

### For AUTHENTICATOR_REGISTERED
1. ✅ Event hash is correct
2. ✅ Timestamp is valid
3. ✅ M-of-N quorum signatures present
4. ✅ Registration fee paid

### For ITEM_AUTHENTICATED
1. ✅ Event hash is correct
2. ✅ Timestamp is valid
3. ✅ M-of-N quorum signatures present
4. ✅ Authenticator exists and is ACTIVE
5. ✅ Authenticator signature on attestation is valid
6. ✅ Item exists (optional - can authenticate items without manufacturers)

**Critical:** Operators treat authentication as **informational only**. No state transitions occur.

## Client Scan Enhancement

When a buyer scans an item, the client now:

### 1. Fetch Attestations (Optional)

```typescript
// Query operators for attestations
const attestations = await queryAttestations(itemId, operators);
```

### 2. Verify Attestations

For each attestation:
- ✅ Verify authenticator exists
- ✅ Verify authenticator status is ACTIVE
- ✅ Verify authenticator signature
- ✅ Check expiry (if present)
- ✅ Calculate validity: `isValid && !isExpired && status === ACTIVE`

### 3. Display Results

```typescript
interface AuthenticationDisplay {
  authenticator: {
    name: string;
    specialization: string;
    status: AuthenticatorStatus;
  };
  confidence: number;
  scope: string;
  notes?: string;
  issuedAt: number;
  expiryTimestamp?: number;
  isExpired: boolean;
  isValid: boolean;
}
```

**Display Guidelines:**
- Show attestations as **supplementary information**
- Clearly distinguish from ownership verification
- Display authenticator name and specialization
- Show confidence score and scope
- Indicate if expired or invalid
- Sort by most recent first

### 4. Example Scan Result

```
Item: Luxury Watch #LWC-2024-001234
Manufacturer: Luxury Watch Co. (ACTIVE)
State: ACTIVE_HELD
Ownership: Verified ✓
Can Purchase: YES

Authentication Attestations:
  1. Swiss Watch Expert (Luxury Watches)
     Confidence: 95%
     Scope: Physical inspection, movement verification
     Issued: 2024-12-15
     Status: Valid ✓
     
  2. Timepiece Authenticators (Horology)
     Confidence: 90%
     Scope: Serial number verification
     Issued: 2024-12-10
     Expires: 2025-12-10
     Status: Valid ✓
```

## Trust Model

### Authenticator Trust is INDEPENDENT

- Authenticators are **not** part of the core protocol trust model
- Buyers choose which authenticators to trust
- Multiple attestations provide diverse opinions
- Expired or revoked attestations are clearly marked

### Operator Role

Operators:
- ✅ Verify authenticator signatures
- ✅ Co-sign authentication events (M-of-N)
- ✅ Store attestations
- ✅ Serve attestations to clients
- ❌ Do NOT validate authentication quality
- ❌ Do NOT endorse authenticators
- ❌ Do NOT affect item state based on attestations

### Client Responsibility

Clients must:
- ✅ Verify all signatures locally
- ✅ Check authenticator status
- ✅ Evaluate confidence scores
- ✅ Consider multiple attestations
- ✅ Make own trust decisions
- ❌ Do NOT rely solely on attestations for purchase decisions

## Use Cases

### 1. Luxury Goods Authentication

**Scenario:** Buyer wants to purchase a luxury watch

**Flow:**
1. Buyer scans watch QR code
2. Client verifies manufacturer (Luxury Watch Co.)
3. Client verifies ownership (seller controls wallet)
4. Client fetches attestations:
   - Swiss Watch Expert: 95% confidence
   - Independent Horologist: 92% confidence
5. Buyer reviews attestations as additional confidence
6. Buyer proceeds with purchase (or not)

**Key:** Attestations are **supplementary**, not required.

### 2. Art Authentication

**Scenario:** Collectible art piece with provenance questions

**Flow:**
1. Item minted by artist (manufacturer)
2. Art authenticator examines piece
3. Authenticator issues attestation:
   - Confidence: 88%
   - Scope: "Brushwork analysis, signature verification"
   - Notes: "Consistent with artist's known technique"
4. Attestation stored on-chain
5. Future buyers see historical attestations

**Key:** Attestations persist across ownership transfers.

### 3. Multiple Authenticators

**Scenario:** High-value item with conflicting opinions

**Flow:**
1. Authenticator A: 95% confidence (authentic)
2. Authenticator B: 60% confidence (uncertain)
3. Authenticator C: 30% confidence (likely counterfeit)
4. Buyer sees all three attestations
5. Buyer investigates further or declines purchase

**Key:** Protocol shows all attestations, buyer decides.

## API Endpoints

### Get Authenticator

```
GET /api/authenticator/:authenticatorId
```

Returns authenticator details.

### Get Item Attestations

```
GET /api/item/:itemId/attestations
```

Returns all attestations for an item.

### Submit Authentication Event

```
POST /api/event/submit
```

Submit ITEM_AUTHENTICATED event with attestation.

## Security Considerations

### Prevents

- ✅ **Forged Attestations** - Authenticator signature required
- ✅ **Replay Attacks** - Attestation ID unique, timestamp checked
- ✅ **Revoked Authenticators** - Status checked on every scan
- ✅ **Expired Attestations** - Expiry timestamp enforced

### Does NOT Prevent

- ⚠️ **Bad Authenticators** - Buyers must evaluate authenticator reputation
- ⚠️ **Collusion** - Authenticator could collude with seller
- ⚠️ **Bribery** - Authenticator could be paid for false attestation

### Mitigations

1. **Multiple Attestations** - Get opinions from multiple authenticators
2. **Reputation Systems** - Track authenticator accuracy over time (future)
3. **Expiry Dates** - Time-limited attestations for changing conditions
4. **Status Revocation** - Operators can SUSPEND/REVOKE bad authenticators

## Comparison to Core Protocol

| Feature | Core Protocol | Authenticators |
|---------|--------------|----------------|
| **Purpose** | Ownership & Payment | Verification & Confidence |
| **Required** | Yes | No |
| **Affects State** | Yes | No |
| **Transferable** | Yes (ownership) | No (attestations) |
| **Payment** | BTC for items | BTC for registration |
| **Trust Model** | M-of-N operators | Independent experts |
| **Finality** | Irreversible | Informational |

## Future Enhancements

### Phase 1: Reputation Tracking
- Track authenticator accuracy over time
- Display historical performance metrics
- Community feedback on attestations

### Phase 2: Specialized Credentials
- Cryptographic proof of credentials
- Third-party credential verification
- Industry certifications

### Phase 3: Physical Evidence
- Photo/video hash storage
- Tamper-evident documentation
- Chain of custody tracking

### Phase 4: Dispute Resolution
- Optional arbitration for disagreements
- Multi-authenticator consensus
- Evidence-based appeals

## Example Code

### Register Authenticator

```typescript
import { AuthenticatorIssuer } from 'bitcoin-ownership-protocol';

const authenticator = new AuthenticatorIssuer(
  'Swiss Watch Expert',
  'Luxury Watches'
);

const regEvent = authenticator.createRegistrationEvent(10000);
// Submit to operators for quorum signatures
```

### Create Attestation

```typescript
const attestation = authenticator.createAttestation(
  itemId,
  95,                    // 95% confidence
  'Physical inspection', // Scope
  'Authentic Rolex Submariner, serial matches records',
  24 * 365               // Expires in 1 year
);

const authEvent = authenticator.createAuthenticationEvent(
  itemId,
  attestation,
  previousEventHash,
  height
);
// Submit to operators
```

### Client Verification

```typescript
import { ClientVerifier } from 'bitcoin-ownership-protocol';

const verifier = new ClientVerifier({ m: 3, n: 5 });
const scanResult = await verifier.scanItem(itemId, operators);

// Display attestations
if (scanResult.attestations) {
  for (const att of scanResult.attestations) {
    console.log(`${att.authenticator.name}: ${att.confidence}% confidence`);
    console.log(`  Scope: ${att.scope}`);
    console.log(`  Valid: ${att.isValid ? 'YES' : 'NO'}`);
  }
}
```

## Conclusion

The authenticator extension provides **optional, informational** verification without modifying the core protocol. It maintains the Bitcoin-native principles of:

- ✅ Irreversible ownership transfers
- ✅ No human arbitration
- ✅ BTC-only payments
- ✅ Deterministic state machine
- ✅ Client-side verification

Authenticators add **confidence signals** while preserving **protocol finality**.

---

**Remember:** Authentication is supplementary. Ownership is primary.
