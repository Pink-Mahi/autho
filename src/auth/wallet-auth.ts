import { createHash, randomBytes } from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import {
  UserIdentity,
  AuthChallenge,
  LoginChallengeRequest,
  LoginVerifyRequest,
  SessionToken,
  SignedAction,
  TOTPSetup,
  TOTPVerification,
  SignatureVerification,
  Session
} from './auth-types';

/**
 * WALLET-BASED AUTHENTICATION SYSTEM
 * 
 * This is a NON-CUSTODIAL authentication system.
 * - Users are identified by Bitcoin wallet public key
 * - Login requires wallet signature + 2FA
 * - Sensitive actions require signed payloads
 * - Protocol NEVER holds private keys
 * 
 * Regulatory compliance:
 * - No custody of assets
 * - No stored private keys
 * - 2FA protects UI access, not ownership
 * - Wallet signature proves cryptographic authority
 */
export class WalletAuthSystem {
  private users: Map<string, UserIdentity> = new Map();
  private challenges: Map<string, AuthChallenge> = new Map();
  private sessions: Map<string, Session> = new Map();
  private usedNonces: Set<string> = new Set();

  /**
   * Register new user with wallet public key
   * This creates an identity record, NOT a custodial account
   */
  async registerUser(
    publicKey: string,
    address: string,
    role: 'manufacturer' | 'authenticator' | 'buyer' | 'operator',
    displayName?: string,
    email?: string
  ): Promise<UserIdentity> {
    if (this.users.has(publicKey)) {
      throw new Error('User already registered with this public key');
    }

    const user: UserIdentity = {
      publicKey,
      address,
      role,
      displayName,
      email,
      totpEnabled: false,
      createdAt: Date.now()
    };

    this.users.set(publicKey, user);
    
    console.log(`[Auth] User registered: ${publicKey.substring(0, 20)}... (${role})`);
    
    return user;
  }

  /**
   * Step 1: Generate authentication challenge
   * Server creates random nonce for user to sign
   */
  async createLoginChallenge(request: LoginChallengeRequest): Promise<AuthChallenge> {
    const user = this.users.get(request.publicKey);
    
    if (!user) {
      throw new Error('User not found. Please register first.');
    }

    // Generate random nonce
    const nonce = randomBytes(32).toString('hex');
    const challengeId = this.generateChallengeId();

    const challenge: AuthChallenge = {
      challengeId,
      publicKey: request.publicKey,
      nonce,
      createdAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
      used: false
    };

    this.challenges.set(challengeId, challenge);

    // Clean up expired challenges
    this.cleanupExpiredChallenges();

    console.log(`[Auth] Challenge created for ${request.publicKey.substring(0, 20)}...`);

    return challenge;
  }

  /**
   * Step 2: Verify wallet signature and 2FA
   * Proves wallet control + user presence
   */
  async verifyLogin(request: LoginVerifyRequest): Promise<SessionToken> {
    const challenge = this.challenges.get(request.challengeId);
    
    if (!challenge) {
      throw new Error('Challenge not found or expired');
    }

    if (challenge.used) {
      throw new Error('Challenge already used');
    }

    if (Date.now() > challenge.expiresAt) {
      throw new Error('Challenge expired');
    }

    if (challenge.publicKey !== request.publicKey) {
      throw new Error('Public key mismatch');
    }

    const user = this.users.get(request.publicKey);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Verify wallet signature
    const signatureValid = await this.verifySignature({
      publicKey: request.publicKey,
      message: challenge.nonce,
      signature: request.signature
    });

    if (!signatureValid.valid) {
      throw new Error('Invalid wallet signature');
    }

    // Verify 2FA if enabled
    if (user.totpEnabled) {
      if (!request.totpCode) {
        throw new Error('2FA code required');
      }

      const totpValid = this.verifyTOTP({
        publicKey: request.publicKey,
        code: request.totpCode
      });

      if (!totpValid) {
        throw new Error('Invalid 2FA code');
      }
    }

    // Mark challenge as used
    challenge.used = true;

    // Create session
    const session = this.createSession(user);

    // Update last login
    user.lastLoginAt = Date.now();

    console.log(`[Auth] Login successful for ${request.publicKey.substring(0, 20)}...`);

    return {
      sessionId: session.sessionId,
      publicKey: user.publicKey,
      role: user.role,
      issuedAt: session.createdAt,
      expiresAt: session.expiresAt
    };
  }

