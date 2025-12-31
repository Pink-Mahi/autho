# Network Setup Guide

## Connecting Multiple Operator Nodes

This guide explains how to connect multiple operator nodes to form a working network.

## 🌐 Network Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Operator 1    │◄───────►│   Operator 2    │◄───────►│   Operator 3    │
│  Your Computer  │         │ Friend's Server │         │  Cloud Server   │
│  192.168.1.50   │         │  192.168.1.100  │         │  operator3.com  │
└─────────────────┘         └─────────────────┘         └─────────────────┘
         │                           │                           │
         └───────────────────────────┴───────────────────────────┘
                        All sync events automatically
```

## 🚀 Quick Setup (Local Network)

### Step 1: Configure Each Node

**Computer 1 (Operator 1):**
```env
# .env
OPERATOR_ID=operator-1
OPERATOR_PORT=3000
OPERATOR_BTC_ADDRESS=bc1q...your-address-1...

# Peer operators (comma-separated)
PEER_OPERATORS=http://192.168.1.100:3000,http://192.168.1.101:3000

QUORUM_M=2
QUORUM_N=3
```

**Computer 2 (Operator 2):**
```env
# .env
OPERATOR_ID=operator-2
OPERATOR_PORT=3000
OPERATOR_BTC_ADDRESS=bc1q...your-address-2...

PEER_OPERATORS=http://192.168.1.50:3000,http://192.168.1.101:3000

QUORUM_M=2
QUORUM_N=3
```

**Computer 3 (Operator 3):**
```env
# .env
OPERATOR_ID=operator-3
OPERATOR_PORT=3000
OPERATOR_BTC_ADDRESS=bc1q...your-address-3...

PEER_OPERATORS=http://192.168.1.50:3000,http://192.168.1.100:3000

QUORUM_M=2
QUORUM_N=3
```

### Step 2: Find Your IP Address

**Windows:**
```bash
ipconfig
# Look for "IPv4 Address"
```

**Mac/Linux:**
```bash
ifconfig
# or
ip addr show
```

### Step 3: Open Firewall Ports

**Windows Firewall:**
```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "Bitcoin Ownership Protocol" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

**Linux (ufw):**
```bash
sudo ufw allow 3000/tcp
```

**Mac:**
```bash
# System Preferences > Security & Privacy > Firewall > Firewall Options
# Add Node.js and allow incoming connections
```

### Step 4: Start All Nodes

On each computer:
```bash
npm run operator
```

### Step 5: Verify Connection

Check the dashboard at `http://localhost:3000/dashboard` - you should see all peer operators listed.

---

## 🌍 Internet Setup (Public Network)

### Option 1: Using ngrok (Easiest for Testing)

**On each computer:**

```bash
# Install ngrok
npm install -g ngrok

# Start your operator
npm run operator

# In another terminal, expose it
ngrok http 3000
```

You'll get a URL like: `https://abc123.ngrok.io`

**Update .env with ngrok URLs:**
```env
PEER_OPERATORS=https://abc123.ngrok.io,https://def456.ngrok.io
```

### Option 2: Using Cloud Servers

**Deploy to DigitalOcean/AWS/etc:**

```bash
# On your server
git clone <your-repo>
cd bitcoin-ownership-protocol
npm install
npm run build

# Configure .env with public IP
OPERATOR_PORT=3000
PEER_OPERATORS=http://operator2.example.com:3000,http://operator3.example.com:3000

# Start with PM2 (keeps running)
npm install -g pm2
pm2 start npm --name "operator" -- run operator
pm2 save
```

### Option 3: Using Domain Names

**If you have domains:**

```env
# Operator 1
PEER_OPERATORS=https://operator2.example.com,https://operator3.example.com

# Operator 2
PEER_OPERATORS=https://operator1.example.com,https://operator3.example.com

# Operator 3
PEER_OPERATORS=https://operator1.example.com,https://operator2.example.com
```

---

## 🔧 Network Configuration Options

### Quorum Settings

```env
# 2-of-3 (simple majority)
QUORUM_M=2
QUORUM_N=3

# 3-of-5 (recommended for production)
QUORUM_M=3
QUORUM_N=5

# 5-of-9 (high security)
QUORUM_M=5
QUORUM_N=9
```

### Sync Settings

```env
# How often to sync with peers (milliseconds)
SYNC_INTERVAL_MS=5000

# Timeout for peer requests (milliseconds)
PEER_TIMEOUT_MS=10000

# Retry failed peer connections
PEER_RETRY_ATTEMPTS=3
```

---

## 🧪 Testing Network Connection

### Test 1: Ping Peers

