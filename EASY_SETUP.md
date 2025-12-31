# Super Easy Setup Guide

## 🚀 One-Click Installation

### Windows Users

**Double-click this file:**
```
install.bat
```

That's it! The installer will:
1. ✅ Check if Node.js is installed
2. ✅ Install all dependencies
3. ✅ Build the project
4. ✅ Generate your operator keys
5. ✅ Create configuration file

### Mac/Linux Users

**Run this command:**
```bash
chmod +x install.sh
./install.sh
```

---

## 💰 Fee Structure (You Earn 60%!)

### How Fees Work

**Your Main Node:** 60% of all fees
**Other Operators:** Split the remaining 40%

### Example: 0.5 BTC Sale

**Total Fees:** 750,000 sats (1.5% of sale)

**Your Share (Main Node):**
- 60% = **450,000 sats** (~$180 at $40k BTC)

**Other Operators (3 operators):**
- 40% split 3 ways = 100,000 sats each

### Monthly Earnings (Your 60%)

| Sales/Day | Your Monthly Income |
|-----------|---------------------|
| 10 | ~$54,000 |
| 50 | ~$270,000 |
| 100 | ~$540,000 |

---

## 🎯 Three Simple Steps

### Step 1: Install

**Windows:**
```
Double-click: install.bat
```

**Mac/Linux:**
```bash
./install.sh
```

### Step 2: Add Your Bitcoin Address

Open `.env` file and add your address:
```env
OPERATOR_BTC_ADDRESS=bc1q...your-address-here...
```

**Don't have a Bitcoin address?**
- Use the built-in wallet creator (see below)
- Or use any Bitcoin wallet (Coinbase, Cash App, etc.)

### Step 3: Start Earning

```bash
npm run operator
```

Open: `http://localhost:3000/dashboard`

---

## 💳 Built-In Wallet Creation

### Option 1: Setup Wizard (Easiest)

Open: `http://localhost:3000/setup`

The wizard will:
1. Ask what you want to do (operator, buyer, seller)
2. Create a Bitcoin wallet for you
3. Give you a 24-word backup phrase
4. Configure everything automatically

### Option 2: Command Line

```bash
npm run create-wallet
```

This generates:
- Bitcoin address
- Private key
- 24-word recovery phrase

**IMPORTANT:** Write down the 24 words and store them safely!

### Option 3: Use Existing Wallet

Just paste your existing Bitcoin address in `.env`:
```env
OPERATOR_BTC_ADDRESS=bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
```

Works with addresses from:
- ✅ Coinbase
- ✅ Cash App
- ✅ Binance
- ✅ Any Bitcoin wallet

---

## 🎨 User-Friendly Features

### For Buyers/Sellers

**Create Account:**
1. Go to `http://localhost:3000/setup`
2. Choose "Buy Items" or "Sell Items"
3. Create new wallet OR import existing
4. Done! Start buying/selling

**Wallet Options:**
- **Create New** - We generate a secure wallet
- **Import Existing** - Use your current Bitcoin address
- **Restore from Seed** - Recover from 24-word phrase

### For Operators

**Setup Wizard:**
1. Choose "Run an Operator Node"
2. Create or import wallet
3. Set your node name
4. Start earning!

**Dashboard Shows:**
- 💰 Your earnings (60% of all fees)
- 📊 Events processed
- 🌐 Network status
- 📈 Real-time stats

---

## 🔐 Wallet Security

### We Generate Secure Wallets

**What you get:**
- 24-word recovery phrase (BIP39 standard)
- Bitcoin address (SegWit format)
- Private key (encrypted)

**How to backup:**
1. Write down 24 words on paper
2. Store in safe place
3. Never share with anyone
4. Never store digitally (no photos, no cloud)

### Import Your Own Wallet

**Supported formats:**
- Bitcoin address (bc1...)
- Private key (WIF format)
- 24-word mnemonic

**Compatible with:**
- Ledger hardware wallets
- Trezor hardware wallets
- Electrum
- Bitcoin Core
- Any BIP39 wallet

---

## 📱 Mobile-Friendly

### Users Can:

**On Desktop:**
- Full dashboard
- Complete setup wizard
- Wallet management

**On Mobile:**
- Scan items with camera
- View item details
- Make offers
- Check wallet balance

---

## 🎯 Quick Start Checklist

- [ ] Run installer (install.bat or install.sh)
- [ ] Open setup wizard (http://localhost:3000/setup)
- [ ] Create or import wallet
- [ ] Write down 24-word backup phrase
- [ ] Start operator node
- [ ] Check dashboard
- [ ] Start earning!

---

## 💡 Pro Tips

### Maximize Your Earnings

1. **Run 24/7** - More uptime = more fees
2. **Fast internet** - Quick responses earn more
3. **Invite operators** - More sales = more fees
4. **Promote network** - Help it grow

### Keep Your Wallet Safe

1. **Backup phrase** - Write it down, store safely
2. **Never share** - Private keys stay private
3. **Use hardware wallet** - For large amounts
4. **Test first** - Start with small amounts

### Get Help

**Setup Issues:**
- Check: http://localhost:3000/setup
- Run: npm run operator --help

**Wallet Questions:**
- Built-in wallet creator is secure
- Uses industry-standard BIP39
- Compatible with all major wallets

---

## 🎉 You're Ready!

**For Operators:**
```bash
npm run operator
```
Then open: http://localhost:3000/dashboard

**For Users:**
```bash
npm run operator
```
Then open: http://localhost:3000/setup

**Questions?**
- Check the dashboard
- Visit the setup wizard
- Read GETTING_STARTED.md

---

## 🔥 Why This is Easy

**Like Bitcoin Core, but simpler:**
- ✅ One-click installer
- ✅ Built-in wallet creation
- ✅ Visual setup wizard
- ✅ No command-line required
- ✅ Works on Windows/Mac/Linux
- ✅ Mobile-friendly interface

**You earn 60% of fees automatically!**

Start now and begin earning Bitcoin! 🚀
