# 🚀 Quick Deployment to Coolify

## TL;DR - Deploy in 5 Minutes

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Pink-Mahi/autho.git
git push -u origin main

# 2. In Coolify:
# - New Application → Dockerfile
# - Repo: https://github.com/Pink-Mahi/autho
# - Domain: autho.pinkmahi.com
# - Add environment variables (see below)
# - Deploy!

# 3. Visit: https://autho.pinkmahi.com/dashboard
```

---

## 🎯 Recommended Domain

**Use: `autho.pinkmahi.com`**

Why?
- ✅ Shorter and cleaner
- ✅ Professional branding
- ✅ Easy to remember
- ✅ Perfect for main production node

---

## 📋 Environment Variables for Coolify

Copy these into Coolify's environment variables section:

```env
OPERATOR_ID=main-node
OPERATOR_NAME=Bitcoin Ownership Main Node
OPERATOR_PORT=3000
OPERATOR_BTC_ADDRESS=bc1q...your-actual-bitcoin-address...
MAIN_NODE_ID=main-node
MAIN_NODE_FEE_PERCENTAGE=60
OPERATOR_FEE_PERCENTAGE=40
QUORUM_M=3
QUORUM_N=5
BITCOIN_NETWORK=mainnet
PUBLIC_URL=https://autho.pinkmahi.com
API_CORS_ORIGIN=*
API_RATE_LIMIT=100
LOG_LEVEL=info
NODE_ENV=production
OPERATOR_DATA_DIR=/app/operator-data
```

**IMPORTANT:** Replace `OPERATOR_BTC_ADDRESS` with your actual Bitcoin address where you want to receive 60% of all fees!

---

## 🔧 Coolify Setup Steps

### 1. Create New Application

In Coolify dashboard:
- Click "New Resource"
- Select "Application"
- Choose "Public Repository"

### 2. Configure Source

- **Repository URL:** `https://github.com/Pink-Mahi/autho`
- **Branch:** `main`
- **Build Pack:** `Dockerfile`

### 3. Set Domain

- **Domain:** `autho.pinkmahi.com`
- **Enable HTTPS:** ✅ (Let's Encrypt automatic)

### 4. Add Environment Variables

Paste the environment variables from above.

### 5. Configure Storage

Add persistent volume:
- **Source:** `operator-data`
- **Destination:** `/app/operator-data`
- **Type:** `volume`

This ensures your operator keys and data persist across deployments.

### 6. Deploy

Click "Deploy" and watch the magic happen!

---

## ✅ Verify Deployment

After deployment completes (2-3 minutes):

**Health Check:**
```
https://autho.pinkmahi.com/health
```

**Dashboard:**
```
https://autho.pinkmahi.com/dashboard
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

## 💰 You're Earning 60% of Fees!

Once deployed, your main node automatically:

- ✅ Receives 60% of all network fees
- ✅ Validates transactions
- ✅ Co-signs with quorum
- ✅ Serves API requests
- ✅ Provides web interfaces

**Example earnings:**
- 10 sales/day = ~$18,000/month (your 60%)
- 100 sales/day = ~$180,000/month (your 60%)

---

## 🔐 Backup Your Keys

**CRITICAL:** After first deployment, backup your operator keys!

### Method 1: Via Coolify Logs

1. Go to your application in Coolify
2. Click "Logs"
3. Look for the key generation output
4. Copy and save securely

### Method 2: Via Container Shell

In Coolify:
1. Click "Shell" on your application
2. Run: `cat /app/operator-data/operator-keys.json`
3. Copy the output to a secure location

**Store these keys safely!** They're needed to:
- Prove your operator identity
- Sign transactions
- Recover your node

---

## 🌐 DNS Configuration

In your DNS provider (for pinkmahi.com):

```
Type: A
Name: autho
Value: <your-coolify-server-ip>
TTL: 3600
```

Or if using Cloudflare proxy:

```
Type: CNAME
Name: autho
Value: <your-coolify-domain>
TTL: Auto
Proxy: Enabled
```

DNS propagation takes 5-60 minutes.

---

## 🔄 Auto-Deploy on Git Push

Enable in Coolify:

1. Go to your application
2. Settings → "Auto Deploy"
3. Toggle ON

Now every push to `main` branch auto-deploys!

---

## 📊 Monitoring

### In Coolify Dashboard

Monitor:
- CPU/Memory usage
- Network traffic
- Container logs
- Deployment history
- Resource usage

### In Your Application Dashboard

Visit `https://autho.pinkmahi.com/dashboard` to see:
- 💰 Total fees earned (your 60%)
- 📊 Events processed
- 🌐 Network status
- 👥 Connected operators
- 📈 Real-time stats

---

## 🎯 Production Checklist

Before going live:

- [ ] GitHub repo created and pushed
- [ ] Coolify application configured
- [ ] Domain DNS configured (autho.pinkmahi.com)
- [ ] Environment variables set (especially BTC address!)
- [ ] Persistent storage configured
- [ ] HTTPS enabled (automatic via Let's Encrypt)
- [ ] Health check passing
- [ ] Dashboard accessible
- [ ] Operator keys backed up
- [ ] Monitoring enabled

---

## 🚨 Troubleshooting

### Build Fails

**Check Coolify logs for:**
- Missing dependencies
- TypeScript errors
- Docker build issues

**Solution:** Review logs and fix any errors in code.

### Can't Access Domain

**Possible causes:**
1. DNS not propagated yet (wait 5-60 minutes)
2. SSL certificate pending (wait 2-5 minutes)
3. Container not running (check Coolify)

**Test with IP:**
```
http://<coolify-server-ip>:3000/health
```

### Environment Variables Not Working

**Check:**
1. Variables are set in Coolify (not in code)
2. No typos in variable names
3. Values are properly formatted
4. Container restarted after changes

---

## 🎉 Next Steps

After successful deployment:

### 1. Share with Users
```
Setup: https://autho.pinkmahi.com/setup
Scan: https://autho.pinkmahi.com/scan
```

### 2. Invite Operators

Other operators can join by:
- Deploying their own nodes
- Setting `PEER_OPERATORS=https://autho.pinkmahi.com`
- Forming the quorum

### 3. Monitor Earnings

Check dashboard daily:
```
https://autho.pinkmahi.com/dashboard
```

Watch your 60% fee share grow!

### 4. Scale as Needed

Coolify makes it easy to:
- Add more resources
- Scale horizontally
- Load balance
- Monitor performance

---

## 💡 Pro Tips

1. **Use autho.pinkmahi.com** - It's cleaner and more professional
2. **Enable auto-deploy** - Automatic updates on git push
3. **Monitor logs** - Catch issues early
4. **Backup keys regularly** - Don't lose access
5. **Test on staging first** - Use autho.cartpathcleaning.com for testing
6. **Set up alerts** - Get notified of issues
7. **Keep dependencies updated** - Security and performance

---

## 📞 Support

**Coolify Issues:**
- Check Coolify documentation
- Review container logs
- Verify environment variables

**Application Issues:**
- Check application logs in Coolify
- Test health endpoint
- Verify Bitcoin address is valid
- Review operator keys

---

**You're ready to deploy and start earning 60% of all network fees!** 🚀💰

See `COOLIFY_DEPLOYMENT.md` for detailed documentation.
