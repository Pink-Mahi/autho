import { NetworkHealthMetrics, PeerInfo, OperatorRegistryEntry } from './node-types';

/**
 * NETWORK HEALTH METRICS TRACKER
 * 
 * Monitors network health and capacity:
 * - Quorum Availability Ratio (QAR)
 * - Network diversity (ASN, provider, region)
 * - Finalization performance (latency, backlog)
 * - Capacity alerts
 */
export class HealthMetricsTracker {
  private metrics: NetworkHealthMetrics;
  private quorumM: number;
  private quorumN: number;
  private checkHistory: Map<number, boolean>; // timestamp -> quorum available
  private latencyHistory: number[];
  private maxHistorySize: number;
  private alertThresholdDays: number;

  constructor(quorumM: number, quorumN: number) {
    this.quorumM = quorumM;
    this.quorumN = quorumN;
    this.checkHistory = new Map();
    this.latencyHistory = [];
    this.maxHistorySize = 1000;
    this.alertThresholdDays = 14;

    this.metrics = {
      quorumAvailabilityRatio: 1.0,
      diversityScore: 0,
      activeOperators: 0,
      activeGateways: 0,
      averageLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      backlogSize: 0,
      lastCheckpointTime: 0,
      networkCapacityAlert: false,
      alertReason: null,
      measuredAt: Date.now()
    };
  }

  /**
   * Update metrics based on current network state
   */
  updateMetrics(
    operators: OperatorRegistryEntry[],
    peers: PeerInfo[],
    backlogSize: number,
    lastCheckpointTime: number
  ): NetworkHealthMetrics {
    const now = Date.now();

    // Count active nodes
    const activeOperators = operators.filter(op => this.isOperatorActive(op)).length;
    const activeGateways = peers.filter(p => p.role === 'gateway').length;

    // Calculate QAR
    const quorumAvailable = activeOperators >= this.quorumM;
    this.checkHistory.set(now, quorumAvailable);
    this.pruneHistory();
    const qar = this.calculateQAR();

    // Calculate diversity score
    const diversityScore = this.calculateDiversityScore(operators, peers);

    // Calculate latency metrics
    const latencyMetrics = this.calculateLatencyMetrics();

    // Check for capacity alerts
    const { alert, reason } = this.checkCapacityAlert(qar, activeOperators, backlogSize);

    this.metrics = {
      quorumAvailabilityRatio: qar,
      diversityScore,
      activeOperators,
      activeGateways,
      averageLatency: latencyMetrics.average,
      p50Latency: latencyMetrics.p50,
      p95Latency: latencyMetrics.p95,
      backlogSize,
      lastCheckpointTime,
      networkCapacityAlert: alert,
      alertReason: reason,
      measuredAt: now
    };

    return this.metrics;
  }

  /**
   * Record latency measurement
   */
  recordLatency(latencyMs: number): void {
    this.latencyHistory.push(latencyMs);
    if (this.latencyHistory.length > this.maxHistorySize) {
      this.latencyHistory.shift();
    }
  }

  /**
   * Calculate Quorum Availability Ratio
   * 
   * QAR = (time with quorum available) / (total time)
   */
  private calculateQAR(): number {
    if (this.checkHistory.size === 0) return 1.0;

    const availableCount = Array.from(this.checkHistory.values())
      .filter(available => available).length;

    return availableCount / this.checkHistory.size;
  }

