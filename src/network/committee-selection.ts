import { createHash } from 'crypto';
import { CommitteeSelection, OperatorRegistryEntry } from './node-types';

/**
 * DETERMINISTIC COMMITTEE SELECTION
 * 
 * Selects K operators from the active set for each settlement.
 * Selection is deterministic based on:
 * - offerId
 * - latest anchored checkpoint root
 * - chainId
 * 
 * This ensures:
 * - No single operator can predict selection in advance
 * - Earnings are per-work, not per-membership
 * - Adding operators doesn't dilute existing operators
 * - Selection is verifiable by all nodes
 */
export class CommitteeSelector {
  private chainId: string;
  
  constructor(chainId: string = 'bitcoin-mainnet') {
    this.chainId = chainId;
  }

  /**
   * Select committee for a specific settlement
   * 
   * @param offerId Unique offer identifier
   * @param latestCheckpointRoot Latest anchored checkpoint root hash
   * @param activeOperators List of active operators
   * @param committeeSize K (number of operators to select)
   * @param thresholdSignatures M (minimum signatures required)
   * @returns Committee selection result
   */
  selectCommittee(
    offerId: string,
    latestCheckpointRoot: string,
    activeOperators: OperatorRegistryEntry[],
    committeeSize: number = 7,
    thresholdSignatures: number = 5
  ): CommitteeSelection {
    if (activeOperators.length < committeeSize) {
      throw new Error(
        `Insufficient active operators: ${activeOperators.length} < ${committeeSize}. ` +
        `Network capacity alert should be triggered.`
      );
    }

    if (thresholdSignatures > committeeSize) {
      throw new Error(`Threshold M (${thresholdSignatures}) cannot exceed committee size K (${committeeSize})`);
    }

    // Generate deterministic seed
    const seed = this.generateSeed(offerId, latestCheckpointRoot);

    // Rank operators deterministically
    const rankedOperators = this.rankOperators(activeOperators, seed);

    // Select first K operators
    const selectedOperators = rankedOperators.slice(0, committeeSize).map((op, index) => ({
      operatorId: op.operatorId,
      publicKey: op.publicKey,
      payoutAddress: op.payoutAddress,
      rank: index + 1
    }));

    return {
      offerId,
      seed,
      committeeSize,
      thresholdSignatures,
      selectedOperators,
      selectionTimestamp: Date.now()
    };
  }

