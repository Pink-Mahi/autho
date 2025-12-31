export interface TokenMetadata {
  itemId: string;
  name: string;
  description?: string;
  serialNumber?: string;
  manufacturer: string;
  manufacturerId: string;
  category: string;
  price?: number;
  imageUrl?: string;
  customData?: Record<string, any>;
}

export interface OwnershipRecord {
  owner: string;
  timestamp: number;
  transactionHash: string;
  blockHeight?: number;
  transferType: 'mint' | 'sale' | 'transfer' | 'embed';
}

export interface Token {
  tokenId: string;
  status: 'unminted' | 'minted' | 'embedded' | 'transferred';
  itemData: TokenMetadata | null;
  currentOwner: string;
  ownershipHistory: OwnershipRecord[];
  mintedAt: number;
  mintedBy: string;
  embeddedAt?: number;
  bitcoinAnchor?: {
    txHash: string;
    blockHeight: number;
    confirmations: number;
  };
  signatures: {
    operatorId: string;
    signature: string;
    timestamp: number;
  }[];
}

export interface TokenTransaction {
  txId: string;
  type: 'mint' | 'sell' | 'embed' | 'transfer';
  tokenId: string;
  from: string;
  to: string;
  timestamp: number;
  itemData?: TokenMetadata;
  price?: number;
  signatures: {
    operatorId: string;
    signature: string;
  }[];
  validated: boolean;
  validatedBy: string[];
}

export interface TokenLedger {
  tokens: Map<string, Token>;
  transactions: TokenTransaction[];
  lastBlockHeight: number;
  lastSyncedAt: number;
}

export interface TokenMintRequest {
  quantity: number;
  mintedBy: string;
  batchId?: string;
}

export interface TokenSaleRequest {
  tokenIds: string[];
  buyer: string;
  price: number;
  paymentTxHash?: string;
}

export interface TokenEmbedRequest {
  tokenId: string;
  itemData: TokenMetadata;
  owner: string;
}

export interface TokenTransferRequest {
  tokenId: string;
  from: string;
  to: string;
  signature: string;
}

export interface ConsensusValidation {
  txId: string;
  validations: {
    operatorId: string;
    valid: boolean;
    signature: string;
    timestamp: number;
  }[];
  consensusReached: boolean;
  finalStatus: 'approved' | 'rejected' | 'pending';
}
