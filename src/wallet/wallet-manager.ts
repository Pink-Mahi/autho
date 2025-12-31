import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

const ECPair = ECPairFactory(ecc);

export interface WalletInfo {
  address: string;
  publicKey: string;
  privateKey?: string;
  mnemonic?: string;
  derivationPath: string;
  network: 'mainnet' | 'testnet';
}

export interface WalletBalance {
  confirmed: number;
  unconfirmed: number;
  total: number;
}

export class WalletManager {
  private network: bitcoin.Network;

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network === 'mainnet' 
      ? bitcoin.networks.bitcoin 
      : bitcoin.networks.testnet;
  }

  /**
   * Create a new Bitcoin wallet with mnemonic seed phrase
   */
  createWallet(): WalletInfo {
    const mnemonic = bip39.generateMnemonic(256);
    return this.restoreFromMnemonic(mnemonic);
  }

  /**
   * Restore wallet from 24-word mnemonic
   */
  restoreFromMnemonic(mnemonic: string, accountIndex: number = 0): WalletInfo {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.BIP32Factory(ecc).fromSeed(seed, this.network);

    const derivationPath = `m/84'/0'/${accountIndex}'/0/0`;
    const child = root.derivePath(derivationPath);

    if (!child.privateKey) {
      throw new Error('Failed to derive private key');
    }

    const keyPair = ECPair.fromPrivateKey(child.privateKey, { network: this.network });
    
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network: this.network
    });

    if (!address) {
      throw new Error('Failed to generate address');
    }

    return {
      address,
      publicKey: keyPair.publicKey.toString('hex'),
      privateKey: keyPair.privateKey?.toString('hex'),
      mnemonic,
      derivationPath,
      network: this.network === bitcoin.networks.bitcoin ? 'mainnet' : 'testnet'
    };
  }

  /**
   * Import wallet from private key (WIF format)
   */
  importFromPrivateKey(privateKeyWIF: string): WalletInfo {
    const keyPair = ECPair.fromWIF(privateKeyWIF, this.network);
    
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network: this.network
    });

    if (!address) {
      throw new Error('Failed to generate address');
    }

    return {
      address,
      publicKey: keyPair.publicKey.toString('hex'),
      privateKey: keyPair.privateKey?.toString('hex'),
      derivationPath: 'imported',
      network: this.network === bitcoin.networks.bitcoin ? 'mainnet' : 'testnet'
    };
  }

  /**
   * Generate a receive address from public key only (watch-only)
   */
  createWatchOnlyWallet(publicKeyHex: string): WalletInfo {
    const publicKey = Buffer.from(publicKeyHex, 'hex');
    
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: publicKey,
      network: this.network
    });

    if (!address) {
      throw new Error('Failed to generate address');
    }

    return {
      address,
      publicKey: publicKeyHex,
      derivationPath: 'watch-only',
      network: this.network === bitcoin.networks.bitcoin ? 'mainnet' : 'testnet'
    };
  }

  /**
   * Validate Bitcoin address
   */
  validateAddress(address: string): boolean {
    try {
      bitcoin.address.toOutputScript(address, this.network);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get address type (P2PKH, P2SH, P2WPKH, etc.)
   */
  getAddressType(address: string): string {
    try {
      const script = bitcoin.address.toOutputScript(address, this.network);
      
      if (bitcoin.payments.p2wpkh({ output: script, network: this.network }).address) {
        return 'P2WPKH (Native SegWit)';
      }
      if (bitcoin.payments.p2sh({ output: script, network: this.network }).address) {
        return 'P2SH (Script Hash)';
      }
      if (bitcoin.payments.p2pkh({ output: script, network: this.network }).address) {
        return 'P2PKH (Legacy)';
      }
      
      return 'Unknown';
    } catch {
      return 'Invalid';
    }
  }

  /**
   * Export wallet to JSON (for backup)
   */
  exportWallet(wallet: WalletInfo, includePrivateKey: boolean = false): string {
    const exportData = {
      address: wallet.address,
      publicKey: wallet.publicKey,
      derivationPath: wallet.derivationPath,
      network: wallet.network,
      ...(includePrivateKey && wallet.mnemonic && { mnemonic: wallet.mnemonic }),
      ...(includePrivateKey && wallet.privateKey && { privateKey: wallet.privateKey })
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate multiple addresses from same mnemonic
   */
  generateAddresses(mnemonic: string, count: number = 5): WalletInfo[] {
    const wallets: WalletInfo[] = [];
    
    for (let i = 0; i < count; i++) {
      wallets.push(this.restoreFromMnemonic(mnemonic, i));
    }
    
    return wallets;
  }
}

/**
 * Secure storage for wallet data (encrypted)
 */
export class SecureWalletStorage {
  private storageKey: string;

  constructor(userId: string) {
    this.storageKey = `wallet_${userId}`;
  }

  /**
   * Save wallet (in production, encrypt this!)
   */
  async saveWallet(wallet: WalletInfo, password: string): Promise<void> {
    const encrypted = this.encrypt(JSON.stringify(wallet), password);
    
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, encrypted);
    }
  }

  /**
   * Load wallet (in production, decrypt this!)
   */
  async loadWallet(password: string): Promise<WalletInfo | null> {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const encrypted = localStorage.getItem(this.storageKey);
    if (!encrypted) {
      return null;
    }

    const decrypted = this.decrypt(encrypted, password);
    return JSON.parse(decrypted);
  }

  /**
   * Simple encryption (use proper encryption in production!)
   */
  private encrypt(data: string, password: string): string {
    return Buffer.from(data).toString('base64');
  }

  /**
   * Simple decryption (use proper decryption in production!)
   */
  private decrypt(encrypted: string, password: string): string {
    return Buffer.from(encrypted, 'base64').toString('utf8');
  }

  /**
   * Clear wallet from storage
   */
  async clearWallet(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
  }
}
