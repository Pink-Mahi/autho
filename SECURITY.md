# Security Model & Threat Analysis

## Overview

This document provides a comprehensive security analysis of the Bitcoin-Native Product Ownership & Escrow Protocol, including threat models, attack vectors, mitigations, and known limitations.

## Trust Model

### Federated Operators

**Assumption:** At least M operators in an M-of-N quorum are honest.

**Properties:**
- No single operator can forge state
- M-1 operators can fail/lie without breaking system
- Operators earn BTC fees only on successful settlements
- Economic incentive alignment (honest behavior = revenue)

**Future Enhancement:** Operator bonding with slashing for provable misbehavior.

### Bitcoin Anchoring

**Assumption:** Bitcoin blockchain provides immutable history.

**Properties:**
- Event log Merkle root committed to Bitcoin
- Once anchored, events inherit Bitcoin's security
- 6+ confirmations provide high confidence
- Clients can verify anchoring independently

### Client-Side Verification

**Assumption:** Clients run verification logic correctly.

**Properties:**
- Zero trust in operators for verification
- All signatures checked locally
- State machine rules enforced client-side
- Quorum consensus required

## Threat Categories

### 1. Counterfeit Items

#### Attack: Fake Item Creation

**Scenario:** Attacker creates fake item claiming to be from legitimate manufacturer.

**Mitigation:**
- Only verified manufacturers can mint items
- Manufacturer public key checked on every scan
- Registration events require quorum signatures
- Manufacturer status can be SUSPENDED/REVOKED

**Result:** ✅ **PREVENTED** - Cryptographically impossible to forge manufacturer signature.

#### Attack: Cloned QR Code

**Scenario:** Attacker copies QR code from legitimate item to fake item.

**Mitigation:**
- Ownership proof requires live wallet signature
- Signature includes timestamp and nonce (5-minute validity)
- Cannot replay screenshots or old signatures
- Buyer verifies seller controls wallet

**Result:** ⚠️ **PARTIALLY MITIGATED** - Buyer must verify seller ownership. Future NFC tags eliminate this vector.

### 2. Double-Selling

#### Attack: Concurrent Sale Attempts

**Scenario:** Seller tries to sell same item to multiple buyers simultaneously.

**Mitigation:**
- Item state transitions to LOCKED_IN_ESCROW
- Locked items cannot accept new offers
- State machine enforces single active lock
- Operators reject conflicting lock events

**Result:** ✅ **PREVENTED** - First lock accepted, subsequent attempts rejected.

#### Attack: Operator Collusion

**Scenario:** M operators collude to create conflicting locks.

**Mitigation:**
- Clients query multiple operators
- Consensus requires M-of-N agreement
- Conflicting states detected by clients
- Operators lose reputation/revenue if caught

**Result:** ⚠️ **REQUIRES M HONEST OPERATORS** - If M operators collude, they can forge state. Future bonding increases cost of attack.

### 3. Payment Fraud

#### Attack: Fake Payment Proof

**Scenario:** Buyer submits fake payment proof to trigger settlement.

**Mitigation:**
- Payment proof includes Bitcoin txid or Lightning preimage
- Operators verify payment on-chain or via Lightning node
- Settlement only proceeds after verification
- Payment amount must match offer price

**Result:** ✅ **PREVENTED** - Cannot forge Bitcoin transactions or Lightning preimages.

#### Attack: Insufficient Payment

**Scenario:** Buyer pays less than agreed price.

**Mitigation:**
- Payment amount checked against offer
- Settlement rejected if amount insufficient
- Escrow expires if not paid in full
- Item returns to seller automatically

**Result:** ✅ **PREVENTED** - State machine enforces payment amount check.

### 4. Replay Attacks

#### Attack: Resubmit Old Event

**Scenario:** Attacker replays old event to revert state.

**Mitigation:**
- Each event has unique height (sequential)
- Events reference previous event hash (chain)
- Operators track event IDs (reject duplicates)
- Timestamp validation (not too old/future)

