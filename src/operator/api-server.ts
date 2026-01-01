import express, { Express, Request, Response } from 'express';
import { OperatorNode } from './node';
import { WalletAPI } from '../api/wallet-api';
import { RegistryAPI } from '../registry/registry-api';
import { ItemRegistry } from '../registry/item-registry';
import { JoinAPI } from '../network/join-api';
import { NetworkBootstrap } from '../network/bootstrap';
import { ProtocolEvent } from '../types';

export class OperatorAPIServer {
  private app: Express;
  private node: OperatorNode;
  private port: number;
  private walletAPI: WalletAPI;
  private registryAPI: RegistryAPI;
  private itemRegistry: ItemRegistry;
  private joinAPI: JoinAPI;
  private bootstrap: NetworkBootstrap;

  constructor(node: OperatorNode, port: number = 3000) {
    this.app = express();
    this.node = node;
    this.port = port;
    
    const network = process.env.BITCOIN_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
    this.walletAPI = new WalletAPI(network);
    
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
        
        // Create ITEM_REGISTERED event
        const event = {
          eventType: 'ITEM_REGISTERED',
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
        res.json({ 
          success: true, 
          itemId,
          eventId: (result as any).eventId,
          message: 'Item registered successfully'
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/registry/items', async (req: Request, res: Response) => {
      try {
        // Mock implementation - in production, query from event log
        const items = (this.node as any).getAllItems ? await (this.node as any).getAllItems() : [];
        res.json({ items });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/registry/item/:itemId', async (req: Request, res: Response) => {
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
