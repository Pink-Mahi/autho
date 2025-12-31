# Coolify Deployment Guide

## 🚀 Quick Deployment to Coolify

This guide will help you deploy the Bitcoin Ownership Protocol main node to your Coolify instance.

---

## 📋 Prerequisites

- Coolify instance running
- Domain configured: `autho.pinkmahi.com` or `autho.cartpathcleaning.com`
- GitHub repository set up
- Bitcoin address for receiving fees

---

## 🎯 Recommended Setup

### Option 1: autho.pinkmahi.com (Recommended)

**Pros:**
- Shorter domain
- Professional branding
- Easy to remember

**Use this for:** Main production node

### Option 2: autho.cartpathcleaning.com

**Pros:**
- Business-specific domain
- Can use for testing/staging

**Use this for:** Staging or secondary node

---

## 🔧 Step-by-Step Deployment

### Step 1: Push to GitHub

```bash
# Initialize git (if not already done)
git init

# Add remote (use your GitHub repo)
git remote add origin https://github.com/Pink-Mahi/autho.git

# Add all files
git add .

# Commit
git commit -m "Initial commit - Bitcoin Ownership Protocol"

# Push to main branch
git push -u origin main
```

### Step 2: Configure Coolify

1. **Login to Coolify Dashboard**
   - Go to your Coolify instance

2. **Create New Application**
   - Click "New Resource" → "Application"
   - Choose "Docker Compose" or "Dockerfile"

3. **Connect GitHub Repository**
   - Repository: `https://github.com/Pink-Mahi/autho`
   - Branch: `main`
   - Build Pack: `Dockerfile`