**Result:** ✅ **PREVENTED** - Event chain integrity enforced.

#### Attack: Replay Ownership Signature

**Scenario:** Attacker uses old ownership signature to claim item.

**Mitigation:**
- Signatures include timestamp (5-minute validity)
- Signatures include nonce (single-use)
- Operators reject expired signatures
- Live signature required for each transaction

**Result:** ✅ **PREVENTED** - Time-bound signatures prevent replay.

### 5. State Manipulation

#### Attack: Forge Event Hash

**Scenario:** Attacker modifies event and recalculates hash.

**Mitigation:**
- Events signed by actor (manufacturer/owner)
- Events co-signed by M-of-N operators
- Clients verify all signatures locally
- Hash calculation deterministic (canonical serialization)

**Result:** ✅ **PREVENTED** - Cannot forge signatures without private keys.

#### Attack: Break Event Chain

**Scenario:** Attacker inserts event with wrong previous hash.

**Mitigation:**
- Each event references previous event hash
- Clients validate full event chain
- Broken chain detected immediately
- Operators reject invalid chains

**Result:** ✅ **PREVENTED** - Event chain integrity enforced.

### 6. Network Attacks

#### Attack: Network Partition

**Scenario:** Attacker isolates client from honest operators.

**Mitigation:**
- Client queries multiple operators in parallel
- Consensus requires M-of-N agreement
- Client detects if insufficient responses
- Warning displayed if no quorum

**Result:** ⚠️ **DETECTABLE** - Client knows when it cannot verify state. Fails safe (no transaction).

#### Attack: Man-in-the-Middle

**Scenario:** Attacker intercepts client-operator communication.

**Mitigation:**
- TLS/HTTPS for operator API
- Operator signatures verified client-side
- Cannot forge operator signatures
- Public keys known in advance

**Result:** ✅ **PREVENTED** - Signatures provide end-to-end authenticity.

### 7. Operator Misbehavior

#### Attack: Single Operator Lies

**Scenario:** One operator returns false state.

**Mitigation:**
- Quorum requires M-of-N agreement
- Client ignores minority responses
- Consensus on state required
- Dishonest operator detected by clients

**Result:** ✅ **PREVENTED** - Quorum protects against single operator.

#### Attack: M Operators Collude

**Scenario:** M operators collude to forge state.

**Mitigation:**
- Operators are independent entities
- Economic incentive to be honest (fees)
- Reputation loss if caught
- Future: Bonding with slashing

**Result:** ⚠️ **TRUST ASSUMPTION** - Requires M honest operators. Bonding increases attack cost.

### 8. Manufacturer Misbehavior

#### Attack: Manufacturer Mints Fake Items

**Scenario:** Legitimate manufacturer mints items they didn't produce.

**Mitigation:**
- Manufacturer reputation at stake
- Buyers can verify manufacturer status
- Manufacturer can be SUSPENDED/REVOKED
- Event log provides audit trail

**Result:** ⚠️ **REPUTATION-BASED** - Protocol cannot prevent, but provides transparency.

#### Attack: Manufacturer Recalls Item

**Scenario:** Manufacturer burns item to prevent resale.

**Mitigation:**
- Burn event requires manufacturer signature
- Locked items cannot be burned (must settle/expire)
- Burn reason recorded on-chain
- Buyers see burn status when scanning

**Result:** ✅ **ALLOWED BY DESIGN** - Manufacturers can recall defective/counterfeit items.

## Attack Cost Analysis

### Low-Cost Attacks (< $1,000)

- ❌ Clone QR code → Mitigated by ownership proof
- ❌ Replay old signature → Prevented by timestamp
- ❌ Forge event hash → Prevented by signatures
- ❌ MITM attack → Prevented by TLS + signatures

### Medium-Cost Attacks ($1,000 - $100,000)

