import { Request, Response } from 'express';
import { ItemRegistry } from './item-registry';
import { 
  ItemRegistrationRequest, 
  OwnershipTransferRequest, 
  AuthenticationRequest 
} from './registry-types';

/**
 * REGULATORY-COMPLIANT REGISTRY API
 * 
 * This API provides access to a NON-CUSTODIAL item registry.
 * It is NOT a token API, financial platform, or money transmitter.
 * 
 * Terminology:
 * - "register item" (not "mint token")
 * - "transfer ownership" (not "transfer token")
 * - "item record" (not "NFT" or "token")
 * - "ownership state" (not "balance")
 */
export class RegistryAPI {
  private registry: ItemRegistry;

  constructor(registry: ItemRegistry) {
    this.registry = registry;
  }

  /**
   * POST /api/registry/item
   * Manufacturer registers a newly manufactured physical item.
   * 
   * CRITICAL: Can only be called when physical item exists.
   */
  async registerItem(req: Request, res: Response): Promise<void> {
    try {
      const request: ItemRegistrationRequest = req.body;

      if (!request.manufacturerId || !request.serialNumber || !request.metadata) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: manufacturerId, serialNumber, metadata'
        });
        return;
      }

      if (!request.metadata.itemType || !request.metadata.description) {
        res.status(400).json({
          success: false,
          error: 'Metadata must include itemType and description'
        });
        return;
      }

      const itemRecord = await this.registry.registerItem(request);

      res.json({
        success: true,
        itemRecord: {
          itemId: itemRecord.itemId,
          status: itemRecord.status,
          currentOwner: itemRecord.currentOwner,
          registeredAt: itemRecord.registeredAt
        },
        message: 'Physical item successfully registered in registry'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/registry/transfer
   * Transfer ownership of physical item.
   * 
   * Requires verification of peer-to-peer Bitcoin payment (non-custodial).
   */
  async transferOwnership(req: Request, res: Response): Promise<void> {
    try {
      const request: OwnershipTransferRequest = req.body;

      if (!request.itemId || !request.currentOwner || !request.newOwner) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: itemId, currentOwner, newOwner'
        });
        return;
      }

      if (!request.paymentTxHash) {
        res.status(400).json({
          success: false,
          error: 'Payment transaction hash required for ownership transfer'
        });
        return;
      }

      const itemRecord = await this.registry.transferOwnership(request);

      res.json({
        success: true,
        itemRecord: {
          itemId: itemRecord.itemId,
          previousOwner: request.currentOwner,
          newOwner: itemRecord.currentOwner,
          transferredAt: Date.now()
        },
        message: 'Ownership successfully transferred'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/registry/authenticate
   * Third-party authenticator verifies physical item.
   * 
   * This is informational only and does not affect ownership.
   */
  async authenticateItem(req: Request, res: Response): Promise<void> {
    try {
      const request: AuthenticationRequest = req.body;

      if (!request.itemId || !request.authenticatorId || !request.serialNumber) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: itemId, authenticatorId, serialNumber'
        });
        return;
      }

      const itemRecord = await this.registry.authenticateItem(request);

      res.json({
        success: true,
        authentication: {
          itemId: itemRecord.itemId,
          isAuthentic: request.isAuthentic,
          confidence: request.confidence,
          authenticatedAt: Date.now()
        },
        message: 'Item authentication recorded'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/registry/item/:itemId
   * Get item record details.
   */
  async getItem(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      const itemRecord = this.registry.getItem(itemId);

      if (!itemRecord) {
        res.status(404).json({
          success: false,
          error: 'Item not found in registry'
        });
        return;
      }

      res.json({
        success: true,
        itemRecord
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/registry/item/:itemId/history
   * Get ownership history (provenance chain).
   */
  async getOwnershipHistory(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      const history = this.registry.getOwnershipHistory(itemId);

      if (history.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Item not found in registry'
        });
        return;
      }

      res.json({
        success: true,
        itemId,
        ownershipHistory: history
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/registry/owner/:address
   * Get all items owned by address.
   */
  async getItemsByOwner(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;
      const items = this.registry.getItemsByOwner(address);

      res.json({
        success: true,
        owner: address,
        itemCount: items.length,
        items: items.map(item => ({
          itemId: item.itemId,
          status: item.status,
          manufacturerId: item.manufacturerId,
          registeredAt: item.registeredAt
        }))
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/registry/manufacturer/:manufacturerId
   * Get all items registered by manufacturer.
   */
  async getItemsByManufacturer(req: Request, res: Response): Promise<void> {
    try {
      const { manufacturerId } = req.params;
      const items = this.registry.getItemsByManufacturer(manufacturerId);

      res.json({
        success: true,
        manufacturerId,
        itemCount: items.length,
        items: items.map(item => ({
          itemId: item.itemId,
          status: item.status,
          currentOwner: item.currentOwner,
          registeredAt: item.registeredAt
        }))
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/registry/stats
   * Get registry statistics.
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.registry.getStats();

      res.json({
        success: true,
        stats
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/registry/export
   * Export registry ledger for syncing.
   */
  async exportLedger(req: Request, res: Response): Promise<void> {
    try {
      const ledgerData = this.registry.exportLedger();

      res.json({
        success: true,
        ledger: JSON.parse(ledgerData)
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/registry/import
   * Import registry ledger for syncing.
   */
  async importLedger(req: Request, res: Response): Promise<void> {
    try {
      const { ledgerData } = req.body;

      if (!ledgerData) {
        res.status(400).json({
          success: false,
          error: 'Ledger data required'
        });
        return;
      }

      this.registry.importLedger(JSON.stringify(ledgerData));

      res.json({
        success: true,
        message: 'Registry ledger imported successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
