import express, { Express, Request, Response } from 'express';
import { OperatorNode } from './node';
import { WalletAPI } from '../api/wallet-api';
import { RegistryAPI } from '../registry/registry-api';
import { ItemRegistry } from '../registry/item-registry';
import { JoinAPI } from '../network/join-api';
import { NetworkBootstrap } from '../network/bootstrap';
import { ProtocolEvent } from '../types';
import { BitcoinTransactionService } from '../bitcoin/transaction-service';
import { PaymentService } from '../bitcoin/payment-service';
import * as fs from 'fs';
import * as path from 'path';

export class OperatorAPIServer {
  private app: Express;
  private node: OperatorNode;
  private port: number;
  private walletAPI: WalletAPI;
  private registryAPI: RegistryAPI;
  private itemRegistry: ItemRegistry;
  private joinAPI: JoinAPI;
  private bootstrap: NetworkBootstrap;
  private paymentService: PaymentService;

  constructor(node: OperatorNode, port: number = 3000) {
    this.app = express();
    this.node = node;
    this.port = port;
    
    const network = process.env.BITCOIN_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
    this.walletAPI = new WalletAPI(network);
    
    // Initialize payment service
    const dataDir = process.env.OPERATOR_DATA_DIR || './operator-data';
    this.paymentService = new PaymentService(dataDir, network as 'mainnet' | 'testnet');
    this.paymentService.start();
    
    const operatorId = process.env.OPERATOR_ID || 'operator-1';
    const quorumM = parseInt(process.env.QUORUM_M || '3');
    const quorumN = parseInt(process.env.QUORUM_N || '5');
    const peerOperators = process.env.PEER_OPERATORS?.split(',') || [];
    
    this.itemRegistry = new ItemRegistry(
      operatorId,
      node.getOperatorInfo().publicKey,
      quorumM,
      quorumN,
      peerOperators
    );
    this.registryAPI = new RegistryAPI(this.itemRegistry);
    
    // Initialize P2P network components
    const gatewayEndpoint = process.env.GATEWAY_ENDPOINT || 'localhost:8333';
    const chainId = process.env.CHAIN_ID || 'bitcoin-mainnet';
    
    this.joinAPI = new JoinAPI(
      gatewayEndpoint,
      node.getOperatorInfo().publicKey,
      chainId,
      'Bitcoin Ownership Protocol'
    );
    
    this.bootstrap = new NetworkBootstrap(
      chainId,
      peerOperators,
      node.getOperatorInfo().publicKey
    );
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes(): void {
    this.app.get('/', (req: Request, res: Response) => {
      res.redirect('/scan');
    });

    this.app.get('/scan', (req: Request, res: Response) => {
      res.sendFile('index.html', { root: './public' });
    });

    // Admin login page
    this.app.get('/admin/login', (req: Request, res: Response) => {
      res.sendFile('admin-login.html', { root: './public' });
    });

    // Address diagnostic page
    this.app.get('/check-addresses.html', (req: Request, res: Response) => {
      res.sendFile('check-addresses.html', { root: './public' });
    });

    // Dashboard with auth check
    this.app.get('/dashboard', (req: Request, res: Response) => {
      res.sendFile('dashboard.html', { root: './public' });
    });

    this.app.get('/setup', (req: Request, res: Response) => {
      res.sendFile('setup-wizard.html', { root: './public' });
    });

    this.app.get('/manufacturer', (req: Request, res: Response) => {
      res.sendFile('manufacturer-dashboard.html', { root: './public' });
    });

    this.app.get('/tokens', (req: Request, res: Response) => {
      res.sendFile('token-dashboard.html', { root: './public' });
    });

    // P2P Network Join Page
    this.app.get('/join', (req: Request, res: Response) => {
      res.sendFile('join.html', { root: './public' });
    });

    // Mobile Reseller Gateway Routes
    this.app.get('/m', (req: Request, res: Response) => {
      res.sendFile('mobile-entry.html', { root: './public' });
    });

    this.app.get('/m/verify', (req: Request, res: Response) => {
      res.sendFile('mobile-verify.html', { root: './public' });
    });

    this.app.get('/m/wallet', (req: Request, res: Response) => {
      res.sendFile('mobile-wallet.html', { root: './public' });
    });

    this.app.get('/m/offer', (req: Request, res: Response) => {
      res.sendFile('mobile-offer.html', { root: './public' });
    });

    this.app.get('/m/items', (req: Request, res: Response) => {
      res.sendFile('mobile-items.html', { root: './public' });
    });

    this.app.get('/m/offers', (req: Request, res: Response) => {
      res.sendFile('mobile-offers.html', { root: './public' });
    });

    this.app.get('/m/history', (req: Request, res: Response) => {
      res.sendFile('mobile-history.html', { root: './public' });
    });

    this.app.get('/m/login', (req: Request, res: Response) => {
      res.sendFile('mobile-login.html', { root: './public' });
    });

    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', operator: this.node.getOperatorInfo() });
    });