  /**
   * Generate deterministic seed for committee selection
   */
  private generateSeed(offerId: string, latestCheckpointRoot: string): string {
    const data = `${offerId}||${latestCheckpointRoot}||${this.chainId}`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Rank operators deterministically based on seed
   */
  private rankOperators(
    operators: OperatorRegistryEntry[],
    seed: string
  ): OperatorRegistryEntry[] {
    // Create ranking scores
    const scored = operators.map(op => ({
      operator: op,
      score: this.calculateRankingScore(op.operatorId, seed)
    }));

    // Sort by score (ascending)
    scored.sort((a, b) => a.score.localeCompare(b.score));

    return scored.map(s => s.operator);
  }

  /**
   * Calculate deterministic ranking score for operator
   */
  private calculateRankingScore(operatorId: string, seed: string): string {
    const data = `${seed}||${operatorId}`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify committee selection is correct
   * 
   * Any node can verify the committee was selected correctly
   */
  verifyCommitteeSelection(
    selection: CommitteeSelection,
    activeOperators: OperatorRegistryEntry[]
  ): boolean {
    try {
      // Re-run selection with same parameters
      const verification = this.selectCommittee(
        selection.offerId,
        selection.seed.split('||')[1], // Extract checkpoint root from seed
        activeOperators,
        selection.committeeSize,
        selection.thresholdSignatures
      );

      // Compare selected operators
      if (verification.selectedOperators.length !== selection.selectedOperators.length) {
        return false;
      }

      for (let i = 0; i < verification.selectedOperators.length; i++) {
        if (verification.selectedOperators[i].operatorId !== selection.selectedOperators[i].operatorId) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate fee distribution among committee members
   * 
   * @param totalFeeSats Total protocol fee in satoshis
   * @param committeeSize Number of operators in committee
   * @returns Array of payout amounts per operator
   */
  calculateFeeDistribution(totalFeeSats: number, committeeSize: number): number[] {
    // Equal split among committee members
    const baseAmount = Math.floor(totalFeeSats / committeeSize);
    const remainder = totalFeeSats % committeeSize;

    const distribution = new Array(committeeSize).fill(baseAmount);

    // Distribute remainder to first operators (deterministic)
    for (let i = 0; i < remainder; i++) {
      distribution[i]++;
    }

    return distribution;
  }

  /**
   * Determine if an operator is ACTIVE
   * 
   * Active = signed ≥X of last Y checkpoints
   */
  isOperatorActive(
    operator: OperatorRegistryEntry,
    recentCheckpointCount: number,
    minimumSignatures: number,
    currentTime: number
  ): boolean {
    if (operator.status !== 'active') {
      return false;
    }

    // Check if operator has signed enough recent checkpoints
    // In production, this would query actual checkpoint signatures
    const signatureRate = operator.checkpointsSigned / recentCheckpointCount;
    
    if (signatureRate < (minimumSignatures / recentCheckpointCount)) {
      return false;
    }

    // Check recent activity (e.g., active within last 7 days)
    const maxInactivityMs = 7 * 24 * 60 * 60 * 1000;
    if (currentTime - operator.lastActiveAt > maxInactivityMs) {
      return false;
    }

    return true;
  }

  /**
   * Filter active operators from registry
   */
  filterActiveOperators(
    operators: OperatorRegistryEntry[],
    recentCheckpointCount: number = 100,
    minimumSignatures: number = 80
  ): OperatorRegistryEntry[] {
    const currentTime = Date.now();
    
    return operators.filter(op => 
      this.isOperatorActive(op, recentCheckpointCount, minimumSignatures, currentTime)
    );
  }
}

/**
 * OPERATOR ADMISSION SYSTEM
 * 
 * Handles operator candidate applications and voting.
 * Admission requires:
 * - 90 days of uptime evidence
 * - Sponsor approval OR 2/3 supermajority vote
 */
export class OperatorAdmission {
  private sponsorPublicKey?: string;
  private votingWindowDays: number = 14;
  private sponsorWindowDays: number = 30;
  private uptimeRequirementDays: number = 90;

  constructor(sponsorPublicKey?: string) {
    this.sponsorPublicKey = sponsorPublicKey;
  }

  /**
   * Validate candidate eligibility
   */
  validateCandidateEligibility(
    uptimeDays: number,
    challengeResponseRate: number,
    averageLatency: number
  ): { eligible: boolean; reason?: string } {
    if (uptimeDays < this.uptimeRequirementDays) {
      return {
        eligible: false,
        reason: `Insufficient uptime: ${uptimeDays} days < ${this.uptimeRequirementDays} days required`
      };
    }

    if (challengeResponseRate < 0.95) {
      return {
        eligible: false,
        reason: `Challenge response rate too low: ${(challengeResponseRate * 100).toFixed(1)}% < 95% required`
      };
    }

    if (averageLatency > 5000) {
      return {
        eligible: false,
        reason: `Average latency too high: ${averageLatency}ms > 5000ms threshold`
      };
    }

    return { eligible: true };
  }

  /**
   * Calculate vote result
   * 
   * @param yesVotes Number of YES votes
   * @param noVotes Number of NO votes
   * @param totalActiveOperators Total number of active operators
   * @returns Whether candidate is admitted
   */
  calculateVoteResult(
    yesVotes: number,
    noVotes: number,
    totalActiveOperators: number
  ): { admitted: boolean; yesPercentage: number; threshold: number } {
    const totalVotes = yesVotes + noVotes;
    const yesPercentage = totalVotes > 0 ? yesVotes / totalActiveOperators : 0;
    const threshold = 2 / 3; // 66.67%

    return {
      admitted: yesPercentage >= threshold,
      yesPercentage,
      threshold
    };
  }

  /**
   * Check if voting window is open
   */
  isVotingWindowOpen(
    requestedAt: number,
    currentTime: number,
    sponsorDecided: boolean
  ): boolean {
    const sponsorWindowMs = this.sponsorWindowDays * 24 * 60 * 60 * 1000;
    const votingWindowMs = this.votingWindowDays * 24 * 60 * 60 * 1000;

    // If sponsor decided, no voting
    if (sponsorDecided) {
      return false;
    }

    // Voting opens after sponsor window
    const votingStartTime = requestedAt + sponsorWindowMs;
    const votingEndTime = votingStartTime + votingWindowMs;

    return currentTime >= votingStartTime && currentTime < votingEndTime;
  }

  /**
   * Check if sponsor window is open
   */
  isSponsorWindowOpen(requestedAt: number, currentTime: number): boolean {
    const sponsorWindowMs = this.sponsorWindowDays * 24 * 60 * 60 * 1000;
    return currentTime < requestedAt + sponsorWindowMs;
  }
}