- ❌ Compromise single operator → Prevented by quorum
- ❌ Network partition → Detectable, fails safe
- ⚠️ Bribe manufacturer → Reputation loss, revocation

### High-Cost Attacks (> $100,000)

- ⚠️ Compromise M operators → Requires M independent entities
- ⚠️ 51% attack on Bitcoin → Inherits Bitcoin security
- ⚠️ Break ECDSA → Quantum computing (future threat)

## Known Limitations

### Physical Security

**NOT PROTECTED:**
- Physical theft of item
- Coercion to sign transaction
- Destruction of item

**Reason:** Protocol cannot control physical world.

### Legal Disputes

**NOT PROTECTED:**
- Contractual disputes
- Warranty claims
- Regulatory compliance

**Reason:** No arbitration mechanism by design (Bitcoin-aligned finality).

### Quantum Computing

**FUTURE THREAT:**
- ECDSA vulnerable to quantum computers
- Estimated 10-20 years until practical threat
- Migration path: Post-quantum signatures

### Privacy

**LIMITED:**
- Event log is public (with operator access)
- Owner addresses visible in events
- Sale prices recorded

**Mitigation:** Truncated addresses in public state, optional encryption for metadata.

## Security Best Practices

### For Operators

1. **Secure Key Storage** - Use HSM or secure enclave
2. **Rate Limiting** - Prevent DoS attacks
3. **Audit Logging** - Track all event submissions
4. **Peer Monitoring** - Watch for conflicting signatures
5. **Regular Backups** - Event log redundancy

### For Manufacturers

1. **Key Management** - Offline cold storage for issuer key
2. **Metadata Integrity** - Hash all item data
3. **Serial Number Uniqueness** - Prevent duplicate minting
4. **Regular Audits** - Verify minted items match production
5. **Revocation Process** - Procedure for compromised keys

### For Buyers

1. **Verify Quorum** - Check M-of-N signatures
2. **Check Manufacturer** - Verify issuer status
3. **Validate Ownership** - Require live signature
4. **Inspect Item** - Physical verification still important
5. **Use Escrow** - Never pay outside protocol

### For Sellers

1. **Prove Ownership** - Sign with wallet key
2. **Set Expiry** - Reasonable timeframe for payment
3. **Verify Payment** - Wait for confirmations
4. **Secure Wallet** - Protect private keys
5. **Track Events** - Monitor item state

## Incident Response

### Compromised Operator

1. Operator self-reports or detected by peers
2. Operator status set to SUSPENDED
3. Clients stop querying suspended operator
4. Quorum continues with remaining operators
5. Operator rotates keys and rejoins

### Compromised Manufacturer

1. Manufacturer reports key compromise
2. Manufacturer status set to SUSPENDED
3. New manufacturer registered with new keys
4. Existing items remain valid (event log immutable)
5. New items minted with new keys

### Detected Double-Spend Attempt

1. Client detects conflicting states
2. Client queries all operators for evidence
3. Conflicting operator signatures identified
4. Operators with conflicts investigated
5. Dishonest operators slashed (future bonding)

## Formal Verification (Future Work)

Potential areas for formal verification:

1. **State Machine** - Prove all transitions valid
2. **Event Chain** - Prove integrity properties
3. **Quorum Logic** - Prove M-of-N sufficiency
4. **Signature Scheme** - Prove cryptographic properties

## Conclusion

The protocol provides strong security guarantees for:
- ✅ Counterfeit prevention (cryptographic)
- ✅ Double-sell prevention (state machine)
- ✅ Payment finality (Bitcoin)
- ✅ No arbitration (deterministic)

Key assumptions:
- M-of-N operators are honest
- Bitcoin blockchain is secure
- ECDSA is not broken
- Clients verify correctly

Future enhancements (bonding, NFC, formal verification) will further strengthen security.

---

**Security is a process, not a product. This protocol provides a strong foundation, but vigilance is required from all participants.**