  /**
   * Calculate network diversity score
   * 
   * Measures distribution across:
   * - ASN (Autonomous System Number)
   * - Provider (cloud/hosting provider)
   * - Region (geographic location)
   * 
   * Score: 0.0 (all same) to 1.0 (maximally diverse)
   */
  private calculateDiversityScore(
    operators: OperatorRegistryEntry[],
    peers: PeerInfo[]
  ): number {
    const allNodes = [...operators, ...peers];
    if (allNodes.length === 0) return 0;

    // Count unique values
    const uniqueASNs = new Set(allNodes.map(n => n.asn).filter(Boolean)).size;
    const uniqueProviders = new Set(allNodes.map(n => n.provider).filter(Boolean)).size;
    const uniqueRegions = new Set(allNodes.map(n => n.region).filter(Boolean)).size;

    // Calculate diversity for each dimension
    const asnDiversity = Math.min(uniqueASNs / allNodes.length, 1.0);
    const providerDiversity = Math.min(uniqueProviders / allNodes.length, 1.0);
    const regionDiversity = Math.min(uniqueRegions / allNodes.length, 1.0);

    // Weighted average (ASN and provider more important than region)
    return (asnDiversity * 0.4 + providerDiversity * 0.4 + regionDiversity * 0.2);
  }