4. **Configure Domain**
   - Domain: `autho.pinkmahi.com` (or `autho.cartpathcleaning.com`)
   - Enable HTTPS (Let's Encrypt)

5. **Set Environment Variables**

   Click "Environment Variables" and add:

   ```env
   # Main Node Configuration
   OPERATOR_ID=main-node
   OPERATOR_NAME=Bitcoin Ownership Main Node
   OPERATOR_PORT=3000
   
   # YOUR BITCOIN ADDRESS (60% of fees go here!)
   OPERATOR_BTC_ADDRESS=bc1q...your-actual-address...
   
   # Fee Distribution
   MAIN_NODE_ID=main-node
   MAIN_NODE_FEE_PERCENTAGE=60
   OPERATOR_FEE_PERCENTAGE=40
   
   # Quorum
   QUORUM_M=3
   QUORUM_N=5
   
   # Network
   BITCOIN_NETWORK=mainnet
   
   # Public URL
   PUBLIC_URL=https://autho.pinkmahi.com
   
   # API
   API_CORS_ORIGIN=*
   API_RATE_LIMIT=100
   
   # Logging
   LOG_LEVEL=info
   NODE_ENV=production
   ```

6. **Configure Persistent Storage**
   - Add volume mount: `/app/operator-data`
   - This stores your operator keys and event data

7. **Deploy**
   - Click "Deploy"
   - Coolify will build and deploy automatically

### Step 3: Verify Deployment

Once deployed, visit:

**Main Dashboard:**
```
https://autho.pinkmahi.com/dashboard
```

**Health Check:**
```
https://autho.pinkmahi.com/health
```

**Setup Wizard:**
```
https://autho.pinkmahi.com/setup
```

**Scan Interface:**
```
https://autho.pinkmahi.com/scan
```

---

## 🔐 Important: Backup Your Keys

After first deployment, Coolify will generate operator keys. **BACKUP THESE IMMEDIATELY!**

### Access Container Logs

In Coolify:
1. Go to your application
2. Click "Logs"
3. Look for:
   ```
   ✅ Keys generated successfully!
   Public Key: 02abc123...
   BTC Address: bc1q...
   ```

### Download Keys from Container

```bash
# SSH into your Coolify server
ssh user@your-coolify-server

# Access the container
docker exec -it <container-name> sh

# View keys
cat /app/operator-data/operator-keys.json

# Copy these to a safe location!
```

---

## 🌐 DNS Configuration

### For autho.pinkmahi.com

Add these DNS records in your domain registrar:

```
Type: A
Name: autho
Value: <your-coolify-server-ip>
TTL: 3600
```

Or if using a proxy:

```
Type: CNAME
Name: autho
Value: <your-coolify-domain>
TTL: 3600
```

Coolify will automatically handle SSL certificates via Let's Encrypt.

---

## 📊 Monitoring Your Main Node

### Coolify Dashboard

Monitor in Coolify:
- CPU usage
- Memory usage
- Network traffic
- Container logs
- Deployment history

### Application Metrics

Visit your dashboard:
```
https://autho.pinkmahi.com/dashboard
```

You'll see:
- 💰 Fees earned (your 60%)
- 📊 Events processed
- 🌐 Network status
- 📈 Operator stats

---

## 🔄 Continuous Deployment

### Automatic Deployments

Coolify can auto-deploy on git push:

1. In Coolify, enable "Auto Deploy"
2. Every push to `main` branch triggers deployment
3. Zero-downtime deployments

### Manual Deployments

In Coolify dashboard:
1. Go to your application
2. Click "Deploy"
3. Select branch/commit
4. Deploy

---

## 🎯 Production Checklist

Before going live:

- [ ] Bitcoin address configured (mainnet)
- [ ] Domain DNS configured
- [ ] HTTPS enabled (Let's Encrypt)
- [ ] Environment variables set
- [ ] Persistent storage configured
- [ ] Operator keys backed up
- [ ] Health check passing
- [ ] Dashboard accessible
- [ ] Logs monitoring set up
- [ ] Backup strategy in place

---

## 💰 Fee Collection

### How Fees Work

**Your main node automatically receives 60% of all fees!**

**Example Transaction:**
- Sale: 0.5 BTC
- Total fees: 750,000 sats (1.5%)
- Your share: 450,000 sats (60%)
- Goes to: `OPERATOR_BTC_ADDRESS` you configured

**Fees are distributed on:**
- Item minting
- Sales completion
- Escrow settlements
- Authentication events

### Tracking Earnings

View in dashboard:
```
https://autho.pinkmahi.com/dashboard
```

Shows:
- Total fees earned
- Fees per transaction
- Daily/monthly earnings
- Transaction history

---

## 🔧 Troubleshooting

### Container Won't Start

**Check logs in Coolify:**
```
Application → Logs
```

**Common issues:**
- Missing environment variables
- Invalid Bitcoin address
- Port conflicts

### Can't Access Dashboard

**Check:**
1. DNS propagation (can take up to 24 hours)
2. SSL certificate status in Coolify
3. Container is running
4. Firewall rules

**Test health endpoint:**
```bash
curl https://autho.pinkmahi.com/health
```

### Keys Not Generating

**Manual generation:**
```bash
# Access container
docker exec -it <container-name> sh

# Generate keys
npm run generate-keys

# View keys
cat operator-private-key.txt
```

---

## 🚀 Scaling

### Add More Operators

As your network grows:

1. Other operators deploy their nodes
2. They configure `PEER_OPERATORS` to point to your main node
3. You add their URLs to your `PEER_OPERATORS`
4. Quorum automatically forms
5. You earn 60% of all fees!

### Load Balancing

For high traffic:

1. Deploy multiple instances in Coolify
2. Use Coolify's load balancer
3. Share same persistent storage
4. All instances earn fees

---

## 📱 Mobile Access

Your main node is mobile-friendly!

Users can:
- Scan items: `https://autho.pinkmahi.com/scan`
- View items on mobile
- Create wallets on mobile
- Make purchases on mobile

---

## 🎉 You're Ready!

### After Deployment

1. **Visit your dashboard:**
   ```
   https://autho.pinkmahi.com/dashboard
   ```

2. **Share setup wizard with users:**
   ```
   https://autho.pinkmahi.com/setup
   ```

3. **Monitor earnings:**
   - Check dashboard daily
   - Watch fees accumulate
   - Track network growth

4. **Promote your network:**
   - Share domain with potential operators
   - Invite manufacturers
   - Grow the ecosystem

**You're now earning 60% of all network fees!** 🚀💰

---

## 📞 Support

**Issues with Coolify deployment?**
- Check Coolify logs
- Review environment variables
- Verify DNS settings
- Check container health

**Issues with the application?**
- Check application logs
- Verify Bitcoin address
- Test health endpoint
- Review operator keys

---

## 🔐 Security Best Practices

1. **Backup operator keys** - Store securely offline
2. **Use strong passwords** - For Coolify access
3. **Enable 2FA** - On GitHub and Coolify
4. **Monitor logs** - Watch for suspicious activity
5. **Regular updates** - Keep dependencies updated
6. **Firewall rules** - Only expose necessary ports
7. **SSL/TLS** - Always use HTTPS (Coolify handles this)

---

**Your main node is now live and earning 60% of all network fees!** 🎊
