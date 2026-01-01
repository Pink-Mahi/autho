import { OperatorEarnings } from './node-types';

/**
 * OPERATOR EARNINGS TRACKER
 * 
 * Tracks operator earnings from settlement fees:
 * - Per-work fee distribution (not per-membership)
 * - Committee selection tracking
 * - Bitcoin payment monitoring
 * - Earnings verification
 */
export class OperatorEarningsTracker {
  private earnings: Map<string, OperatorEarnings>;
  private settlementCommittees: Map<string, string[]>; // settlementId -> operatorIds
  private pendingPayments: Map<string, PendingPayment>;

  constructor() {
    this.earnings = new Map();
    this.settlementCommittees = new Map();
    this.pendingPayments = new Map();
  }

  /**
   * Record committee selection for settlement
   */
  recordCommitteeSelection(
    settlementId: string,
    offerId: string,
    committeeOperators: string[],
    expectedFeePerOperator: number
  ): void {
    this.settlementCommittees.set(settlementId, committeeOperators);

    // Create pending payment for each committee member
    for (const operatorId of committeeOperators) {
      const paymentId = `${settlementId}-${operatorId}`;
      this.pendingPayments.set(paymentId, {
        settlementId,
        operatorId,
        offerId,
        expectedAmount: expectedFeePerOperator,
        status: 'pending',
        createdAt: Date.now()
      });

      // Initialize earnings record if needed
      if (!this.earnings.has(operatorId)) {
        this.earnings.set(operatorId, {
          operatorId,
          totalEarned: 0,
          settlementsParticipated: 0,
          lastSettlementTime: 0,
          pendingEarnings: 0,
          earningsByMonth: new Map()
        });
      }

      // Update pending earnings
      const record = this.earnings.get(operatorId)!;
      record.pendingEarnings += expectedFeePerOperator;
    }
  }

  /**
   * Confirm payment received on Bitcoin blockchain
   */
  confirmPayment(
    settlementId: string,
    operatorId: string,
    bitcoinTxId: string,
    actualAmount: number,
    blockHeight: number
  ): void {
    const paymentId = `${settlementId}-${operatorId}`;
    const pending = this.pendingPayments.get(paymentId);

    if (!pending) {
      console.warn(`[EarningsTracker] No pending payment found: ${paymentId}`);
      return;
    }

    // Update pending payment
    pending.status = 'confirmed';
    pending.bitcoinTxId = bitcoinTxId;
    pending.actualAmount = actualAmount;
    pending.blockHeight = blockHeight;
    pending.confirmedAt = Date.now();

    // Update earnings record
    const record = this.earnings.get(operatorId);
    if (record) {
      record.totalEarned += actualAmount;
      record.settlementsParticipated++;
      record.lastSettlementTime = Date.now();
      record.pendingEarnings -= pending.expectedAmount;

      // Track by month
      const monthKey = this.getMonthKey(Date.now());
      const monthlyEarnings = record.earningsByMonth.get(monthKey) || 0;
      record.earningsByMonth.set(monthKey, monthlyEarnings + actualAmount);
    }

    console.log(`[EarningsTracker] Payment confirmed: ${operatorId} earned ${actualAmount} sats (tx: ${bitcoinTxId})`);
  }

  /**
   * Mark payment as failed
   */
  markPaymentFailed(settlementId: string, operatorId: string, reason: string): void {
    const paymentId = `${settlementId}-${operatorId}`;
    const pending = this.pendingPayments.get(paymentId);

    if (pending) {
      pending.status = 'failed';
      pending.failureReason = reason;

      // Remove from pending earnings
      const record = this.earnings.get(operatorId);
      if (record) {
        record.pendingEarnings -= pending.expectedAmount;
      }
    }
  }

  /**
   * Get operator earnings
   */
  getOperatorEarnings(operatorId: string): OperatorEarnings | null {
    return this.earnings.get(operatorId) || null;
  }

  /**
   * Get all operator earnings
   */
  getAllEarnings(): OperatorEarnings[] {
    return Array.from(this.earnings.values());
  }

  /**
   * Get top earners
   */
  getTopEarners(limit: number = 10): OperatorEarnings[] {
    return Array.from(this.earnings.values())
      .sort((a, b) => b.totalEarned - a.totalEarned)
      .slice(0, limit);
  }

