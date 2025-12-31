export enum ManufacturerStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  REVOKED = "REVOKED"
}

export interface Manufacturer {
  manufacturerId: string;
  name: string;
  issuerPublicKey: string;
  status: ManufacturerStatus;
  registeredAt: number;
  registrationTxHash?: string;
  metadataUri?: string;
}

export enum ItemState {
  MINTED = "MINTED",
  ACTIVE_HELD = "ACTIVE_HELD",
  LOCKED_IN_ESCROW = "LOCKED_IN_ESCROW",
  IN_CUSTODY = "IN_CUSTODY",
  BURNED = "BURNED"
}

export interface Item {
  itemId: string;
  manufacturerId: string;
  metadataHash: string;
  currentState: ItemState;
  currentOwnerWallet: string;
  mintedAt: number;
  lastEventHash: string;
  lastEventHeight: number;
}

export enum EventType {
  MANUFACTURER_REGISTERED = "MANUFACTURER_REGISTERED",
  ITEM_MINTED = "ITEM_MINTED",
  ITEM_ASSIGNED = "ITEM_ASSIGNED",
  ITEM_LOCKED = "ITEM_LOCKED",
  ITEM_SETTLED = "ITEM_SETTLED",
  ITEM_UNLOCKED_EXPIRED = "ITEM_UNLOCKED_EXPIRED",
  ITEM_MOVED_TO_CUSTODY = "ITEM_MOVED_TO_CUSTODY",
  ITEM_BURNED = "ITEM_BURNED",
  AUTHENTICATOR_REGISTERED = "AUTHENTICATOR_REGISTERED",
  ITEM_AUTHENTICATED = "ITEM_AUTHENTICATED"
}

export interface OperatorSignature {
  operatorId: string;
  publicKey: string;
  signature: string;
}

export interface BaseEvent {
  eventId: string;
  eventType: EventType;
  itemId: string;
  height: number;
  timestamp: number;
  previousEventHash: string;
  actorSignature: string;
  operatorSignatures: OperatorSignature[];
  anchorTxHash?: string;
}

export interface ManufacturerRegisteredEvent extends BaseEvent {
  eventType: EventType.MANUFACTURER_REGISTERED;
  manufacturerId: string;
  name: string;
  issuerPublicKey: string;
  registrationFeeSats: number;
}

export interface ItemMintedEvent extends BaseEvent {
  eventType: EventType.ITEM_MINTED;
  manufacturerId: string;
  metadataHash: string;
  mintingFeeSats: number;
}

export interface ItemAssignedEvent extends BaseEvent {
  eventType: EventType.ITEM_ASSIGNED;
  ownerWallet: string;
  ownerSignature: string;
}

export interface ItemLockedEvent extends BaseEvent {
  eventType: EventType.ITEM_LOCKED;
  offerId: string;
  sellerWallet: string;
  buyerWallet: string;
  priceSats: number;
  expiryTimestamp: number;
  escrowFeeSats: number;
}

export interface PaymentProof {
  paymentType: "ONCHAIN" | "LIGHTNING";
  txHash?: string;
  paymentHash?: string;
  preimage?: string;
  amountSats: number;
  confirmations?: number;
  verifiedAt: number;
}

export interface ItemSettledEvent extends BaseEvent {
  eventType: EventType.ITEM_SETTLED;
  offerId: string;
  buyerWallet: string;
  priceSats: number;
  paymentProof: PaymentProof;
  settlementFeeSats: number;
}

export interface ItemUnlockedExpiredEvent extends BaseEvent {
  eventType: EventType.ITEM_UNLOCKED_EXPIRED;
  offerId: string;
  expiryTimestamp: number;
}

export interface ItemMovedToCustodyEvent extends BaseEvent {
  eventType: EventType.ITEM_MOVED_TO_CUSTODY;
  custodianId: string;
  reason: string;
}

export interface ItemBurnedEvent extends BaseEvent {
  eventType: EventType.ITEM_BURNED;
  reason: string;
  burnProof?: string;
}

export type ProtocolEvent =
  | ManufacturerRegisteredEvent
  | ItemMintedEvent
  | ItemAssignedEvent
  | ItemLockedEvent
  | ItemSettledEvent
  | ItemUnlockedExpiredEvent
  | ItemMovedToCustodyEvent
  | ItemBurnedEvent
  | AuthenticatorRegisteredEvent
  | ItemAuthenticatedEvent;

export interface Operator {
  operatorId: string;
  name: string;
  publicKey: string;
  btcAddress: string;
  endpoint: string;
  status: "ACTIVE" | "SUSPENDED";
}

export interface OperatorConfig {
  operatorId: string;
  privateKey: string;
  publicKey: string;
  btcAddress: string;
  port: number;
  peers: string[];
}

export interface QuorumConfig {
  m: number;
  n: number;
}

export interface AnchorTransaction {
  merkleRoot: string;
  heightRange: [number, number];
  operatorSignatures: string[];
  bitcoinTxHash: string;
  confirmedAt?: number;
}

export interface ScanResult {
  itemId: string;
  manufacturer: {
    name: string;
    status: ManufacturerStatus;
  };
  currentState: ItemState;
  isAuthentic: boolean;
  canPurchase: boolean;
  lastVerifiedAt: number;
  anchorStatus: {
    isAnchored: boolean;
    bitcoinTxHash?: string;
    blockHeight?: number;
  };
  warnings: string[];
  attestations?: AuthenticationDisplay[];
}

export interface AuthenticationDisplay {
  authenticator: {
    name: string;
    specialization: string;
    status: AuthenticatorStatus;
  };
  confidence: number;
  scope: string;
  notes?: string;
  issuedAt: number;
  expiryTimestamp?: number;
  isExpired: boolean;
  isValid: boolean;
}

export interface Offer {
  offerId: string;
  itemId: string;
  buyerWallet: string;
  priceSats: number;
  expiryTimestamp: number;
  buyerSignature: string;
}

export interface OfferAcceptance {
  offerId: string;
  sellerWallet: string;
  sellerSignature: string;
}

export enum AuthenticatorStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  REVOKED = "REVOKED"
}

export interface Authenticator {
  authenticatorId: string;
  name: string;
  publicKey: string;
  specialization: string;
  status: AuthenticatorStatus;
  registeredAt: number;
  registrationTxHash?: string;
  metadataUri?: string;
}

export interface AuthenticationAttestation {
  attestationId: string;
  itemId: string;
  authenticatorId: string;
  confidence: number;
  scope: string;
  notes?: string;
  expiryTimestamp?: number;
  issuedAt: number;
  authenticatorSignature: string;
}

export interface AuthenticatorRegisteredEvent extends BaseEvent {
  eventType: EventType.AUTHENTICATOR_REGISTERED;
  authenticatorId: string;
  name: string;
  publicKey: string;
  specialization: string;
  registrationFeeSats: number;
}

export interface ItemAuthenticatedEvent extends BaseEvent {
  eventType: EventType.ITEM_AUTHENTICATED;
  attestation: AuthenticationAttestation;
}
