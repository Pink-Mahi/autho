import { Request, Response } from 'express';
import { WalletManager } from '../wallet/wallet-manager';

export class WalletAPI {
  private walletManager: WalletManager;

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.walletManager = new WalletManager(network);
  }

  /**
   * POST /api/wallet/create
   * Generate a new Bitcoin wallet with real BIP39 mnemonic
   */
  async createWallet(req: Request, res: Response): Promise<void> {
    try {
      const wallet = this.walletManager.createWallet();

      res.json({
        success: true,
        wallet: {
          address: wallet.address,
          publicKey: wallet.publicKey,
          mnemonic: wallet.mnemonic,
          derivationPath: wallet.derivationPath,
          network: wallet.network
        },
        warning: 'CRITICAL: Write down the 24-word mnemonic and store it safely. This is the ONLY way to recover your wallet. Never share it with anyone.'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/wallet/restore
   * Restore wallet from 24-word mnemonic
   */
  async restoreWallet(req: Request, res: Response): Promise<void> {
    try {
      const { mnemonic, accountIndex } = req.body;

      if (!mnemonic) {
        res.status(400).json({
          success: false,
          error: 'Mnemonic is required'
        });
        return;
      }

      const wallet = this.walletManager.restoreFromMnemonic(
        mnemonic,
        accountIndex || 0
      );

      res.json({
        success: true,
        wallet: {
          address: wallet.address,
          publicKey: wallet.publicKey,
          derivationPath: wallet.derivationPath,
          network: wallet.network
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/wallet/validate
   * Validate a Bitcoin address
   */
  async validateAddress(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.body;

      if (!address) {
        res.status(400).json({
          success: false,
          error: 'Address is required'
        });
        return;
      }

      const isValid = this.walletManager.validateAddress(address);
      const addressType = isValid
        ? this.walletManager.getAddressType(address)
        : 'Invalid';

      res.json({
        success: true,
        valid: isValid,
        addressType
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/wallet/import
   * Import wallet from private key (WIF format)
   */
  async importWallet(req: Request, res: Response): Promise<void> {
    try {
      const { privateKey } = req.body;

      if (!privateKey) {
        res.status(400).json({
          success: false,
          error: 'Private key is required'
        });
        return;
      }

      const wallet = this.walletManager.importFromPrivateKey(privateKey);

      res.json({
        success: true,
        wallet: {
          address: wallet.address,
          publicKey: wallet.publicKey,
          derivationPath: wallet.derivationPath,
          network: wallet.network
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}
