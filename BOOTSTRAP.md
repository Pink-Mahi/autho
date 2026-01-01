# P2P Bootstrap Guide

## Overview

The Bitcoin Ownership Protocol uses a **multi-source bootstrap system** to ensure no single point of failure. New gateway nodes can join the network from anywhere in the world without depending on a single domain or server.

## Bootstrap Sources (Priority Order)

### 1. Bootstrap Configuration (Optional)
If joining via an existing gateway, use their shareable bootstrap config:

```bash
./autho-gateway --bootstrap-url https://gateway.example.com/bootstrap.json
```

Or download the file:
```bash
./autho-gateway --bootstrap bootstrap.json
```

### 2. Hardcoded Seeds (Built-in)
The software ships with 5-20 hardcoded seed addresses:
- `autho.pinkmahi.com:8333`
- `seed1.autho.network:8333`
- `seed2.autho.network:8333`
- `gateway.autho.network:8333`
- `operator1.autho.network:8333`

**Important:** Seeds are NOT trusted authorities. They only help discover peers. All data is verified locally.

### 3. DNS Seeds (Bitcoin-style)
Query DNS for rotating peer list:
```
seeds.autho.network
```

The DNS seed returns IP addresses of active nodes. The node attempts connections to a random subset.

### 4. Signed Seed Manifest (Evergreen Updates)
Fetch signed manifest from multiple URLs:
- `https://autho.pinkmahi.com/seed-manifest.json`
- `https://autho.network/seed-manifest.json`
- `https://backup.autho.network/seed-manifest.json`

The manifest is cryptographically verified:
- Signed by operator quorum (M-of-N) OR sponsor key
- Only accepted if signature verification succeeds
- Cached locally and re-fetched every 24 hours

### 5. Peer Gossip (After Initial Connect)
Once connected to any peer:
- Request peer addresses (ADDR message)
- Maintain peer table with scoring
- Connect to additional peers for resilience
- Gossip newly discovered peers

---

## How Shop Owners Share Their Gateway

### Step 1: Run Your Gateway
```bash
./autho-gateway --listen 8333 --data-dir ./gateway-data
```

### Step 2: Share the Join Link
Your gateway automatically exposes:
- **Join Page:** `https://yourstore.com/join`
- **Bootstrap Config:** `https://yourstore.com/bootstrap.json`
- **QR Code:** Displayed on join page

### Step 3: Others Bootstrap From You
New nodes can join via your gateway:
```bash
./autho-gateway --bootstrap-url https://yourstore.com/bootstrap.json
```

---

## Bootstrap Configuration Format

### `bootstrap.json`
```json
{
  "version": "1.0.0",
  "chainId": "bitcoin-mainnet",
  "hardcodedSeeds": [
    "autho.pinkmahi.com:8333",
    "seed1.autho.network:8333",
    "seed2.autho.network:8333"
  ],
  "dnsSeed": "seeds.autho.network",
  "manifestUrls": [
    "https://autho.pinkmahi.com/seed-manifest.json",
    "https://autho.network/seed-manifest.json"
  ],
  "networkName": "Bitcoin Ownership Protocol",
  "protocolVersion": "1.0.0",
  "gatewayEndpoint": "yourstore.com:8333",
  "gatewayPublicKey": "03a1b2c3..."
}
```

---

## Seed Manifest Format

### `seed-manifest.json`
```json
{
  "version": 1,
  "timestamp": 1704124800000,
  "chainId": "bitcoin-mainnet",
  "seeds": [
    {
      "address": "autho.pinkmahi.com:8333",
      "publicKey": "03a1b2c3...",
      "role": "gateway",
      "region": "us-east",
      "asn": 16509,
      "provider": "AWS",
      "addedAt": 1704124800000
    },
    {
      "address": "operator1.autho.network:8333",
      "publicKey": "02d4e5f6...",
      "role": "operator",
      "region": "eu-west",
      "addedAt": 1704124800000
    }
  ],
  "signatures": [
    {
      "signerId": "sponsor",
      "publicKey": "02abc123...",
      "signature": "304402...",
      "signedAt": 1704124800000
    },
    {
      "signerId": "operator_1",
      "publicKey": "03def456...",
      "signature": "304402...",
      "signedAt": 1704124800000
    }
  ],
  "manifestHash": "a1b2c3d4e5f6...",
  "previousManifestHash": "f6e5d4c3b2a1..."
}
```

---

## Bootstrap Process

### Phase 1: Fetching Seeds (Progress: 0-50%)
1. Load bootstrap config (if provided)
2. Use hardcoded seeds
3. Query DNS seeds
4. Fetch signed manifest

### Phase 2: Connecting (Progress: 50-70%)
1. Select random subset of discovered peers
2. Attempt TCP/WebSocket connections
3. Score peers by latency and reliability
4. Maintain peer table

### Phase 3: Syncing (Progress: 70-90%)
1. Request event log from connected peers
2. Verify hash chain integrity
3. Verify quorum signatures
4. Verify Bitcoin anchors
5. Build local database

### Phase 4: Ready (Progress: 100%)
1. Serve read APIs
2. Gossip peer addresses
3. Help others bootstrap
4. Optionally apply to become operator (after 90 days)

---

## CLI Flags

### Bootstrap Options
```bash
# Use bootstrap config file
./autho-gateway --bootstrap path/to/bootstrap.json

# Use bootstrap config URL
./autho-gateway --bootstrap-url https://gateway.example.com/bootstrap.json

# Override DNS seed
./autho-gateway --dns-seed seeds.custom.network

# Disable specific bootstrap sources
./autho-gateway --no-hardcoded-seeds
./autho-gateway --no-dns-seeds
./autho-gateway --no-manifest
```

