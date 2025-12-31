# Getting Started Guide

This guide will help you set up and run the Bitcoin-Native Product Ownership Protocol.

## 🚀 Quick Start (5 minutes)

### Prerequisites

- **Node.js** 18+ and npm
- **Git** (optional)
- **Windows/Mac/Linux** - Works on all platforms

### Installation

```bash
# Navigate to the project
cd bitcoin-ownership-protocol

# Install dependencies
npm install

# Build the project
npm run build
```

### Run the Demo

```bash
# Run the complete demo (shows full flow)
npm run demo
```

This will:
1. Start 5 operator nodes
2. Register a manufacturer
3. Mint a luxury watch
4. Scan and verify the item
5. Complete a full sale with BTC payment
6. Show all events and state transitions

---

## 🖥️ Running as an Operator Node

Yes! Anyone can run an operator node and earn BTC fees.

### Step 1: Create Your Operator Configuration

Create a file `.env` (copy from `.env.example`):

```bash
# Operator Configuration
OPERATOR_ID=my-operator-1
OPERATOR_NAME=My Operator Node
OPERATOR_PORT=3000

# Your Bitcoin Address (for receiving fees)
OPERATOR_BTC_ADDRESS=bc1q...your-address...

# Quorum Configuration
QUORUM_M=3
QUORUM_N=5

# Data Directory
OPERATOR_DATA_DIR=./operator-data

# Peer Operators (comma-separated URLs)
PEER_OPERATORS=http://operator1.example.com:3000,http://operator2.example.com:3001
```

### Step 2: Generate Your Operator Keys

```bash
npm run generate-keys
```

This creates:
- `operator-private-key.txt` (KEEP SECRET!)
- `operator-public-key.txt` (share with network)
- `operator-address.txt` (your BTC address)

### Step 3: Start Your Operator Node

```bash
npm run operator
```

Your node is now:
- ✅ Listening on port 3000
- ✅ Validating events
- ✅ Co-signing with quorum
- ✅ Earning BTC fees
- ✅ Serving API requests

### Step 4: Monitor Your Node

Open browser: `http://localhost:3000/dashboard`

You'll see:
- Events processed
- Items tracked
- Fees earned
- Quorum status
- Network health

---

## 📱 User Interfaces

### 1. Buyer Scan Interface

**Web App:** `http://localhost:3000/scan`

Features:
- Scan QR codes (camera or upload)
- View item authenticity
- See manufacturer info
- Check attestations
- Create purchase offers

**Mobile App:** (Coming soon - iOS/Android)

### 2. Seller Interface

**Web App:** `http://localhost:3000/sell`

Features:
- List your items
- Accept offers
- Track sales
- View payment status
- Manage inventory

### 3. Manufacturer Dashboard

**Web App:** `http://localhost:3000/manufacturer`

Features:
- Register as manufacturer
- Mint new items
- Assign to owners
- Track all items
- View analytics

### 4. Operator Dashboard

**Web App:** `http://localhost:3000/dashboard`

Features:
- Event log viewer
- Network status
- Fee earnings
- Quorum health
- System metrics

---

## 🔧 Configuration Options

### Operator Settings

```env
# Network
OPERATOR_PORT=3000
API_CORS_ORIGIN=*

# Storage
OPERATOR_DATA_DIR=./operator-data
BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=24

# Bitcoin Integration
BITCOIN_RPC_URL=http://localhost:8332
BITCOIN_RPC_USER=rpcuser
BITCOIN_RPC_PASSWORD=rpcpassword

# Lightning Network (optional)
LND_URL=https://localhost:8080
LND_MACAROON=your_macaroon_hex

# Fees
REGISTRATION_FEE_SATS=10000
MINTING_FEE_SATS=5000
ESCROW_FEE_PERCENT=1.0
SETTLEMENT_FEE_PERCENT=0.5

# Anchoring
ANCHOR_FREQUENCY_EVENTS=1000
ANCHOR_FREQUENCY_HOURS=24
```

---

## 💰 Earning as an Operator

### Fee Structure

Operators earn BTC fees from:

1. **Manufacturer Registration** - 10,000 sats (one-time)
2. **Item Minting** - 5,000 sats per item
3. **Escrow Fees** - 1% of sale price
4. **Settlement Fees** - 0.5% of sale price

### Fee Distribution

For a 0.5 BTC sale (50,000,000 sats):
- Escrow fee: 500,000 sats
- Settlement fee: 250,000 sats
- **Total: 750,000 sats**

Split among M operators (e.g., 3-of-5):
- **Each operator: 250,000 sats** (~$100 at $40k BTC)

### Requirements to Earn

- ✅ Run operator node 24/7
- ✅ Validate events correctly
- ✅ Co-sign with quorum
- ✅ Maintain uptime >99%
- ✅ Respond to queries quickly

### Estimated Earnings

**Low Volume** (10 sales/day):
- ~7.5M sats/day
- ~225M sats/month
- ~$9,000/month (at $40k BTC)

**Medium Volume** (100 sales/day):
- ~75M sats/day
- ~2.25B sats/month
- ~$90,000/month (at $40k BTC)

**High Volume** (1000 sales/day):
- ~750M sats/day
- ~22.5B sats/month
- ~$900,000/month (at $40k BTC)

