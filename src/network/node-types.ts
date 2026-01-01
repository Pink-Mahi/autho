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

// Type definitions only - no runtime imports needed

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
  
  // Network diversity tracking
  asn?: string; // Autonomous System Number
  provider?: string; // Hosting provider
  region?: string; // Geographic region
  
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
  eventId: string; // Unique event identifier
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
  merkleRoot: string; // Merkle root of events
  previousCheckpointHash: string; // Hash chain of checkpoints
  fromEventHash: string;
  toEventHash: string;
  eventCount: number;
  timestamp: number;
  
  // Bitcoin anchoring
  bitcoinTxId?: string;
  bitcoinBlockHeight?: number;
  bitcoinBlockHash?: string;
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
  
  // Network diversity tracking
  asn?: string;
  provider?: string;
  region?: string;
  lastSeen: number;
  
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
  quorumAvailabilityRatio: number;
  diversityScore: number;
  activeOperators: number;
  activeGateways: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  backlogSize: number;
  lastCheckpointTime: number;
  networkCapacityAlert: boolean;
  alertReason: string | null;
  measuredAt: number;
}

/**
 * Operator Earnings
 */
export interface OperatorEarnings {
  operatorId: string;
  totalEarned: number;
  settlementsParticipated: number;
  lastSettlementTime: number;
  pendingEarnings: number;
  earningsByMonth: Map<string, number>;
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
  | 'CHALLENGE_RESPONSE' // Uptime challenge response
  | 'HELLO'         // Handshake
  | 'ADDR'          // Peer address announcement
  | 'GETADDR'       // Request peer addresses
  | 'EVENTSYNC'     // Event log sync
  | 'CHECKPOINTSYNC'; // Checkpoint sync

/**
 * P2P Message
 */
export interface P2PMessage {
  type: P2PMessageType;
  from: string; // nodeId
  senderId?: string; // Sender node ID
  to?: string; // Optional specific recipient
  timestamp: number;
  nonce: string;
  data?: any; // Message data
  
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
