/**
 * DECENTRALIZED P2P NETWORK TYPES
 * 
 * Two-tier architecture:
 * - Gateway Nodes: Permissionless, read-only, white-label domains
 * - Operator Nodes: Gated, co-sign state, earn fees per-work
 * 
 * No single point of failure. Network survives as long as:
 * - Independent nodes exist
 * - Clients can query multiple nodes
 * - Bitcoin anchoring continues
 */

import { createHash } from 'crypto';

/**
 * Node Role
 */
export type NodeRole = 'gateway' | 'operator';

/**
 * Node Status
 */
export type NodeStatus = 'active' | 'inactive' | 'candidate' | 'removed';

/**
 * Node Configuration
 */
export interface NodeConfig {
  nodeId: string;
  role: NodeRole;
  publicKey: string;
  
  // Network configuration
  bootstrapPeers: string[]; // Initial peer addresses
  dnsSeed?: string; // Optional DNS seed for peer discovery
  listenPort: number;
  maxPeers: number;
  
  // Operator-specific (only if role === 'operator')
  payoutAddress?: string; // Bitcoin address for fee payouts
  
  // Storage
  dataDir: string;
  
  // Bitcoin anchoring
  bitcoinRpcUrl?: string;
  anchoringEnabled: boolean;
  anchoringInterval: number; // milliseconds
}

/**
 * Peer Information
 */
export interface PeerInfo {
  peerId: string;
  address: string; // IP:port or domain:port
  publicKey: string;
  role: NodeRole;
  lastSeen: number;
  latency?: number; // milliseconds
  
  // Reputation
  score: number; // 0-100
  malformedMessages: number;
  successfulSyncs: number;
}

/**
 * Event (Content-Addressed)
 * 
 * Core of the append-only log.
 * Each event is immutable and hash-chained.
 */
export interface ProtocolEvent {
  eventHash: string; // H(canonicalEventBytes)
  prevEventHash: string; // Links to previous event (hash chain)
  eventType: string;
  timestamp: number;
  
  // Event-specific data
  data: any;
  
  // Signatures
  signatures: EventSignature[];
  
  // Metadata
  createdBy: string; // nodeId or publicKey
  nonce: string;
}

/**
 * Event Signature
 */
export interface EventSignature {
  operatorId: string;
  publicKey: string;
  signature: string;
  signedAt: number;
}

/**
 * Checkpoint (Bitcoin Anchoring)
 * 
 * Periodic commitment to Bitcoin for tamper evidence.
 */
export interface Checkpoint {
  checkpointId: string;
  checkpointRoot: string; // MerkleRoot or H(logHead || prevCheckpoint)
  fromEventHash: string;
  toEventHash: string;
  eventCount: number;
  
  // Bitcoin anchoring
  bitcoinTxId?: string;
  blockHeight?: number;
  confirmed: boolean;
  
  // Signatures
  operatorSignatures: EventSignature[];
  
  createdAt: number;
  anchoredAt?: number;
}

/**
 * Operator Registry Entry
 */
export interface OperatorRegistryEntry {
  operatorId: string;
  publicKey: string;
  payoutAddress: string;
  
  status: 'active' | 'inactive' | 'candidate' | 'removed';
  
  // Admission
  admittedAt?: number;
  admittedBy: 'sponsor' | 'vote';
  sponsorSignature?: string;
  voteEventHash?: string;
  
  // Performance tracking
  checkpointsSigned: number;
  settlementsParticipated: number;
  lastActiveAt: number;
  
  // Uptime evidence (for candidates)
  uptimeEvidenceHash?: string;
  candidateRequestedAt?: number;
}

/**
 * Operator Candidate Application
 */
export interface OperatorCandidateRequest {
  candidatePublicKey: string;
  payoutAddress: string;
  evidenceHash: string; // Hash of 90-day uptime evidence
  requestedAt: number;
  
  // Evidence summary
  uptimeDays: number;
  challengeResponseRate: number; // 0-1
  averageLatency: number; // milliseconds
}

/**
 * Operator Vote
 */
export interface OperatorVote {
  candidatePublicKey: string;
  voterOperatorId: string;
  vote: 'yes' | 'no';
  votedAt: number;
  signature: string;
}

/**
 * Committee Selection Result
 * 
 * Deterministic selection of K operators for a specific settlement.
 */
