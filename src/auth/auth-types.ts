/**
 * WALLET-BASED AUTHENTICATION TYPES
 * 
 * This system uses Bitcoin wallet signatures for identity and authentication.
 * It is NON-CUSTODIAL - the protocol never holds private keys.
 * 
 * Key principles:
 * - One wallet = identity + signing authority
 * - Records live in registry (not in wallet)
 * - 2FA protects UI access, not ownership
 * - Protocol enforces rules but never holds assets
 */

/**
 * User Identity
 * Identified by Bitcoin wallet public key (NOT a stored asset)
 */
export interface UserIdentity {
  publicKey: string; // Bitcoin wallet public key
  address: string; // Derived Bitcoin address
  role: 'manufacturer' | 'authenticator' | 'buyer' | 'operator';
  
  // Optional metadata (stored server-side, NOT in wallet)
  displayName?: string;
  email?: string;
  
  // 2FA configuration
  totpSecret?: string; // Encrypted TOTP secret
  totpEnabled: boolean;
  
  // Account metadata
  createdAt: number;
  lastLoginAt?: number;
}

/**
 * Authentication Challenge
 * Server generates nonce for wallet signature verification
 */
export interface AuthChallenge {
  challengeId: string;
  publicKey: string;
  nonce: string; // Random nonce to be signed
  createdAt: number;
  expiresAt: number; // Challenge expires after 5 minutes
  used: boolean;
}

/**
 * Login Request
 * Step 1: Request challenge
 */
export interface LoginChallengeRequest {
  publicKey: string;
}

/**
 * Login Response
 * Step 2: Sign challenge and provide 2FA
 */
export interface LoginVerifyRequest {
  challengeId: string;
  publicKey: string;
  signature: string; // Wallet signature of nonce
  totpCode?: string; // 2FA code (if enabled)
}

/**
 * Session Token
 * JWT or session ID for UI authentication
 */
export interface SessionToken {
  sessionId: string;
  publicKey: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Action Authorization Payload
 * All sensitive actions require wallet signature
 */
export interface ActionPayload {
  action: 'register_item' | 'transfer_ownership' | 'create_offer' | 'accept_offer' | 'settle_transaction';
  publicKey: string; // Actor's public key
  
  // Action-specific data
  itemId?: string;
  targetPublicKey?: string; // For transfers
  price?: number;
  terms?: Record<string, any>;
  
  // Anti-replay protection
  timestamp: number;
  nonce: string;
  expiresAt: number;
}

/**
 * Signed Action
 * Action payload + wallet signature
 */
export interface SignedAction {
  payload: ActionPayload;
  signature: string; // Wallet signature of payload
  publicKey: string;
}

/**
 * TOTP Setup
 * For enabling 2FA
 */
export interface TOTPSetup {
  publicKey: string;
  secret: string; // Base32 encoded secret
  qrCodeUrl: string; // For scanning with authenticator app
  backupCodes: string[]; // One-time backup codes
}

/**
 * TOTP Verification
 */
export interface TOTPVerification {
  publicKey: string;
  code: string; // 6-digit TOTP code
}

/**
 * Account Recovery
 * In case of lost 2FA device
 */
export interface RecoveryRequest {
  publicKey: string;
  backupCode: string;
  newTotpSecret?: string;
}

/**
 * Signature Verification Result
 */
export interface SignatureVerification {
  valid: boolean;
  publicKey: string;
  message: string;
  signature: string;
  error?: string;
}

/**
 * Session Management
 */
export interface Session {
  sessionId: string;
  publicKey: string;
  role: string;
  createdAt: number;
  expiresAt: number;
  lastActivityAt: number;
  ipAddress?: string;
  userAgent?: string;
}