  /**
   * Calculate latency percentiles
   */
  private calculateLatencyMetrics(): {
    average: number;
    p50: number;
    p95: number;
  } {
    if (this.latencyHistory.length === 0) {
      return { average: 0, p50: 0, p95: 0 };
    }

    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const average = sum / sorted.length;

    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      average,
      p50: sorted[p50Index],
      p95: sorted[p95Index]
    };
  }

  /**
   * Check if operator is active
   * 
   * Active = signed ≥80% of last 100 checkpoints AND active within last 7 days
   */
  private isOperatorActive(operator: OperatorRegistryEntry): boolean {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    // Check last seen
    if (operator.lastSeen < sevenDaysAgo) {
      return false;
    }

    // Check signature participation
    // TODO: Implement actual checkpoint signature tracking
    // For now, assume active if recently seen
    return true;
  }

  /**
   * Check for network capacity alerts
   * 
   * Alert if:
   * - QAR < 95% for 14+ days
   * - Active operators < quorum M for 14+ days
   * - Backlog > 1000 events for 14+ days
   */
  private checkCapacityAlert(
    qar: number,
    activeOperators: number,
    backlogSize: number
  ): { alert: boolean; reason: string | null } {
    const now = Date.now();
    const fourteenDaysAgo = now - (this.alertThresholdDays * 24 * 60 * 60 * 1000);

    // Check QAR threshold
    if (qar < 0.95) {
      const recentChecks = Array.from(this.checkHistory.entries())
        .filter(([timestamp]) => timestamp >= fourteenDaysAgo);

      if (recentChecks.length > 0) {
        const recentQAR = recentChecks.filter(([, available]) => available).length / recentChecks.length;
        if (recentQAR < 0.95) {
          return {
            alert: true,
            reason: `Quorum availability below 95% for ${this.alertThresholdDays}+ days (current: ${(qar * 100).toFixed(1)}%)`
          };
        }
      }
    }

    // Check active operators
    if (activeOperators < this.quorumM) {
      return {
        alert: true,
        reason: `Active operators (${activeOperators}) below quorum threshold (${this.quorumM})`
      };
    }

    // Check backlog
    if (backlogSize > 1000) {
      return {
        alert: true,
        reason: `Event backlog exceeds 1000 (current: ${backlogSize})`
      };
    }

    return { alert: false, reason: null };
  }

  /**
   * Prune old history entries
   */
  private pruneHistory(): void {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    for (const [timestamp] of this.checkHistory) {
      if (timestamp < thirtyDaysAgo) {
        this.checkHistory.delete(timestamp);
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): NetworkHealthMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detailed health report
   */
  getHealthReport(): {
    status: 'healthy' | 'degraded' | 'critical';
    metrics: NetworkHealthMetrics;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // Check QAR
    if (this.metrics.quorumAvailabilityRatio < 0.95) {
      status = 'degraded';
      recommendations.push('Quorum availability is below 95%. Consider adding more operators.');
    }

    if (this.metrics.quorumAvailabilityRatio < 0.80) {
      status = 'critical';
      recommendations.push('CRITICAL: Quorum availability is below 80%. Network at risk.');
    }

    // Check diversity
    if (this.metrics.diversityScore < 0.5) {
      if (status === 'healthy') status = 'degraded';
      recommendations.push('Network diversity is low. Operators should be distributed across different providers and regions.');
    }

    // Check active operators
    if (this.metrics.activeOperators < this.quorumM) {
      status = 'critical';
      recommendations.push(`CRITICAL: Active operators (${this.metrics.activeOperators}) below quorum threshold (${this.quorumM}).`);
    }

    if (this.metrics.activeOperators < this.quorumN) {
      if (status === 'healthy') status = 'degraded';
      recommendations.push(`Active operators (${this.metrics.activeOperators}) below total operator count (${this.quorumN}). Some operators may be offline.`);
    }

    // Check latency
    if (this.metrics.p95Latency > 5000) {
      if (status === 'healthy') status = 'degraded';
      recommendations.push(`P95 latency is high (${this.metrics.p95Latency}ms). Network performance may be degraded.`);
    }

    // Check backlog
    if (this.metrics.backlogSize > 1000) {
      if (status === 'healthy') status = 'degraded';
      recommendations.push(`Event backlog is large (${this.metrics.backlogSize}). Operators may be falling behind.`);
    }

    if (this.metrics.backlogSize > 10000) {
      status = 'critical';
      recommendations.push(`CRITICAL: Event backlog exceeds 10,000 (${this.metrics.backlogSize}). Network capacity exceeded.`);
    }

    // Check checkpoint freshness
    const now = Date.now();
    const hoursSinceCheckpoint = (now - this.metrics.lastCheckpointTime) / (60 * 60 * 1000);
    if (hoursSinceCheckpoint > 2) {
      if (status === 'healthy') status = 'degraded';
      recommendations.push(`Last checkpoint was ${hoursSinceCheckpoint.toFixed(1)} hours ago. Checkpoints should be created hourly.`);
    }

    if (hoursSinceCheckpoint > 24) {
      status = 'critical';
      recommendations.push(`CRITICAL: No checkpoint in 24+ hours. Bitcoin anchoring may have failed.`);
    }

    return {
      status,
      metrics: this.metrics,
      recommendations
    };
  }

  /**
   * Export metrics for monitoring/alerting
   */
  exportPrometheusMetrics(): string {
    const m = this.metrics;
    return `
# HELP autho_quorum_availability_ratio Percentage of time quorum is available
# TYPE autho_quorum_availability_ratio gauge
autho_quorum_availability_ratio ${m.quorumAvailabilityRatio}

# HELP autho_diversity_score Network diversity score (0-1)
# TYPE autho_diversity_score gauge
autho_diversity_score ${m.diversityScore}

# HELP autho_active_operators Number of active operator nodes
# TYPE autho_active_operators gauge
autho_active_operators ${m.activeOperators}

# HELP autho_active_gateways Number of active gateway nodes
# TYPE autho_active_gateways gauge
autho_active_gateways ${m.activeGateways}

# HELP autho_latency_average_ms Average network latency in milliseconds
# TYPE autho_latency_average_ms gauge
autho_latency_average_ms ${m.averageLatency}

# HELP autho_latency_p50_ms P50 network latency in milliseconds
# TYPE autho_latency_p50_ms gauge
autho_latency_p50_ms ${m.p50Latency}

# HELP autho_latency_p95_ms P95 network latency in milliseconds
# TYPE autho_latency_p95_ms gauge
autho_latency_p95_ms ${m.p95Latency}

# HELP autho_backlog_size Number of unprocessed events
# TYPE autho_backlog_size gauge
autho_backlog_size ${m.backlogSize}

# HELP autho_network_capacity_alert Network capacity alert status
# TYPE autho_network_capacity_alert gauge
autho_network_capacity_alert ${m.networkCapacityAlert ? 1 : 0}
`.trim();
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.checkHistory.clear();
    this.latencyHistory = [];
    this.metrics = {
      quorumAvailabilityRatio: 1.0,
      diversityScore: 0,
      activeOperators: 0,
      activeGateways: 0,
      averageLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      backlogSize: 0,
      lastCheckpointTime: 0,
      networkCapacityAlert: false,
      alertReason: null,
      measuredAt: Date.now()
    };
  }
}

/**
 * Operator Performance Tracker
 * 
 * Tracks individual operator performance for admission/slashing
 */
export class OperatorPerformanceTracker {
  private checkpointSignatures: Map<string, Set<string>>; // checkpointId -> Set<operatorId>
  private operatorUptime: Map<string, number[]>; // operatorId -> [timestamp...]
  private operatorLatency: Map<string, number[]>; // operatorId -> [latency...]

  constructor() {
    this.checkpointSignatures = new Map();
    this.operatorUptime = new Map();
    this.operatorLatency = new Map();
  }

  /**
   * Record checkpoint signature
   */
  recordCheckpointSignature(checkpointId: string, operatorId: string): void {
    if (!this.checkpointSignatures.has(checkpointId)) {
      this.checkpointSignatures.set(checkpointId, new Set());
    }
    this.checkpointSignatures.get(checkpointId)!.add(operatorId);
  }

  /**
   * Record operator uptime check
   */
  recordUptimeCheck(operatorId: string, timestamp: number = Date.now()): void {
    if (!this.operatorUptime.has(operatorId)) {
      this.operatorUptime.set(operatorId, []);
    }
    this.operatorUptime.get(operatorId)!.push(timestamp);
  }

  /**
   * Record operator latency
   */
  recordOperatorLatency(operatorId: string, latencyMs: number): void {
    if (!this.operatorLatency.has(operatorId)) {
      this.operatorLatency.set(operatorId, []);
    }
    this.operatorLatency.get(operatorId)!.push(latencyMs);
  }

  /**
   * Calculate operator signature participation rate
   */
  getSignatureParticipation(operatorId: string, lastN: number = 100): number {
    const recentCheckpoints = Array.from(this.checkpointSignatures.entries())
      .slice(-lastN);

    if (recentCheckpoints.length === 0) return 0;

    const signedCount = recentCheckpoints.filter(([, signers]) => 
      signers.has(operatorId)
    ).length;

    return signedCount / recentCheckpoints.length;
  }

  /**
   * Calculate operator uptime percentage
   */
  getUptimePercentage(operatorId: string, daysBack: number = 90): number {
    const uptimeChecks = this.operatorUptime.get(operatorId) || [];
    if (uptimeChecks.length === 0) return 0;

    const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
    const recentChecks = uptimeChecks.filter(t => t >= cutoffTime);

    // Assume checks every hour, calculate expected checks
    const expectedChecks = daysBack * 24;
    return Math.min(recentChecks.length / expectedChecks, 1.0);
  }

  /**
   * Get operator average latency
   */
  getAverageLatency(operatorId: string): number {
    const latencies = this.operatorLatency.get(operatorId) || [];
    if (latencies.length === 0) return 0;

    const sum = latencies.reduce((acc, val) => acc + val, 0);
    return sum / latencies.length;
  }

  /**
   * Check if operator meets admission criteria
   */
  meetsAdmissionCriteria(operatorId: string): {
    eligible: boolean;
    uptime: number;
    avgLatency: number;
    reasons: string[];
  } {
    const uptime = this.getUptimePercentage(operatorId, 90);
    const avgLatency = this.getAverageLatency(operatorId);
    const reasons: string[] = [];
    let eligible = true;

    // Check 90-day uptime requirement (95%+)
    if (uptime < 0.95) {
      eligible = false;
      reasons.push(`Uptime ${(uptime * 100).toFixed(1)}% below 95% requirement`);
    }

    // Check latency requirement (<5000ms)
    if (avgLatency > 5000) {
      eligible = false;
      reasons.push(`Average latency ${avgLatency.toFixed(0)}ms exceeds 5000ms limit`);
    }

    if (eligible) {
      reasons.push('Meets all admission criteria');
    }

    return { eligible, uptime, avgLatency, reasons };
  }
}