### Network Options
```bash
# Set listen port
./autho-gateway --listen 8333

# Set max peers
./autho-gateway --max-peers 50

# Set data directory
./autho-gateway --data-dir ./gateway-data

# Set chain ID
./autho-gateway --chain-id bitcoin-mainnet
```

---

## Security Guarantees

### Seeds Are NOT Trusted
- Seeds only help discover peers
- All data verified locally:
  - Quorum signatures (M-of-N operators)
  - Hash chain integrity
  - Bitcoin anchor verification
- Malicious seeds cannot inject fake data

### Manifest Verification
- Requires M-of-N operator signatures OR sponsor signature
- Rejected if signatures invalid
- Cached locally to prevent MITM attacks

### Bootstrap Config Verification
- Optional signature field
- Chain ID must match
- Peer addresses validated during connection

### No Single Point of Failure
- Network survives if ANY bootstrap source works
- Network survives if ANY peer is reachable
- Network survives as long as:
  - Independent nodes exist
  - Clients can query multiple nodes
  - Bitcoin anchoring continues

---

## DNS Seed Setup (For Operators)

### Option 1: Simple A Records
```
seeds.autho.network.  300  IN  A  1.2.3.4
seeds.autho.network.  300  IN  A  5.6.7.8
seeds.autho.network.  300  IN  A  9.10.11.12
```

### Option 2: Dynamic DNS Seed (Bitcoin-style)
Run a DNS seed server that:
1. Crawls the network for active nodes
2. Returns random subset on each query
3. Filters by reachability and uptime
4. Updates every 30 minutes

---

## Manifest Hosting (For Operators)

### Host Signed Manifest
```bash
# Generate manifest
./autho-operator generate-manifest --output seed-manifest.json

# Sign with operator key
./autho-operator sign-manifest seed-manifest.json --key operator.key

# Host via HTTPS
# Place at: https://yourdomain.com/seed-manifest.json
```

### Update Manifest Periodically
```bash
# Cron job (daily)
0 0 * * * /usr/local/bin/autho-operator generate-manifest --output /var/www/seed-manifest.json
```

---

## Example: Shop Owner Shares Gateway

### Scenario
A resale store wants to run a gateway and help customers verify items.

### Setup
```bash
# Install gateway
npm install -g @autho/gateway

# Start gateway
./autho-gateway \
  --listen 8333 \
  --data-dir ./store-gateway \
  --domain verify.mystore.com
```

### Share Join Link
The store shares:
- **URL:** `https://verify.mystore.com/join`
- **QR Code:** Displayed on join page
- **Social Media:** "Join our verification network!"

### Customer Joins
```bash
# Customer downloads software
npm install -g @autho/gateway

# Customer bootstraps from store
./autho-gateway --bootstrap-url https://verify.mystore.com/bootstrap.json

# Customer's node syncs and becomes part of network
```

### Result
- Customer can verify items independently
- Customer's node helps others bootstrap
- Network grows organically
- No dependency on store's domain (fallback to other seeds)

---

## Troubleshooting

### "No peers reachable"
1. Check internet connection
2. Verify firewall allows outbound connections
3. Try different bootstrap source:
   ```bash
   ./autho-gateway --bootstrap-url https://autho.pinkmahi.com/bootstrap.json
   ```

### "Manifest signature verification failed"
1. Manifest may be outdated
2. Try alternative manifest URL
3. Fall back to hardcoded seeds (automatic)

### "DNS seed query failed"
1. DNS resolver may be blocking
2. Try alternative DNS server
3. Fall back to hardcoded seeds (automatic)

### "Sync stuck at X%"
1. Connected peer may be slow
2. Node will try additional peers automatically
3. Check peer table: `./autho-gateway peers list`

---

## Advanced: Running Your Own DNS Seed

### Requirements
- Domain name (e.g., `seeds.yourdomain.com`)
- Server with public IP
- DNS server software (BIND, PowerDNS, or custom)

### Custom DNS Seed Server
```javascript
// Example: Simple DNS seed in Node.js
const dgram = require('dgram');
const server = dgram.createSocket('udp4');

const activePeers = [
  '1.2.3.4',
  '5.6.7.8',
  '9.10.11.12'
];

server.on('message', (msg, rinfo) => {
  // Return random subset of peers
  const subset = activePeers
    .sort(() => Math.random() - 0.5)
    .slice(0, 5);
  
  // Send DNS response with A records
  // (Simplified - use proper DNS library)
});

server.bind(53);
```

---

## Why This Design?

### No Single Point of Failure
- Multiple bootstrap sources
- Automatic fallback
- Network survives domain seizures

### Permissionless Distribution
- Anyone can run gateway
- Anyone can share join link
- Anyone can host manifest mirror

### Evergreen Installations
- Installations don't become "outdated"
- Manifest updates automatically
- Peer discovery continues indefinitely

### Organic Growth
- Shop owners share their gateways
- Customers become nodes
- Network grows without central coordination

---

## Summary

**Bootstrap Sources:**
1. Bootstrap config (shareable)
2. Hardcoded seeds (shipped)
3. DNS seeds (dynamic)
4. Signed manifest (evergreen)
5. Peer gossip (ongoing)

**Security:**
- Seeds are NOT trusted
- All data verified locally
- Signatures + checkpoints + Bitcoin anchors

**Resilience:**
- No single point of failure
- Network survives as long as ANY source works
- Automatic fallback and retry

**Sharing:**
- Gateway owners share `/join` link
- New nodes bootstrap via any gateway
- Network grows organically

**Result:**
A truly decentralized network that can't be shut down, can't become outdated, and grows permissionlessly.