export interface CommitteeSelection {
  offerId: string;
  seed: string; // H(offerId || latestCheckpointRoot || chainId)
  committeeSize: number; // K
  thresholdSignatures: number; // M
  
  selectedOperators: {
    operatorId: string;
    publicKey: string;
    payoutAddress: string;
    rank: number; // Deterministic ranking
  }[];
  
  selectionTimestamp: number;
}

/**
 * Network Health Metrics
 */
export interface NetworkHealthMetrics {
  // Quorum Availability Ratio
  qar: {
    current: number; // 0-1 (% of time ≥M operators reachable)
    last30Days: number;
    threshold: number; // e.g., 0.995
    healthy: boolean;
  };
  
  // Diversity Score
  diversity: {
    asnCount: number;
    regionCount: number;
    maxAsnConcentration: number; // 0-1 (% on single ASN)
    threshold: number; // e.g., 0.3 (max 30% on one ASN)
    healthy: boolean;
  };
  
  // Finalization Performance
  finalization: {
    latencyP50: number; // milliseconds
    latencyP95: number;
    backlogSize: number;
    thresholdLatency: number; // e.g., 5000ms
    thresholdBacklog: number; // e.g., 100
    healthy: boolean;
  };
  
  // Overall
  capacityAlert: boolean;
  alertSince?: number;
  
  measuredAt: number;
}

/**
 * Operator Earnings
 */
export interface OperatorEarnings {
  operatorId: string;
  
  // Lifetime
  totalEarningsSats: number;
  settlementsParticipated: number;
  
  // Time-based
  dailyEarnings: { date: string; sats: number }[];
  weeklyEarnings: { week: string; sats: number }[];
  monthlyEarnings: { month: string; sats: number }[];
  
  // Per-settlement breakdown
  settlements: {
    offerId: string;
    settlementTxId: string;
    amountSats: number;
    timestamp: number;
    confirmed: boolean;
  }[];
  
  lastUpdated: number;
}

/**
 * P2P Message Types
 */
export type P2PMessageType = 
  | 'INV'           // Inventory announcement (new event hashes)
  | 'GETDATA'       // Request specific events by hash
  | 'EVENT'         // Event data response
  | 'HEADERS'       // Checkpoint headers
  | 'GETCHECKPOINT' // Request checkpoint data
  | 'CHECKPOINT'    // Checkpoint data response
  | 'PING'          // Keep-alive
  | 'PONG'          // Keep-alive response
  | 'GETPEERS'      // Request peer list
  | 'PEERS'         // Peer list response
  | 'CHALLENGE'     // Uptime challenge (for candidates)
  | 'CHALLENGE_RESPONSE'; // Uptime challenge response

/**
 * P2P Message
 */
export interface P2PMessage {
  type: P2PMessageType;
  from: string; // nodeId
  to?: string; // Optional specific recipient
  timestamp: number;
  nonce: string;
  
  // Message-specific payload
  payload: any;
  
  // Signature (for critical messages)
  signature?: string;
}

/**
 * INV Message Payload
 */
export interface InvPayload {
  eventHashes: string[];
  checkpointHashes?: string[];
}

/**
 * GETDATA Message Payload
 */
export interface GetDataPayload {
  eventHashes: string[];
}

/**
 * EVENT Message Payload
 */
export interface EventPayload {
  events: ProtocolEvent[];
}

/**
 * HEADERS Message Payload
 */
export interface HeadersPayload {
  checkpoints: {
    checkpointId: string;
    checkpointRoot: string;
    eventCount: number;
    height: number;
  }[];
}

/**
 * PEERS Message Payload
 */
export interface PeersPayload {
  peers: {
    address: string;
    publicKey: string;
    role: NodeRole;
    lastSeen: number;
  }[];
}

/**
 * CHALLENGE Message Payload
 */
export interface ChallengePayload {
  challengeId: string;
  nonce: string;
  expiresAt: number;
}

/**
 * CHALLENGE_RESPONSE Message Payload
 */
export interface ChallengeResponsePayload {
  challengeId: string;
  nonce: string;
  signature: string;
  respondedAt: number;
}

/**
 * Sync State
 */
export interface SyncState {
  syncing: boolean;
  currentHeight: number; // Local checkpoint height
  targetHeight: number; // Network checkpoint height
  missingEvents: string[]; // Event hashes to fetch
  syncProgress: number; // 0-1
  lastSyncAt: number;
}
