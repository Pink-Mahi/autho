import { Request, Response } from 'express';
import * as QRCode from 'qrcode';
import { BootstrapConfig, JoinPageConfig, SeedManifest } from './bootstrap-types';
import { NetworkBootstrap } from './bootstrap';

/**
 * JOIN PAGE API
 * 
 * Provides endpoints for shareable gateway join functionality:
 * - GET /join - Join page HTML
 * - GET /api/join/config - Join page configuration
 * - GET /bootstrap.json - Bootstrap configuration file
 * - GET /seed-manifest.json - Signed seed manifest
 */
export class JoinAPI {
  private gatewayEndpoint: string;
  private gatewayPublicKey: string;
  private chainId: string;
  private networkName: string;

  constructor(
    gatewayEndpoint: string,
    gatewayPublicKey: string,
    chainId: string = 'bitcoin-mainnet',
    networkName: string = 'Bitcoin Ownership Protocol'
  ) {
    this.gatewayEndpoint = gatewayEndpoint;
    this.gatewayPublicKey = gatewayPublicKey;
    this.chainId = chainId;
    this.networkName = networkName;
  }

  /**
   * GET /api/join/config
   * 
   * Returns configuration for join page
   */
  async getJoinConfig(req: Request, res: Response): Promise<void> {
    try {
      const protocol = req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;

      const bootstrapConfigUrl = `${baseUrl}/bootstrap.json`;

      // Generate QR code for bootstrap URL
      let qrCodeDataUrl: string | undefined;
      try {
        qrCodeDataUrl = await QRCode.toDataURL(bootstrapConfigUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#1a1a1a',
            light: '#ffffff'
          }
        });
      } catch (error) {
        console.warn('[JoinAPI] Failed to generate QR code:', error);
      }

      // TODO: Get actual network stats from registry
      const networkStats = {
        totalGateways: 12,
        totalOperators: 5,
        itemsRegistered: 1247,
        uptime: 99.8
      };

      const config: JoinPageConfig = {
        gatewayName: this.gatewayEndpoint,
        gatewayEndpoint: this.gatewayEndpoint,
        gatewayPublicKey: this.gatewayPublicKey,
        networkName: this.networkName,
        chainId: this.chainId,
        bootstrapConfigUrl,
        qrCodeDataUrl,
        installCommand: 'npm install -g @autho/gateway',
        startCommand: `./autho-gateway --bootstrap ${bootstrapConfigUrl}`,
        networkStats
      };

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('[JoinAPI] Error getting join config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get join configuration'
      });
    }
  }

  /**
   * GET /bootstrap.json
   * 
   * Returns bootstrap configuration file
   */
  async getBootstrapConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = NetworkBootstrap.createBootstrapConfig(
        this.gatewayEndpoint,
        this.gatewayPublicKey,
        this.chainId
      );

      res.json(config);
    } catch (error) {
      console.error('[JoinAPI] Error getting bootstrap config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get bootstrap configuration'
      });
    }
  }

  /**
   * GET /seed-manifest.json
   * 
   * Returns signed seed manifest
   */
  async getSeedManifest(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Generate actual signed manifest with operator signatures
      const manifest: SeedManifest = {
        version: 1,
        timestamp: Date.now(),
        chainId: this.chainId,
        seeds: [
          {
            address: 'autho.pinkmahi.com:8333',
            publicKey: this.gatewayPublicKey,
            role: 'gateway',
            region: 'us-east',
            addedAt: Date.now()
          },
          {
            address: 'seed1.autho.network:8333',
            publicKey: 'seed1_public_key',
            role: 'gateway',
            region: 'eu-west',
            addedAt: Date.now()
          },
          {
            address: 'seed2.autho.network:8333',
            publicKey: 'seed2_public_key',
            role: 'gateway',
            region: 'ap-southeast',
            addedAt: Date.now()
          },
          {
            address: 'operator1.autho.network:8333',
            publicKey: 'operator1_public_key',
            role: 'operator',
            region: 'us-west',
            addedAt: Date.now()
          }
        ],
        signatures: [
          {
            signerId: 'sponsor',
            publicKey: 'sponsor_public_key',
            signature: 'sponsor_signature_placeholder',
            signedAt: Date.now()
          }
        ],
        manifestHash: 'manifest_hash_placeholder'
      };

      res.json(manifest);
    } catch (error) {
      console.error('[JoinAPI] Error getting seed manifest:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get seed manifest'
      });
    }
  }

  /**
   * POST /api/join/verify-bootstrap
   * 
   * Verifies a bootstrap configuration
   */
  async verifyBootstrapConfig(req: Request, res: Response): Promise<void> {
    try {
      const config: BootstrapConfig = req.body;

      // Basic validation
      if (!config.version || !config.chainId || !config.hardcodedSeeds) {
        res.status(400).json({
          success: false,
          error: 'Invalid bootstrap configuration'
        });
        return;
      }

      // Verify chain ID matches
      if (config.chainId !== this.chainId) {
        res.status(400).json({
          success: false,
          error: `Chain ID mismatch: expected ${this.chainId}, got ${config.chainId}`
        });
        return;
      }

      // TODO: Verify signature if present

      res.json({
        success: true,
        valid: true,
        chainId: config.chainId,
        seedCount: config.hardcodedSeeds.length
      });
    } catch (error) {
      console.error('[JoinAPI] Error verifying bootstrap config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify bootstrap configuration'
      });
    }
  }

  /**
   * GET /api/join/peers
   * 
   * Returns list of known peers (for peer discovery)
   */
  async getPeers(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Get actual peer list from network
      const peers = [
        {
          address: 'autho.pinkmahi.com:8333',
          publicKey: this.gatewayPublicKey,
          role: 'gateway',
          lastSeen: Date.now()
        },
        {
          address: 'seed1.autho.network:8333',
          publicKey: 'seed1_public_key',
          role: 'gateway',
          lastSeen: Date.now()
        }
      ];

      res.json({
        success: true,
        peers,
        count: peers.length
      });
    } catch (error) {
      console.error('[JoinAPI] Error getting peers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get peer list'
      });
    }
  }

  /**
   * GET /api/join/network-stats
   * 
   * Returns network statistics
   */
  async getNetworkStats(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Get actual stats from registry
      const stats = {
        totalGateways: 12,
        totalOperators: 5,
        itemsRegistered: 1247,
        totalTransfers: 342,
        totalAuthentications: 89,
        uptime: 99.8,
        lastCheckpointHeight: 1523,
        lastBitcoinAnchor: {
          txid: 'bitcoin_tx_placeholder',
          blockHeight: 820000,
          timestamp: Date.now() - 3600000
        }
      };

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('[JoinAPI] Error getting network stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get network statistics'
      });
    }
  }
}
