import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';

const bip32 = BIP32Factory(ecc);

export interface PaymentAddress {
  address: string;
  derivationPath: string;
  index: number;
}

export class HDWallet {
  private seed: Buffer;
  private network: bitcoin.Network;
  private masterKey: any;

  constructor(mnemonic: string, networkType: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = networkType === 'mainnet' 
      ? bitcoin.networks.bitcoin 
      : bitcoin.networks.testnet;
    
    this.seed = bip39.mnemonicToSeedSync(mnemonic);
    this.masterKey = bip32.fromSeed(this.seed, this.network);
  }

  static generateMnemonic(): string {
    return bip39.generateMnemonic(256); // 24 words for extra security
  }

  static validateMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic);
  }

  /**
   * Derive a payment address for a specific offer
   * Uses BIP44 path: m/44'/0'/0'/0/index
   */
  derivePaymentAddress(index: number): PaymentAddress {
    // BIP44 path for Bitcoin: m/44'/0'/0'/0/index
    const path = `m/44'/0'/0'/0/${index}`;
    const child = this.masterKey.derivePath(path);
    
    const { address } = bitcoin.payments.p2pkh({
      pubkey: child.publicKey,
      network: this.network
    });

    if (!address) {
      throw new Error('Failed to generate address');
    }

    return {
      address,
      derivationPath: path,
      index
    };
  }

  /**
   * Derive multiple addresses at once
   */
  deriveAddresses(startIndex: number, count: number): PaymentAddress[] {
    const addresses: PaymentAddress[] = [];
    for (let i = 0; i < count; i++) {
      addresses.push(this.derivePaymentAddress(startIndex + i));
    }
    return addresses;
  }

  /**
   * Get private key for a specific address index (for spending)
   */
  getPrivateKey(index: number): string {
    const path = `m/44'/0'/0'/0/${index}`;
    const child = this.masterKey.derivePath(path);
    return child.toWIF();
  }

  /**
   * Get the master seed (for backup)
   */
  getSeed(): string {
    return this.seed.toString('hex');
  }
}