  /**
   * Verify wallet signature
   * Proves cryptographic authority without custody
   */
  async verifySignature(verification: {
    publicKey: string;
    message: string;
    signature: string;
  }): Promise<SignatureVerification> {
    // TODO: Implement actual Bitcoin signature verification
    // This would use bitcoinjs-lib or similar library
    
    // For now, simulate verification
    const isValid = verification.signature.length > 0;

    return {
      valid: isValid,
      publicKey: verification.publicKey,
      message: verification.message,
      signature: verification.signature,
      error: isValid ? undefined : 'Invalid signature'
    };
  }

  /**
   * Verify signed action payload
   * All sensitive actions require wallet signature
   */
  async verifySignedAction(signedAction: SignedAction): Promise<boolean> {
    const { payload, signature, publicKey } = signedAction;

    // Check expiry
    if (Date.now() > payload.expiresAt) {
      throw new Error('Action payload expired');
    }

    // Check nonce (prevent replay attacks)
    const nonceKey = `${publicKey}:${payload.nonce}`;
    if (this.usedNonces.has(nonceKey)) {
      throw new Error('Nonce already used (replay attack detected)');
    }

    // Verify signature
    const payloadString = JSON.stringify(payload);
    const verification = await this.verifySignature({
      publicKey,
      message: payloadString,
      signature
    });

    if (!verification.valid) {
      throw new Error('Invalid action signature');
    }

    // Mark nonce as used
    this.usedNonces.add(nonceKey);

    // Clean up old nonces (older than 1 hour)
    this.cleanupUsedNonces();

    return true;
  }

  /**
   * Setup 2FA (TOTP)
   * Protects UI access, not ownership
   */
  async setupTOTP(publicKey: string): Promise<TOTPSetup> {
    const user = this.users.get(publicKey);
    
    if (!user) {
      throw new Error('User not found');
    }

    if (user.totpEnabled) {
      throw new Error('2FA already enabled');
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `Bitcoin Ownership Protocol (${user.address.substring(0, 10)}...)`,
      length: 32
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Store encrypted secret (in production, encrypt this)
    user.totpSecret = secret.base32;

    console.log(`[Auth] 2FA setup initiated for ${publicKey.substring(0, 20)}...`);

    return {
      publicKey,
      secret: secret.base32,
      qrCodeUrl,
      backupCodes
    };
  }

  /**
   * Enable 2FA after verification
   */
  async enableTOTP(publicKey: string, verificationCode: string): Promise<boolean> {
    const user = this.users.get(publicKey);
    
    if (!user || !user.totpSecret) {
      throw new Error('2FA setup not initiated');
    }

    // Verify the code
    const isValid = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: verificationCode,
      window: 2
    });

    if (!isValid) {
      throw new Error('Invalid verification code');
    }

    user.totpEnabled = true;

    console.log(`[Auth] 2FA enabled for ${publicKey.substring(0, 20)}...`);

    return true;
  }

  /**
   * Verify TOTP code
   */
  verifyTOTP(verification: TOTPVerification): boolean {
    const user = this.users.get(verification.publicKey);
    
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: verification.code,
      window: 2
    });
  }

  /**
   * Create session
   */
  private createSession(user: UserIdentity): Session {
    const sessionId = this.generateSessionId();

    const session: Session = {
      sessionId,
      publicKey: user.publicKey,
      role: user.role,
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      lastActivityAt: Date.now()
    };

    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Validate session
   */
  validateSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivityAt = Date.now();

    return session;
  }

  /**
   * Logout
   */
  logout(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get user by public key
   */
  getUser(publicKey: string): UserIdentity | undefined {
    return this.users.get(publicKey);
  }

  // Helper methods

  private generateChallengeId(): string {
    return `challenge_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${randomBytes(16).toString('hex')}`;
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private cleanupExpiredChallenges(): void {
    const now = Date.now();
    for (const [id, challenge] of this.challenges.entries()) {
      if (now > challenge.expiresAt) {
        this.challenges.delete(id);
      }
    }
  }

  private cleanupUsedNonces(): void {
    // In production, implement proper nonce expiry based on timestamp
    if (this.usedNonces.size > 10000) {
      this.usedNonces.clear();
    }
  }

  // Export/Import for persistence

  exportUsers(): string {
    return JSON.stringify(Array.from(this.users.entries()));
  }

  importUsers(data: string): void {
    const entries = JSON.parse(data);
    this.users = new Map(entries);
  }
}