  /**
   * Get earnings for specific month
   */
  getMonthlyEarnings(operatorId: string, year: number, month: number): number {
    const record = this.earnings.get(operatorId);
    if (!record) return 0;

    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    return record.earningsByMonth.get(monthKey) || 0;
  }

  /**
   * Get pending payments for operator
   */
  getPendingPayments(operatorId: string): PendingPayment[] {
    return Array.from(this.pendingPayments.values())
      .filter(p => p.operatorId === operatorId && p.status === 'pending');
  }

  /**
   * Get committee for settlement
   */
  getSettlementCommittee(settlementId: string): string[] | null {
    return this.settlementCommittees.get(settlementId) || null;
  }

  /**
   * Calculate earnings statistics
   */
  getEarningsStats(): {
    totalDistributed: number;
    totalPending: number;
    totalSettlements: number;
    activeOperators: number;
    averageEarningsPerOperator: number;
    averageEarningsPerSettlement: number;
  } {
    const allEarnings = this.getAllEarnings();
    const totalDistributed = allEarnings.reduce((sum, e) => sum + e.totalEarned, 0);
    const totalPending = allEarnings.reduce((sum, e) => sum + e.pendingEarnings, 0);
    const totalSettlements = allEarnings.reduce((sum, e) => sum + e.settlementsParticipated, 0);
    const activeOperators = allEarnings.filter(e => e.totalEarned > 0).length;

    return {
      totalDistributed,
      totalPending,
      totalSettlements,
      activeOperators,
      averageEarningsPerOperator: activeOperators > 0 ? totalDistributed / activeOperators : 0,
      averageEarningsPerSettlement: totalSettlements > 0 ? totalDistributed / totalSettlements : 0
    };
  }

  /**
   * Verify payment matches expected amount
   */
  verifyPayment(
    settlementId: string,
    operatorId: string,
    actualAmount: number,
    tolerance: number = 0.01 // 1% tolerance
  ): { valid: boolean; reason?: string } {
    const paymentId = `${settlementId}-${operatorId}`;
    const pending = this.pendingPayments.get(paymentId);

    if (!pending) {
      return { valid: false, reason: 'No pending payment found' };
    }

    const expectedAmount = pending.expectedAmount;
    const difference = Math.abs(actualAmount - expectedAmount);
    const percentDifference = difference / expectedAmount;

    if (percentDifference > tolerance) {
      return {
        valid: false,
        reason: `Amount mismatch: expected ${expectedAmount}, got ${actualAmount} (${(percentDifference * 100).toFixed(2)}% difference)`
      };
    }

    return { valid: true };
  }

  /**
   * Get month key for earnings tracking
   */
  private getMonthKey(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Export earnings report
   */
  exportEarningsReport(operatorId?: string): string {
    const earnings = operatorId 
      ? [this.earnings.get(operatorId)].filter(Boolean) as OperatorEarnings[]
      : this.getAllEarnings();

    let report = '# Operator Earnings Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    if (operatorId) {
      report += `## Operator: ${operatorId}\n\n`;
    } else {
      report += `## All Operators\n\n`;
    }

    for (const record of earnings) {
      report += `### ${record.operatorId}\n`;
      report += `- Total Earned: ${record.totalEarned} sats\n`;
      report += `- Pending: ${record.pendingEarnings} sats\n`;
      report += `- Settlements: ${record.settlementsParticipated}\n`;
      report += `- Last Settlement: ${new Date(record.lastSettlementTime).toISOString()}\n`;
      report += `- Average per Settlement: ${record.settlementsParticipated > 0 ? (record.totalEarned / record.settlementsParticipated).toFixed(0) : 0} sats\n`;
      report += '\n';

      // Monthly breakdown
      if (record.earningsByMonth.size > 0) {
        report += '#### Monthly Earnings\n';
        const sortedMonths = Array.from(record.earningsByMonth.entries())
          .sort(([a], [b]) => b.localeCompare(a));
        
        for (const [month, amount] of sortedMonths) {
          report += `- ${month}: ${amount} sats\n`;
        }
        report += '\n';
      }
    }

    // Overall stats
    const stats = this.getEarningsStats();
    report += '## Overall Statistics\n';
    report += `- Total Distributed: ${stats.totalDistributed} sats\n`;
    report += `- Total Pending: ${stats.totalPending} sats\n`;
    report += `- Total Settlements: ${stats.totalSettlements}\n`;
    report += `- Active Operators: ${stats.activeOperators}\n`;
    report += `- Avg per Operator: ${stats.averageEarningsPerOperator.toFixed(0)} sats\n`;
    report += `- Avg per Settlement: ${stats.averageEarningsPerSettlement.toFixed(0)} sats\n`;

    return report;
  }