---

## 🌐 Network Topology

### Recommended Setup

```
┌─────────────────────────────────────────────────────────┐
│                    OPERATOR NETWORK                      │
│                                                          │
│  Operator 1 (Exchange)     Operator 2 (Auditor)        │
│  Operator 3 (Manufacturer) Operator 4 (Independent)     │
│  Operator 5 (Community)                                 │
│                                                          │
│  Quorum: 3-of-5 required for all events                │
└─────────────────────────────────────────────────────────┘
                           │
                           │ Queries
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    CLIENT APPS                           │
│                                                          │
│  • Buyer Scan App      • Seller Dashboard               │
│  • Manufacturer Portal • Authenticator Tools            │
└─────────────────────────────────────────────────────────┘
```

### Joining the Network

1. **Contact existing operators** - Get peer list
2. **Configure your node** - Set peer URLs
3. **Generate keys** - Create operator identity
4. **Start node** - Begin syncing events
5. **Register** - Submit operator registration
6. **Get approved** - Existing operators vote
7. **Start earning** - Begin co-signing events

---

## 🔒 Security Best Practices

### For Operators

1. **Secure Private Keys**
   - Store in hardware security module (HSM)
   - Never commit to git
   - Encrypt at rest
   - Regular backups

2. **Network Security**
   - Use HTTPS/TLS
   - Firewall rules
   - DDoS protection
   - Rate limiting

3. **Monitoring**
   - Set up alerts
   - Track uptime
   - Monitor disk space
   - Watch for anomalies

4. **Backups**
   - Daily automated backups
   - Off-site storage
   - Test restore process
   - Keep 30 days history

### For Users

1. **Verify Everything**
   - Check quorum signatures
   - Validate manufacturer
   - Confirm ownership proof
   - Review attestations

2. **Secure Wallets**
   - Use hardware wallets
   - Never share private keys
   - Verify addresses
   - Test with small amounts

---

## 📊 System Requirements

### Minimum (Operator Node)

- **CPU:** 2 cores
- **RAM:** 4 GB
- **Storage:** 50 GB SSD
- **Network:** 10 Mbps up/down
- **OS:** Linux/Windows/Mac

### Recommended (Operator Node)

- **CPU:** 4+ cores
- **RAM:** 8+ GB
- **Storage:** 100+ GB SSD
- **Network:** 100 Mbps up/down
- **OS:** Ubuntu 22.04 LTS

### For Development

- **CPU:** 2+ cores
- **RAM:** 4+ GB
- **Storage:** 20 GB
- **Network:** Any

---

## 🐛 Troubleshooting

### Node Won't Start

```bash
# Check logs
npm run logs

# Verify configuration
npm run check-config

# Reset data (WARNING: deletes everything)
npm run reset
```

### Can't Connect to Peers

```bash
# Test peer connectivity
npm run test-peers

# Check firewall
sudo ufw status

# Verify DNS
nslookup operator1.example.com
```

### Events Not Syncing

```bash
# Force sync
npm run sync

# Check quorum status
npm run quorum-status

# Verify signatures
npm run verify-events
```

### Database Issues

```bash
# Repair database
npm run repair-db

# Rebuild indexes
npm run rebuild-indexes

# Check integrity
npm run check-integrity
```

---

## 📚 Next Steps

### For Operators

1. ✅ Complete this guide
2. 📖 Read [SECURITY.md](./SECURITY.md)
3. 🔧 Configure your node
4. 🚀 Join the network
5. 💰 Start earning fees

### For Developers

1. ✅ Run the demo
2. 📖 Read [PROTOCOL_SPEC.md](./PROTOCOL_SPEC.md)
3. 🔨 Build integrations
4. 🧪 Write tests
5. 🤝 Contribute code

### For Manufacturers

1. ✅ Understand the protocol
2. 📝 Register your company
3. 🏷️ Mint your items
4. 📦 Integrate with production
5. 📊 Track analytics

### For Buyers/Sellers

1. ✅ Download scan app
2. 📱 Scan items
3. ✅ Verify authenticity
4. 💰 Buy/sell with confidence
5. 🔄 Track ownership history

---

## 🆘 Support

### Community

- **Discord:** discord.gg/bitcoin-ownership
- **Telegram:** t.me/bitcoin_ownership
- **Forum:** forum.bitcoin-ownership.org

### Documentation

- [Protocol Spec](./PROTOCOL_SPEC.md)
- [Security Model](./SECURITY.md)
- [Authenticators](./AUTHENTICATORS.md)
- [API Reference](./README.md#api-reference)

### Issues

- **GitHub:** github.com/bitcoin-ownership/protocol/issues
- **Email:** support@bitcoin-ownership.org

---

## 🎉 You're Ready!

Choose your path:

**🖥️ Run an Operator Node:**
```bash
npm run operator
```

**📱 Use the Scan App:**
```bash
npm run web-ui
# Open http://localhost:3000/scan
```

**🏭 Become a Manufacturer:**
```bash
npm run manufacturer-portal
# Open http://localhost:3000/manufacturer
```

**🔨 Start Developing:**
```bash
npm run dev
# Edit code and see changes live
```

---

**Welcome to the Bitcoin-Native Product Ownership Protocol!** 🚀