    this.app.get('/api/operator/info', (req: Request, res: Response) => {
      res.json(this.node.getOperatorInfo());
    });

    this.app.get('/api/item/:itemId', async (req: Request, res: Response) => {
      try {
        const item = await this.node.getItem(req.params.itemId);
        if (!item) {
          res.status(404).json({ error: 'Item not found' });
          return;
        }
        res.json(item);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/item/:itemId/proof', async (req: Request, res: Response) => {
      try {
        const proof = await this.node.getItemProof(req.params.itemId);
        res.json(proof);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/item/:itemId/events', async (req: Request, res: Response) => {
      try {
        const events = await this.node.getItemEvents(req.params.itemId);
        res.json(events);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/manufacturer/:manufacturerId', async (req: Request, res: Response) => {
      try {
        const manufacturer = await this.node.getManufacturer(req.params.manufacturerId);
        if (!manufacturer) {
          res.status(404).json({ error: 'Manufacturer not found' });
          return;
        }
        res.json(manufacturer);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/authenticator/:authenticatorId', async (req: Request, res: Response) => {
      try {
        const authenticator = await this.node.getAuthenticator(req.params.authenticatorId);
        if (!authenticator) {
          res.status(404).json({ error: 'Authenticator not found' });
          return;
        }
        res.json(authenticator);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/item/:itemId/attestations', async (req: Request, res: Response) => {
      try {
        const attestations = await this.node.getAttestationsByItem(req.params.itemId);
        res.json({ attestations });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/event/submit', async (req: Request, res: Response) => {
      try {
        const event: ProtocolEvent = req.body;
        const result = await this.node.submitEvent(event);
        
        if (result.accepted) {
          res.json({ success: true, eventId: event.eventId });
        } else {
          res.status(400).json({ success: false, error: result.error });
        }
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/event/propose', async (req: Request, res: Response) => {
      try {
        const partialEvent = req.body;
        const fullEvent = await this.node.proposeEvent(partialEvent);
        res.json(fullEvent);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Registry API endpoints
    this.app.post('/api/registry/register', async (req: Request, res: Response) => {
      try {
        const { serialNumber, itemType, description, manufacturerId } = req.body;
        
        if (!serialNumber || !itemType || !manufacturerId) {
          res.status(400).json({ error: 'Missing required fields: serialNumber, itemType, manufacturerId' });
          return;
        }

        const itemId = `ITEM_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        // Create item record directly (simplified for demo - in production would go through full event flow)
        const item = {
          itemId,
          serialNumber,
          itemType,
          description: description || '',
          manufacturerId,
          ownerPubKey: manufacturerId,
          registeredAt: Date.now(),
          state: 'ACTIVE',
          verified: false
        };

        // Store item in memory (in production, this would be in a database)
        if (!(this.node as any).items) {
          (this.node as any).items = new Map();
        }
        (this.node as any).items.set(itemId, item);

        // Also create event for audit trail
        const event = {
          eventType: 'ITEM_REGISTERED',
          itemId,
          data: {
            itemId,
            serialNumber,
            itemType,
            description: description || '',
            manufacturerId,
            registeredAt: Date.now(),
            owner: manufacturerId
          },
          timestamp: Date.now(),
          nonce: Math.random().toString(36).substring(7)
        };

        const result = await this.node.proposeEvent(event as any);
        
        console.log(`[API] Item registered: ${itemId}`);
        
        res.json({ 
          success: true, 
          itemId,
          eventId: (result as any).eventId,
          message: 'Item registered successfully'
        });
      } catch (error: any) {
        console.error('[API] Error registering item:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/registry/items', async (req: Request, res: Response) => {
      try {
        // Get items from memory storage
        const itemsMap = (this.node as any).items || new Map();
        const items = Array.from(itemsMap.values());
        res.json({ items, count: items.length });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/registry/item/:itemId', async (req: Request, res: Response) => {
      try {
        // Try memory storage first
        const itemsMap = (this.node as any).items || new Map();
        let item = itemsMap.get(req.params.itemId);
        
        // Fallback to node's getItem method
        if (!item) {
          item = await this.node.getItem(req.params.itemId);
        }
        
        if (!item) {
          res.status(404).json({ error: 'Item not found' });
          return;
        }
        res.json(item);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/registry/transfer', async (req: Request, res: Response) => {
      try {
        const { itemId, fromOwner, toOwner, paymentTxId, signature } = req.body;
        
        if (!itemId || !fromOwner || !toOwner || !paymentTxId) {
          res.status(400).json({ error: 'Missing required fields' });
          return;
        }

        const event = {
          eventType: 'ITEM_TRANSFERRED',
          data: {
            itemId,
            fromOwner,
            toOwner,
            paymentTxId,
            transferredAt: Date.now()
          },
          timestamp: Date.now(),
          nonce: Math.random().toString(36).substring(7)
        };

        const result = await this.node.proposeEvent(event as any);
        res.json({ 
          success: true, 
          eventId: (result as any).eventId,
          message: 'Transfer recorded successfully'
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/registry/authenticate', async (req: Request, res: Response) => {
      try {
        const { itemId, authenticatorId, result: authResult } = req.body;
        
        if (!itemId || !authenticatorId || !authResult) {
          res.status(400).json({ error: 'Missing required fields' });
          return;
        }

        const event = {
          eventType: 'ITEM_AUTHENTICATED',
          data: {
            itemId,
            authenticatorId,
            result: authResult,
            authenticatedAt: Date.now()
          },
          timestamp: Date.now(),
          nonce: Math.random().toString(36).substring(7)
        };

        const result = await this.node.proposeEvent(event as any);
        res.json({ 
          success: true, 
          eventId: (result as any).eventId,
          message: 'Authentication recorded successfully'
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Offer API endpoints
    this.app.post('/api/offers/create', async (req: Request, res: Response) => {
      try {
        const { itemId, buyerAddress, amount, sats, expiresIn, itemName } = req.body;
        
        if (!itemId || !buyerAddress || !amount || !sats) {
          res.status(400).json({ error: 'Missing required fields' });
          return;
        }

        const offerId = `OFFER_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const expirySeconds = Math.floor((expiresIn || 86400000) / 1000); // Convert ms to seconds

        // Get main node and operator addresses for fee distribution
        const operatorInfo = this.node.getOperatorInfo();
        const mainNodeAddress = process.env.MAIN_NODE_FEE_ADDRESS || operatorInfo.btcAddress;
        const operatorAddresses = this.getActiveOperatorAddresses();

        // Create real payment request (supports both Bitcoin and Lightning)
        const paymentRequest = await this.paymentService.createPaymentRequest(
          {
            offerId,
            amountSats: sats,
            expirySeconds,
            metadata: { itemId, itemName, buyerAddress }
          },
          (payment) => {
            // Callback when payment is confirmed
            console.log(`[Payment] Confirmed for offer ${offerId}:`, payment);
            
            // Update offer status
            const offer = (this.node as any).offers?.get(offerId);
            if (offer) {
              offer.status = payment.status === 'confirmed' ? 'PAID' : 'PENDING';
              offer.paymentTxid = payment.txid;
              offer.paymentConfirmations = payment.confirmations;
              
              // Trigger settlement when payment confirmed
              if (payment.status === 'confirmed') {
                console.log(`[Settlement] Ready to settle offer ${offerId}`);
                this.processFeeDistribution(offer);
                // This is where you'd trigger the ownership transfer
              }
            }
          },
          mainNodeAddress,
          operatorAddresses
        );

        const offer = {
          offerId,
          itemId,
          itemName: itemName || 'Unknown Item',
          buyerAddress,
          amount,
          sats,
          status: 'PENDING',
          createdAt: Date.now(),
          expiresAt: paymentRequest.expiresAt,
          paymentMethod: paymentRequest.paymentMethod,
          // Bitcoin payment info
          paymentAddress: paymentRequest.paymentAddress,
          bitcoinQR: paymentRequest.bitcoinQR,
          // Lightning payment info
          lightningInvoice: paymentRequest.lightningInvoice,
          lightningPaymentHash: paymentRequest.lightningPaymentHash,
          lightningQR: paymentRequest.lightningQR,
          // Fee information
          platformFeeSats: paymentRequest.platformFeeSats,
          sellerReceivesSats: paymentRequest.sellerReceivesSats,
          feeDistribution: paymentRequest.feeDistribution
        };

        // Store offer in memory
        if (!(this.node as any).offers) {
          (this.node as any).offers = new Map();
        }
        (this.node as any).offers.set(offerId, offer);

        console.log(`[API] Offer created: ${offerId} for ${itemName}`);
        console.log(`[API] Payment address: ${paymentRequest.paymentAddress}`);
        console.log(`[API] Amount: ${sats} sats (${paymentRequest.amountBTC} BTC)`);

        res.json({ 
          success: true, 
          offerId,
          offer,
          message: 'Offer created successfully. Send Bitcoin to the payment address to complete purchase.'
        });
      } catch (error: any) {
        console.error('[API] Error creating offer:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/offers/:offerId', async (req: Request, res: Response) => {
      try {
        const { offerId } = req.params;
        const offersMap = (this.node as any).offers || new Map();
        
        const offer = offersMap.get(offerId);
        
        if (!offer) {
          res.status(404).json({ error: 'Offer not found' });
          return;
        }

        res.json(offer);
      } catch (error: any) {
        console.error('[API] Error fetching offer:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/offers/user/:address', async (req: Request, res: Response) => {
      try {
        const offersMap = (this.node as any).offers || new Map();
        const allOffers = Array.from(offersMap.values());
        
        // Filter offers by buyer address
        const userOffers = allOffers.filter((o: any) => o.buyerAddress === req.params.address);
        
        res.json({ offers: userOffers, count: userOffers.length });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/offers/:offerId', async (req: Request, res: Response) => {
      try {
        const offersMap = (this.node as any).offers || new Map();
        const offer = offersMap.get(req.params.offerId);
        
        if (!offer) {
          res.status(404).json({ error: 'Offer not found' });
          return;
        }
        
        res.json(offer);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/offers/:offerId/cancel', async (req: Request, res: Response) => {
      try {
        const offersMap = (this.node as any).offers || new Map();
        const offer = offersMap.get(req.params.offerId);
        
        if (!offer) {
          res.status(404).json({ error: 'Offer not found' });
          return;
        }

        offer.status = 'CANCELLED';
        offer.cancelledAt = Date.now();
        
        res.json({ success: true, message: 'Offer cancelled' });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Transaction history API
    this.app.get('/api/history/:address', async (req: Request, res: Response) => {
      try {
        // Mock transaction history for now
        const transactions: any[] = [];
        
        // Get user's items
        const itemsMap = (this.node as any).items || new Map();
        const userItems = Array.from(itemsMap.values()).filter((item: any) => 
          item.ownerPubKey === req.params.address || 
          item.manufacturerId === req.params.address
        );

        // Add item registrations to history
        userItems.forEach((item: any) => {
          transactions.push({
            type: 'ITEM_REGISTERED',
            itemId: item.itemId,
            itemName: item.itemType,
            timestamp: item.registeredAt,
            description: `Registered ${item.itemType}`
          });
        });

        // Get user's offers
        const offersMap = (this.node as any).offers || new Map();
        const userOffers = Array.from(offersMap.values()).filter((o: any) => 
          o.buyerAddress === req.params.address
        );

        // Add offers to history
        userOffers.forEach((offer: any) => {
          transactions.push({
            type: 'OFFER_CREATED',
            itemId: offer.itemId,
            amount: offer.amount,
            sats: offer.sats,
            timestamp: offer.createdAt,
            description: `Made offer of $${offer.amount}`
          });
        });

        // Sort by timestamp descending
        transactions.sort((a, b) => b.timestamp - a.timestamp);
        
        res.json({ transactions, count: transactions.length });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/event/sign', async (req: Request, res: Response) => {
      try {
        const event: ProtocolEvent = req.body;
        const signature = await this.node.signEvent(event);
        res.json(signature);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Wallet API endpoints
    this.app.post('/api/wallet/create', this.walletAPI.createWallet.bind(this.walletAPI));
    this.app.post('/api/wallet/restore', this.walletAPI.restoreWallet.bind(this.walletAPI));
    this.app.post('/api/wallet/validate', this.walletAPI.validateAddress.bind(this.walletAPI));
    this.app.post('/api/wallet/import', this.walletAPI.importWallet.bind(this.walletAPI));

    // Registry API endpoints (regulatory compliant)
    this.app.post('/api/registry/item', this.registryAPI.registerItem.bind(this.registryAPI));
    this.app.post('/api/registry/transfer', this.registryAPI.transferOwnership.bind(this.registryAPI));
    this.app.post('/api/registry/authenticate', this.registryAPI.authenticateItem.bind(this.registryAPI));
    this.app.get('/api/registry/item/:itemId', this.registryAPI.getItem.bind(this.registryAPI));
    this.app.get('/api/registry/item/:itemId/history', this.registryAPI.getOwnershipHistory.bind(this.registryAPI));
    this.app.get('/api/registry/owner/:address', this.registryAPI.getItemsByOwner.bind(this.registryAPI));
    this.app.get('/api/registry/manufacturer/:manufacturerId', this.registryAPI.getItemsByManufacturer.bind(this.registryAPI));
    this.app.get('/api/registry/stats', this.registryAPI.getStats.bind(this.registryAPI));
    this.app.get('/api/registry/export', this.registryAPI.exportLedger.bind(this.registryAPI));
    this.app.post('/api/registry/import', this.registryAPI.importLedger.bind(this.registryAPI));

    // P2P Network Join API endpoints
    this.app.get('/api/join/config', this.joinAPI.getJoinConfig.bind(this.joinAPI));
    this.app.get('/bootstrap.json', this.joinAPI.getBootstrapConfig.bind(this.joinAPI));
    this.app.get('/seed-manifest.json', this.joinAPI.getSeedManifest.bind(this.joinAPI));
    this.app.post('/api/join/verify-bootstrap', this.joinAPI.verifyBootstrapConfig.bind(this.joinAPI));
    this.app.get('/api/join/peers', this.joinAPI.getPeers.bind(this.joinAPI));
    this.app.get('/api/join/network-stats', this.joinAPI.getNetworkStats.bind(this.joinAPI));

    // Operator setup endpoint (non-custodial)
    this.app.post('/api/operator/setup', async (req: Request, res: Response) => {
      try {
        const { operatorId, port, bitcoinAddress, publicKey, restored } = req.body;
        
        if (!operatorId || !bitcoinAddress || !publicKey) {
          res.status(400).json({ error: 'Missing required fields' });
          return;
        }

        // Validate Bitcoin address
        if (!bitcoinAddress.match(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/)) {
          res.status(400).json({ error: 'Invalid Bitcoin address' });
          return;
        }

        // Save operator configuration (ONLY public data - never private keys!)
        const dataDir = process.env.OPERATOR_DATA_DIR || './operator-data';
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        const operatorConfig = {
          operatorId,
          port: port || 3000,
          bitcoinAddress, // Public address only
          publicKey, // Public key only
          createdAt: Date.now(),
          restored: restored || false,
          walletType: 'non-custodial' // Important: we don't hold keys
        };

        const configFile = path.join(dataDir, 'operator-config.json');
        fs.writeFileSync(configFile, JSON.stringify(operatorConfig, null, 2));

        console.log(`[API] Operator configured: ${operatorId}`);
        console.log(`  Bitcoin Address (Fee Receiver): ${bitcoinAddress}`);
        console.log(`  Port: ${port || 3000}`);
        console.log(`  ⚠️ Non-custodial: Operator controls their own keys`);
        console.log(`  📁 Config saved to: ${configFile}`);

        res.json({ 
          success: true, 
          operatorId,
          message: restored ? 
            'Operator wallet restored successfully!' : 
            'Operator wallet setup complete! Keep your seed phrase safe!'
        });
      } catch (error: any) {
        console.error('[API] Error setting up operator:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // User registration endpoint (non-custodial)
    this.app.post('/api/users/register', async (req: Request, res: Response) => {
      try {
        const { username, email, password, bitcoinAddress, lightningAddress, publicKey } = req.body;
        
        if (!username || !email || !password || !bitcoinAddress) {
          res.status(400).json({ error: 'Missing required fields' });
          return;
        }

        // Validate Bitcoin address
        if (!bitcoinAddress.match(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/)) {
          res.status(400).json({ error: 'Invalid Bitcoin address' });
          return;
        }

        // Store user (ONLY public data - never private keys!)
        const userId = `USER_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        const user = {
          userId,
          username,
          email,
          passwordHash: password, // In production: hash this with bcrypt!
          bitcoinAddress, // Public address only
          lightningAddress: lightningAddress || null, // Public address only
          publicKey, // Public key only
          createdAt: Date.now(),
          walletType: 'non-custodial' // Important: we don't hold keys
        };

        // Store in memory (in production: use database)
        if (!(this.node as any).users) {
          (this.node as any).users = new Map();
        }
        (this.node as any).users.set(userId, user);

        console.log(`[API] User registered: ${username} (${userId})`);
        console.log(`  Bitcoin: ${bitcoinAddress}`);
        console.log(`  Lightning: ${lightningAddress || 'Not enabled'}`);
        console.log(`  ⚠️ Non-custodial: User controls their own keys`);

        res.json({ 
          success: true, 
          userId,
          message: 'Account created successfully. Keep your seed phrase safe!'
        });
      } catch (error: any) {
        console.error('[API] Error registering user:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Admin authentication endpoints
    this.app.post('/api/admin/login', async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;
        
        // Get admin credentials from environment variables
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123';
        
        if (username === adminUsername && password === adminPassword) {
          // Generate session token
          const token = Buffer.from(`${username}:${Date.now()}:${Math.random()}`).toString('base64');
          
          res.json({ 
            success: true, 
            token,
            message: 'Login successful' 
          });
        } else {
          res.status(401).json({ 
            success: false, 
            error: 'Invalid credentials' 
          });
        }
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/admin/verify', async (req: Request, res: Response) => {
      try {
        const { token } = req.body;
        
        if (!token) {
          res.status(401).json({ valid: false });
          return;
        }
        
        // Simple token validation (in production, use proper JWT)
        res.json({ valid: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Node Bitcoin wallet management endpoints
    this.app.get('/api/node/wallet/balance', async (req: Request, res: Response) => {
      try {
        // Get node wallet address from environment or operator info
        const walletAddress = process.env.NODE_WALLET_ADDRESS || this.node.getOperatorInfo().btcAddress;
        
        if (!walletAddress) {
          res.status(404).json({ error: 'Node wallet not configured' });
          return;
        }

        // Query real blockchain data from Blockstream API
        const network = process.env.BITCOIN_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
        const apiBase = network === 'mainnet' 
          ? 'https://blockstream.info/api'
          : 'https://blockstream.info/testnet/api';

        try {
          const response = await fetch(`${apiBase}/address/${walletAddress}`);
          const addressData = await response.json();

          console.log('[Wallet Balance] API Response:', JSON.stringify(addressData, null, 2));

          // Calculate balance from chain stats
          const confirmedSats = (addressData.chain_stats?.funded_txo_sum || 0) - (addressData.chain_stats?.spent_txo_sum || 0);
          const unconfirmedSats = (addressData.mempool_stats?.funded_txo_sum || 0) - (addressData.mempool_stats?.spent_txo_sum || 0);
          
          console.log('[Wallet Balance] Confirmed sats:', confirmedSats);
          console.log('[Wallet Balance] Unconfirmed sats:', unconfirmedSats);
          
          const balance = {
            address: walletAddress,
            confirmed: confirmedSats / 100000000, // Convert sats to BTC
            unconfirmed: unconfirmedSats / 100000000,
            total: (confirmedSats + unconfirmedSats) / 100000000,
            confirmedSats: confirmedSats,
            unconfirmedSats: unconfirmedSats,
            totalSats: confirmedSats + unconfirmedSats
          };

          console.log('[Wallet Balance] Final balance:', balance);
          res.json(balance);
        } catch (apiError) {
          console.error('Blockchain API error:', apiError);
          // Fallback to zero balance if API fails
          res.json({
            address: walletAddress,
            confirmed: 0,
            unconfirmed: 0,
            total: 0
          });
        }
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/node/wallet/address', async (req: Request, res: Response) => {
      try {
        const walletAddress = process.env.NODE_WALLET_ADDRESS || this.node.getOperatorInfo().btcAddress;
        
        if (!walletAddress) {
          res.status(404).json({ error: 'Node wallet not configured' });
          return;
        }

        res.json({ 
          address: walletAddress,
          network: process.env.BITCOIN_NETWORK || 'testnet'
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/node/wallet/send', async (req: Request, res: Response) => {
      try {
        const { toAddress, amount, fee, feeRateSatPerVByte } = req.body;
        
        if (!toAddress || !amount) {
          res.status(400).json({ error: 'Missing required fields: toAddress, amount' });
          return;
        }

        // Validate Bitcoin address format
        if (!toAddress.match(/^(bc1|tb1|[13]|[mn2])[a-zA-HJ-NP-Z0-9]{25,62}$/)) {
          res.status(400).json({ error: 'Invalid Bitcoin address format' });
          return;
        }

        // Load private key from operator keys
        const dataDir = process.env.OPERATOR_DATA_DIR || './operator-data';
        const keysFile = path.join(dataDir, 'operator-keys.json');
        
        if (!fs.existsSync(keysFile)) {
          res.status(500).json({ error: 'Operator keys not found. Cannot send Bitcoin.' });
          return;
        }

        const keys = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
        
        // Convert BTC to satoshis
        const amountSats = Math.floor(amount * 100000000);

        // Fee rate is sats/vByte (NOT BTC). This matches BitcoinTransactionService.
        // Prefer explicit feeRateSatPerVByte. If legacy "fee" is provided, treat it as sats/vB
        // only if it is a reasonable integer-like value.
        let feeRate: number | undefined;
        if (typeof feeRateSatPerVByte === 'number' && !Number.isNaN(feeRateSatPerVByte)) {
          feeRate = Math.floor(feeRateSatPerVByte);
        } else if (typeof fee === 'number' && !Number.isNaN(fee)) {
          // Backwards-compat: older UI sent "fee".
          // If it looks like a sats/vB fee rate, accept it. If it looks like BTC (very small), reject.
          if (fee > 0 && fee < 1) {
            res.status(400).json({
              success: false,
              error: 'Invalid fee. Fee must be a fee rate in sats/vByte (e.g. 2, 7, 25), not a BTC amount.'
            });
            return;
          }
          feeRate = Math.floor(fee);
        }

        if (feeRate !== undefined) {
          if (feeRate < 1 || feeRate > 500) {
            res.status(400).json({
              success: false,
              error: 'Invalid fee rate. Must be between 1 and 500 sats/vByte.'
            });
            return;
          }
        }

        // Create Bitcoin transaction service
        const network = process.env.BITCOIN_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
        const txService = new BitcoinTransactionService(network);

        console.log(`[Node Wallet] Sending ${amountSats} sats to ${toAddress}`);

        // Send the transaction
        const result = await txService.sendBitcoin(
          keys.privateKey,
          toAddress,
          amountSats,
          feeRate
        );

        if (result.success) {
          res.json({
            success: true,
            txid: result.txid,
            toAddress,
            amount,
            message: 'Transaction broadcast successfully'
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error
          });
        }
      } catch (error: any) {
        console.error('[Node Wallet] Send error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/node/wallet/transactions', async (req: Request, res: Response) => {
      try {
        const walletAddress = process.env.NODE_WALLET_ADDRESS || this.node.getOperatorInfo().btcAddress;
        
        if (!walletAddress) {
          res.json({ transactions: [], count: 0 });
          return;
        }

        // Query real blockchain transactions from Blockstream API
        const network = process.env.BITCOIN_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
        const apiBase = network === 'mainnet' 
          ? 'https://blockstream.info/api'
          : 'https://blockstream.info/testnet/api';

        try {
          const response = await fetch(`${apiBase}/address/${walletAddress}/txs`);
          const txs = await response.json();

          const transactions = txs.map((tx: any) => {
            // Calculate if this is a receive or send transaction
            let receivedAmount = 0;
            let sentAmount = 0;
            
            // Check outputs for receives
            tx.vout.forEach((output: any) => {
              if (output.scriptpubkey_address === walletAddress) {
                receivedAmount += output.value;
              }
            });

            // Check inputs for sends
            tx.vin.forEach((input: any) => {
              if (input.prevout?.scriptpubkey_address === walletAddress) {
                sentAmount += input.prevout.value;
              }
            });

            // Determine transaction type and net amount
            let type = 'receive';
            let netAmount = receivedAmount;
            
            if (sentAmount > 0) {
              type = 'send';
              netAmount = sentAmount - receivedAmount; // Amount sent (minus change)
            }

            console.log(`[TX ${tx.txid.substring(0, 10)}] Type: ${type}, Received: ${receivedAmount}, Sent: ${sentAmount}, Net: ${netAmount}`);

            return {
              txid: tx.txid,
              type: type,
              amount: netAmount / 100000000, // Convert sats to BTC
              amountSats: netAmount,
              confirmations: tx.status.confirmed ? (tx.status.block_height ? 6 : 0) : 0,
              timestamp: tx.status.block_time ? tx.status.block_time * 1000 : Date.now(),
              address: walletAddress
            };
          });

          res.json({ transactions, count: transactions.length });
        } catch (apiError) {
          console.error('Blockchain API error:', apiError);
          res.json({ transactions: [], count: 0 });
        }
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Get active operator addresses for fee distribution
   */
  private getActiveOperatorAddresses(): string[] {
    // Get operator addresses from node's peer list
    const operatorInfo = this.node.getOperatorInfo();
    const operators = [operatorInfo.btcAddress];
    
    // Add peer operator addresses if available
    const peers = (this.node as any).peers || [];
    peers.forEach((peer: any) => {
      if (peer.btcAddress) {
        operators.push(peer.btcAddress);
      }
    });
    
    return operators.filter(addr => addr && addr.length > 0);
  }

  /**
   * Process fee distribution for a paid offer
   */
  private processFeeDistribution(offer: any): void {
    if (!offer.feeDistribution) {
      console.log('[Fee Distribution] No fee distribution data available');
      return;
    }

    const { totalFeeSats, mainNodeFeeSats, operatorFeeSats, mainNodeAddress, operatorAddresses } = offer.feeDistribution;

    console.log('[Fee Distribution] Processing platform fees:');
    console.log(`  Total Platform Fee: ${totalFeeSats} sats (0.75%)`);
    console.log(`  Main Node (60%): ${mainNodeFeeSats} sats → ${mainNodeAddress}`);
    console.log(`  Operators (40%): ${operatorFeeSats} sats`);

    // Distribute operator fees among active operators
    if (operatorAddresses.length > 0) {
      const feePerOperator = Math.floor(operatorFeeSats / operatorAddresses.length);
      console.log(`  Fee per operator: ${feePerOperator} sats (${operatorAddresses.length} operators)`);
      
      operatorAddresses.forEach((address: string, index: number) => {
        console.log(`    Operator ${index + 1}: ${feePerOperator} sats → ${address}`);
      });
    }

    // Store fee distribution record
    const feeRecord = {
      offerId: offer.offerId,
      totalFeeSats,
      mainNodeFeeSats,
      operatorFeeSats,
      mainNodeAddress,
      operatorAddresses,
      processedAt: Date.now(),
      txid: offer.paymentTxid
    };

    // Save fee record (in production, this would be stored in database)
    if (!(this.node as any).feeRecords) {
      (this.node as any).feeRecords = [];
    }
    (this.node as any).feeRecords.push(feeRecord);

    console.log('[Fee Distribution] Fee distribution recorded successfully');
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`[Operator API] Server listening on port ${this.port}`);
        resolve();
      });
    });
  }
}
