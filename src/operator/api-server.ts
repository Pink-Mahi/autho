import express, { Express, Request, Response } from 'express';
import { OperatorNode } from './node';
import { WalletAPI } from '../api/wallet-api';
import { RegistryAPI } from '../registry/registry-api';
import { ItemRegistry } from '../registry/item-registry';
import { ProtocolEvent } from '../types';

export class OperatorAPIServer {
  private app: Express;
  private node: OperatorNode;
  private port: number;
  private walletAPI: WalletAPI;
  private registryAPI: RegistryAPI;
  private itemRegistry: ItemRegistry;

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
