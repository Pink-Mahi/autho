import { Request, Response } from 'express';
import { DistributedTokenLedger } from './token-ledger';
import { 
  TokenMintRequest, 
  TokenSaleRequest, 
  TokenEmbedRequest, 
  TokenTransferRequest 
} from './token-types';

export class TokenAPI {
  private ledger: DistributedTokenLedger;

  constructor(ledger: DistributedTokenLedger) {
    this.ledger = ledger;
  }

  /**
   * POST /api/token/mint
   * Main node mints new tokens
   */
  async mintTokens(req: Request, res: Response): Promise<void> {
    try {
      const request: TokenMintRequest = req.body;

      if (!request.quantity || request.quantity <= 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid quantity'
        });
        return;
      }

      const tokens = await this.ledger.mintTokens(request);

      res.json({
        success: true,
        tokens: tokens.map(t => ({
          tokenId: t.tokenId,
          status: t.status,
          owner: t.currentOwner,
          mintedAt: t.mintedAt
        })),
        message: `Successfully minted ${tokens.length} tokens`
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/token/sell
   * Main node sells tokens to manufacturer
   */
  async sellTokens(req: Request, res: Response): Promise<void> {
    try {
      const request: TokenSaleRequest = req.body;

      if (!request.tokenIds || request.tokenIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No tokens specified'
        });
        return;
      }

      if (!request.buyer) {
        res.status(400).json({
          success: false,
          error: 'Buyer address required'
        });
        return;
      }

      const result = await this.ledger.sellTokens(request);

      res.json({
        success: true,
        tokensSold: request.tokenIds.length,
        buyer: request.buyer,
        price: request.price,
        message: `Successfully sold ${request.tokenIds.length} tokens`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/token/embed
   * Manufacturer embeds item data into token
   */
  async embedItemData(req: Request, res: Response): Promise<void> {
    try {
      const request: TokenEmbedRequest = req.body;

      if (!request.tokenId) {
        res.status(400).json({
          success: false,
          error: 'Token ID required'
        });
        return;
      }

      if (!request.itemData) {
        res.status(400).json({
          success: false,
          error: 'Item data required'
        });
        return;
      }

      const token = await this.ledger.embedItemData(request);

      res.json({
        success: true,
        token: {
          tokenId: token.tokenId,
          status: token.status,
          itemData: token.itemData,
          embeddedAt: token.embeddedAt
        },
        message: 'Item data permanently embedded in token'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/token/transfer
   * Transfer token to new owner
   */
  async transferToken(req: Request, res: Response): Promise<void> {
    try {
      const request: TokenTransferRequest = req.body;

      if (!request.tokenId || !request.from || !request.to) {
        res.status(400).json({
          success: false,
          error: 'Token ID, from, and to addresses required'
        });
        return;
      }

      const token = await this.ledger.transferToken(request);

      res.json({
        success: true,
        token: {
          tokenId: token.tokenId,
          previousOwner: request.from,
          newOwner: token.currentOwner,
          transferredAt: Date.now()
        },
        message: 'Token transferred successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/token/:tokenId
   * Get token details
   */
  async getToken(req: Request, res: Response): Promise<void> {
    try {
      const { tokenId } = req.params;
      const token = this.ledger.getToken(tokenId);

      if (!token) {
        res.status(404).json({
          success: false,
          error: 'Token not found'
        });
        return;
      }

      res.json({
        success: true,
        token
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/token/:tokenId/history
   * Get token ownership history
   */
  async getTokenHistory(req: Request, res: Response): Promise<void> {
    try {
      const { tokenId } = req.params;
      const history = this.ledger.getTokenHistory(tokenId);

      if (history.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Token not found'
        });
        return;
      }

      res.json({
        success: true,
        tokenId,
        history
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/token/owner/:address
   * Get all tokens owned by address
   */
  async getTokensByOwner(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;
      const tokens = this.ledger.getTokensByOwner(address);

      res.json({
        success: true,
        owner: address,
        tokenCount: tokens.length,
        tokens: tokens.map(t => ({
          tokenId: t.tokenId,
          status: t.status,
          itemData: t.itemData,
          mintedAt: t.mintedAt
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
   * GET /api/token/stats
   * Get token ledger statistics
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.ledger.getStats();

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
   * POST /api/token/validate
   * Validate transaction (called by peer nodes)
   */
  async validateTransaction(req: Request, res: Response): Promise<void> {
    try {
      const tx = req.body;
      const isValid = await this.ledger.validateTransaction(tx);

      res.json({
        success: true,
        valid: isValid,
        message: isValid ? 'Transaction validated' : 'Transaction validation failed'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/token/ledger/export
   * Export ledger state for syncing
   */
  async exportLedger(req: Request, res: Response): Promise<void> {
    try {
      const ledgerData = this.ledger.exportLedger();

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
   * POST /api/token/ledger/import
   * Import ledger state for syncing
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

      this.ledger.importLedger(JSON.stringify(ledgerData));

      res.json({
        success: true,
        message: 'Ledger imported successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
