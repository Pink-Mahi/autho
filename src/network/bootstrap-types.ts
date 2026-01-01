/**
 * P2P BOOTSTRAP TYPES
 * 
 * Multi-source bootstrapping ensures no single point of failure:
 * 1. Hardcoded seeds (shipped in binary)
 * 2. DNS seeds (Bitcoin-style)
 * 3. Signed seed manifest (evergreen updates)
 * 
 * Seeds are NOT trusted authorities - only bootstrap peers.
 * All data is verified locally via signatures + checkpoints + Bitcoin anchors.
 */

/**
 * Bootstrap Configuration
 * 
 * Can be loaded from file or URL.
 * Helps new nodes join via existing gateway.
 */
export interface BootstrapConfig {
  version: string; // Protocol version
  chainId: string; // e.g., "bitcoin-mainnet"
  
  // Bootstrap sources
  hardcodedSeeds: string[]; // ip:port or domain:port
  dnsSeed?: string; // DNS seed domain
  manifestUrls: string[]; // URLs for signed seed manifest
  
  // Network metadata
  networkName: string;
  protocolVersion: string;
  
  // Optional gateway info (if bootstrapping from specific gateway)
  gatewayEndpoint?: string;
  gatewayPublicKey?: string;
  
  // Signature (optional, for shareable configs)
  signature?: string;
  signedBy?: string;
}

/**
 * Seed Manifest
 * 
 * Evergreen list of peer addresses.
 * Signed by operator quorum or sponsor key.
 * Fetched periodically (e.g., every 24h).
 */
export interface SeedManifest {
  version: number;
  timestamp: number;
  chainId: string;
  
  // Peer list
  seeds: SeedEntry[];
  
  // Signatures (M-of-N operator quorum OR sponsor)
  signatures: ManifestSignature[];
  
  // Metadata
  manifestHash: string; // H(canonical manifest bytes)
  previousManifestHash?: string; // Links to previous version
}

/**
 * Seed Entry
 */
export interface SeedEntry {
  address: string; // ip:port or domain:port
  publicKey: string;
  role: 'gateway' | 'operator';
  
  // Optional metadata
  region?: string; // e.g., "us-east", "eu-west"
  asn?: number; // Autonomous System Number
  provider?: string; // e.g., "AWS", "DigitalOcean"
  
  addedAt: number;
}

/**
 * Manifest Signature
 */
export interface ManifestSignature {
  signerId: string; // operatorId or "sponsor"
  publicKey: string;
  signature: string;
  signedAt: number;
}

/**
 * Peer Address Message (ADDR)
 * 
 * Gossiped between peers for discovery.
 */
export interface PeerAddressMessage {
  addresses: {
    address: string;
    publicKey: string;
    role: 'gateway' | 'operator';
    lastSeen: number;
    services: number; // Bitmask of supported services
  }[];
  
  timestamp: number;
}

/**
 * Bootstrap Source
 */
export type BootstrapSource = 
  | 'hardcoded'
  | 'dns'
  | 'manifest'
  | 'peer-gossip'
  | 'bootstrap-config';

/**
 * Bootstrap Result
 */
export interface BootstrapResult {
  success: boolean;
  peersDiscovered: number;
  peersConnected: number;
  sources: {
    source: BootstrapSource;
    attempted: boolean;
    successful: boolean;
    peersFound: number;
    error?: string;
  }[];
  
  startedAt: number;
  completedAt: number;
}

/**
 * Peer Table Entry
 */
export interface PeerTableEntry {
  address: string;
  publicKey: string;
  role: 'gateway' | 'operator';
  
  // Connection state
  connected: boolean;
  lastConnectAttempt?: number;
  lastSuccessfulConnect?: number;
  lastSeen?: number;
  
  // Performance metrics
  latency?: number; // milliseconds
  reliability: number; // 0-1 score
  
  // Reputation
  score: number; // 0-100
  malformedMessages: number;
  successfulSyncs: number;
  failedConnects: number;
  
  // Discovery
  discoveredVia: BootstrapSource;
  discoveredAt: number;
}

/**
 * Join Page Configuration
 * 
 * Data for gateway's shareable join page.
 */
export interface JoinPageConfig {
  gatewayName: string;
  gatewayEndpoint: string;
  gatewayPublicKey: string;
  
  networkName: string;
  chainId: string;
  
  // Bootstrap info
  bootstrapConfigUrl: string;
  qrCodeDataUrl?: string; // QR code image data URL
  
  // Instructions
  installCommand: string;
  startCommand: string;
  
  // Stats (optional)
  networkStats?: {
    totalGateways: number;
    totalOperators: number;
    itemsRegistered: number;
    uptime: number;
  };
}

/**
 * DNS Seed Query Result
 */
export interface DnsSeedResult {
  addresses: string[];
  queriedAt: number;
  ttl: number;
}

/**
 * Manifest Cache Entry
 */
export interface ManifestCacheEntry {
  manifest: SeedManifest;
  fetchedAt: number;
  verifiedSignatures: boolean;
  sourceUrl: string;
}

/**
 * Bootstrap State
 */
export interface BootstrapState {
  phase: 'initializing' | 'fetching-seeds' | 'connecting' | 'syncing' | 'ready' | 'failed';
  progress: number; // 0-1
  
  peersDiscovered: number;
  peersConnected: number;
  
  currentSource?: BootstrapSource;
  error?: string;
  
  startedAt: number;
  lastUpdateAt: number;
}