```bash
# From Operator 1, test Operator 2
curl http://192.168.1.100:3000/health

# Should return:
# {"status":"healthy","operator":{"operatorId":"operator-2",...}}
```

### Test 2: Submit Event

```bash
# Submit an event from one node
curl -X POST http://localhost:3000/api/event/submit \
  -H "Content-Type: application/json" \
  -d '{"eventType":"ITEM_MINTED",...}'

# Check if it appears on other nodes
curl http://192.168.1.100:3000/api/events
```

### Test 3: Check Quorum

```bash
# View operator info
curl http://localhost:3000/api/operator/info

# Should show peer count and quorum status
```

---

## 🐛 Troubleshooting

### Problem: Nodes Can't Connect

**Check 1: Firewall**
```bash
# Test if port is open
telnet 192.168.1.100 3000
# or
nc -zv 192.168.1.100 3000
```

**Check 2: IP Address**
```bash
# Verify you're using the correct IP
ping 192.168.1.100
```

**Check 3: Node is Running**
```bash
# Check if node is listening
netstat -an | grep 3000
# or
lsof -i :3000
```

### Problem: Events Not Syncing

**Check peer health:**
```bash
curl http://localhost:3000/api/peers/health
```

**Check event log:**
```bash
# Look for sync errors
tail -f operator-data/logs/operator.log
```

### Problem: Quorum Not Reached

**Verify quorum settings:**
- All nodes must have same M and N values
- At least M nodes must be online
- All nodes must have each other as peers

---

## 📊 Network Monitoring

### Dashboard Metrics

Each operator dashboard shows:
- **Peer Status** - Online/offline for each peer
- **Event Sync** - Last sync time and event count
- **Quorum Health** - Current M-of-N status
- **Network Latency** - Response time to peers

### Health Check Endpoint

```bash
GET /api/network/health

Response:
{
  "localOperator": "operator-1",
  "peers": [
    {"id": "operator-2", "status": "online", "lastSeen": 1234567890},
    {"id": "operator-3", "status": "online", "lastSeen": 1234567890}
  ],
  "quorum": {"m": 2, "n": 3, "healthy": true},
  "syncStatus": "synced"
}
```

---

## 🔐 Security Best Practices

### 1. Use HTTPS in Production

```env
# Use SSL certificates
OPERATOR_ENDPOINT=https://operator1.example.com
PEER_OPERATORS=https://operator2.example.com,https://operator3.example.com
```

### 2. Authenticate Peer Connections

```env
# Require peer authentication
PEER_AUTH_ENABLED=true
PEER_AUTH_TOKEN=your-secret-token
```

### 3. Rate Limiting

```env
# Limit requests per peer
PEER_RATE_LIMIT=100
PEER_RATE_WINDOW_MS=60000
```

### 4. Whitelist Peers

```env
# Only accept connections from known peers
PEER_WHITELIST_ENABLED=true
PEER_WHITELIST=operator-1,operator-2,operator-3
```

---

## 🎯 Production Deployment Checklist

- [ ] All operators have unique IDs
- [ ] All operators have unique BTC addresses
- [ ] Firewall rules configured
- [ ] HTTPS/TLS enabled
- [ ] Peer authentication enabled
- [ ] Monitoring and alerts set up
- [ ] Backup strategy in place
- [ ] DDoS protection configured
- [ ] Rate limiting enabled
- [ ] Health checks automated

---

## 💡 Example Setups

### Setup 1: Friends Running Nodes

**3 friends, local network:**
- Friend 1: Home computer (192.168.1.50)
- Friend 2: Home computer (192.168.1.100)
- Friend 3: Home computer (192.168.1.101)
- Quorum: 2-of-3
- Connection: Direct IP addresses

### Setup 2: Small Business

**5 operators, mixed:**
- Operator 1: Office server (office.example.com)
- Operator 2: AWS EC2 (aws.example.com)
- Operator 3: DigitalOcean (do.example.com)
- Operator 4: Home office (ngrok URL)
- Operator 5: Partner company (partner.example.com)
- Quorum: 3-of-5
- Connection: Domain names + HTTPS

### Setup 3: Enterprise

**9 operators, distributed:**
- 3 in US (different data centers)
- 3 in Europe (different data centers)
- 3 in Asia (different data centers)
- Quorum: 5-of-9
- Connection: Load-balanced domains + HTTPS
- Monitoring: 24/7 SOC

---

## 🚀 Next Steps

1. **Start with 2-3 nodes locally** to test
2. **Verify events sync** between nodes
3. **Test quorum signatures** work correctly
4. **Expand to internet** using ngrok or cloud
5. **Add more operators** as network grows
6. **Monitor and optimize** performance

---

**Need help?** Check the troubleshooting section or open an issue on GitHub!
