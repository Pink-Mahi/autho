import * as crypto from 'crypto';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import * as bitcoin from 'bitcoinjs-lib';

const ECPair = ECPairFactory(ecc);

export function sha256(data: string | Buffer): string {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function generateKeyPair(): { privateKey: string; publicKey: string; address: string } {
  const keyPair = ECPair.makeRandom();
  const { address } = bitcoin.payments.p2pkh({
    pubkey: keyPair.publicKey,
    network: bitcoin.networks.bitcoin
  });

  return {
    privateKey: keyPair.privateKey!.toString('hex'),
    publicKey: keyPair.publicKey.toString('hex'),
    address: address!
  };
}

export function signMessage(message: string, privateKeyHex: string): string {
  const messageHash = sha256(message);
  const privateKey = Buffer.from(privateKeyHex, 'hex');
  const keyPair = ECPair.fromPrivateKey(privateKey);
  
  const signature = ecc.sign(Buffer.from(messageHash, 'hex'), keyPair.privateKey!);
  return Buffer.from(signature).toString('hex');
}

export function verifySignature(message: string, signature: string, publicKeyHex: string): boolean {
  try {
    const messageHash = sha256(message);
    const publicKey = Buffer.from(publicKeyHex, 'hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    
    return ecc.verify(Buffer.from(messageHash, 'hex'), publicKey, signatureBuffer);
  } catch (error) {
    return false;
  }
}

export function publicKeyToAddress(publicKeyHex: string): string {
  const publicKey = Buffer.from(publicKeyHex, 'hex');
  const { address } = bitcoin.payments.p2pkh({
    pubkey: publicKey,
    network: bitcoin.networks.bitcoin
  });
  return address!;
}

export function truncateAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}

export class MerkleTree {
  private leaves: string[];
  private tree: string[][];

  constructor(leaves: string[]) {
    this.leaves = leaves.map(leaf => sha256(leaf));
    this.tree = this.buildTree();
  }

  private buildTree(): string[][] {
    if (this.leaves.length === 0) {
      return [[]];
    }

    const tree: string[][] = [this.leaves];
    let currentLevel = this.leaves;

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          const combined = currentLevel[i] + currentLevel[i + 1];
          nextLevel.push(sha256(combined));
        } else {
          nextLevel.push(currentLevel[i]);
        }
      }
      
      tree.push(nextLevel);
      currentLevel = nextLevel;
    }

    return tree;
  }

  getRoot(): string {
    if (this.tree.length === 0 || this.tree[this.tree.length - 1].length === 0) {
      return '';
    }
    return this.tree[this.tree.length - 1][0];
  }

  getProof(leafIndex: number): string[] {
    const proof: string[] = [];
    let index = leafIndex;

    for (let level = 0; level < this.tree.length - 1; level++) {
      const currentLevel = this.tree[level];
      const isRightNode = index % 2 === 1;
      const siblingIndex = isRightNode ? index - 1 : index + 1;

      if (siblingIndex < currentLevel.length) {
        proof.push(currentLevel[siblingIndex]);
      }

      index = Math.floor(index / 2);
    }

    return proof;
  }

  static verifyProof(leaf: string, proof: string[], root: string): boolean {
    let hash = sha256(leaf);

    for (const sibling of proof) {
      const combined = hash < sibling ? hash + sibling : sibling + hash;
      hash = sha256(combined);
    }

    return hash === root;
  }
}

export function createTimestampedSignature(
  message: string,
  privateKeyHex: string,
  timestamp: number,
  nonce: string
): { signature: string; timestamp: number; nonce: string } {
  const fullMessage = `${message}:${timestamp}:${nonce}`;
  const signature = signMessage(fullMessage, privateKeyHex);
  
  return {
    signature,
    timestamp,
    nonce
  };
}

export function verifyTimestampedSignature(
  message: string,
  signature: string,
  publicKeyHex: string,
  timestamp: number,
  nonce: string,
  maxAgeSeconds: number = 300
): boolean {
  const now = Date.now();
  const age = (now - timestamp) / 1000;
  
  if (age > maxAgeSeconds || age < -60) {
    return false;
  }

  const fullMessage = `${message}:${timestamp}:${nonce}`;
  return verifySignature(fullMessage, signature, publicKeyHex);
}