  /**
   * Clean up old pending payments
   */
  cleanupOldPendingPayments(maxAgeDays: number = 30): number {
    const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [paymentId, payment] of this.pendingPayments) {
      if (payment.status === 'pending' && payment.createdAt < cutoffTime) {
        this.markPaymentFailed(payment.settlementId, payment.operatorId, 'Timeout');
        this.pendingPayments.delete(paymentId);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * Pending payment record
 */
interface PendingPayment {
  settlementId: string;
  operatorId: string;
  offerId: string;
  expectedAmount: number;
  actualAmount?: number;
  status: 'pending' | 'confirmed' | 'failed';
  bitcoinTxId?: string;
  blockHeight?: number;
  createdAt: number;
  confirmedAt?: number;
  failureReason?: string;
}

/**
 * Settlement Fee Calculator
 * 
 * Calculates operator fees based on settlement amount
 */
export class SettlementFeeCalculator {
  private operatorFeePercentage: number;
  private quorumSize: number;

  constructor(operatorFeePercentage: number = 0.40, quorumSize: number = 5) {
    this.operatorFeePercentage = operatorFeePercentage;
    this.quorumSize = quorumSize;
  }

  /**
   * Calculate operator fees for settlement
   * 
   * Settlement Transaction:
   * - Seller receives 60%
   * - Operators receive 40% (split equally among K committee members)
   */
  calculateFees(settlementAmountSats: number): {
    sellerAmount: number;
    totalOperatorFees: number;
    feePerOperator: number;
    breakdown: {
      settlementAmount: number;
      sellerPercentage: number;
      operatorPercentage: number;
      committeeSize: number;
    };
  } {
    const totalOperatorFees = Math.floor(settlementAmountSats * this.operatorFeePercentage);
    const sellerAmount = settlementAmountSats - totalOperatorFees;
    const feePerOperator = Math.floor(totalOperatorFees / this.quorumSize);

    return {
      sellerAmount,
      totalOperatorFees,
      feePerOperator,
      breakdown: {
        settlementAmount: settlementAmountSats,
        sellerPercentage: (1 - this.operatorFeePercentage) * 100,
        operatorPercentage: this.operatorFeePercentage * 100,
        committeeSize: this.quorumSize
      }
    };
  }

  /**
   * Build settlement transaction outputs
   */
  buildSettlementOutputs(
    settlementAmountSats: number,
    sellerAddress: string,
    operatorAddresses: string[]
  ): Array<{ address: string; amount: number; role: 'seller' | 'operator' }> {
    if (operatorAddresses.length !== this.quorumSize) {
      throw new Error(`Expected ${this.quorumSize} operator addresses, got ${operatorAddresses.length}`);
    }

    const fees = this.calculateFees(settlementAmountSats);
    const outputs: Array<{ address: string; amount: number; role: 'seller' | 'operator' }> = [];

    // Seller output
    outputs.push({
      address: sellerAddress,
      amount: fees.sellerAmount,
      role: 'seller'
    });

    // Operator outputs
    for (const operatorAddress of operatorAddresses) {
      outputs.push({
        address: operatorAddress,
        amount: fees.feePerOperator,
        role: 'operator'
      });
    }

    return outputs;
  }

  /**
   * Verify settlement transaction outputs
   */
  verifySettlementTransaction(
    expectedAmount: number,
    sellerAddress: string,
    operatorAddresses: string[],
    actualOutputs: Array<{ address: string; amount: number }>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const expectedOutputs = this.buildSettlementOutputs(expectedAmount, sellerAddress, operatorAddresses);

    // Check output count
    if (actualOutputs.length !== expectedOutputs.length) {
      errors.push(`Output count mismatch: expected ${expectedOutputs.length}, got ${actualOutputs.length}`);
      return { valid: false, errors };
    }

    // Verify each output
    for (let i = 0; i < expectedOutputs.length; i++) {
      const expected = expectedOutputs[i];
      const actual = actualOutputs[i];

      if (expected.address !== actual.address) {
        errors.push(`Output ${i} address mismatch: expected ${expected.address}, got ${actual.address}`);
      }

      // Allow 1% tolerance for rounding
      const tolerance = Math.max(1, Math.floor(expected.amount * 0.01));
      if (Math.abs(expected.amount - actual.amount) > tolerance) {
        errors.push(`Output ${i} amount mismatch: expected ${expected.amount}, got ${actual.amount}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate total fees for multiple settlements
   */
  calculateBatchFees(settlementAmounts: number[]): {
    totalSettlementAmount: number;
    totalSellerAmount: number;
    totalOperatorFees: number;
    settlementsCount: number;
  } {
    let totalSettlementAmount = 0;
    let totalSellerAmount = 0;
    let totalOperatorFees = 0;

    for (const amount of settlementAmounts) {
      const fees = this.calculateFees(amount);
      totalSettlementAmount += amount;
      totalSellerAmount += fees.sellerAmount;
      totalOperatorFees += fees.totalOperatorFees;
    }

    return {
      totalSettlementAmount,
      totalSellerAmount,
      totalOperatorFees,
      settlementsCount: settlementAmounts.length
    };
  }
}

/**
 * Bitcoin Payment Monitor
 * 
 * Monitors Bitcoin blockchain for settlement payments
 */
export class BitcoinPaymentMonitor {
  private watchedAddresses: Map<string, WatchedAddress>;
  private confirmedPayments: Map<string, ConfirmedPayment>;

  constructor() {
    this.watchedAddresses = new Map();
    this.confirmedPayments = new Map();
  }

  /**
   * Watch address for incoming payment
   */
  watchAddress(
    address: string,
    operatorId: string,
    settlementId: string,
    expectedAmount: number
  ): void {
    this.watchedAddresses.set(address, {
      address,
      operatorId,
      settlementId,
      expectedAmount,
      addedAt: Date.now()
    });
  }

  /**
   * Record confirmed payment
   */
  recordPayment(
    address: string,
    txid: string,
    amount: number,
    blockHeight: number
  ): ConfirmedPayment | null {
    const watched = this.watchedAddresses.get(address);
    if (!watched) {
      console.warn(`[PaymentMonitor] Payment to unwatched address: ${address}`);
      return null;
    }

    const payment: ConfirmedPayment = {
      address,
      operatorId: watched.operatorId,
      settlementId: watched.settlementId,
      expectedAmount: watched.expectedAmount,
      actualAmount: amount,
      txid,
      blockHeight,
      confirmedAt: Date.now()
    };

    this.confirmedPayments.set(`${txid}-${address}`, payment);
    this.watchedAddresses.delete(address);

    return payment;
  }

  /**
   * Get watched addresses
   */
  getWatchedAddresses(): WatchedAddress[] {
    return Array.from(this.watchedAddresses.values());
  }

  /**
   * Get confirmed payments
   */
  getConfirmedPayments(): ConfirmedPayment[] {
    return Array.from(this.confirmedPayments.values());
  }

  /**
   * Clean up old watched addresses
   */
  cleanupOldWatches(maxAgeDays: number = 30): number {
    const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [address, watch] of this.watchedAddresses) {
      if (watch.addedAt < cutoffTime) {
        this.watchedAddresses.delete(address);
        cleaned++;
      }
    }

    return cleaned;
  }
}

interface WatchedAddress {
  address: string;
  operatorId: string;
  settlementId: string;
  expectedAmount: number;
  addedAt: number;
}

interface ConfirmedPayment {
  address: string;
  operatorId: string;
  settlementId: string;
  expectedAmount: number;
  actualAmount: number;
  txid: string;
  blockHeight: number;
  confirmedAt: number;
}
