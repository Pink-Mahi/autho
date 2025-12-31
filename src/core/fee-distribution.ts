import { Operator } from '../types';

export interface FeeDistribution {
  mainNode: {
    operatorId: string;
    address: string;
    amount: number;
    percentage: number;
  };
  operators: Array<{
    operatorId: string;
    address: string;
    amount: number;
    percentage: number;
  }>;
  total: number;
}

export interface FeeConfig {
  mainNodeId: string;
  mainNodeAddress: string;
  mainNodePercentage: number; // e.g., 60
  operatorPercentage: number; // e.g., 40
}

export class FeeDistributor {
  private config: FeeConfig;

  constructor(config: FeeConfig) {
    this.config = config;
  }

  calculateDistribution(
    totalFeeSats: number,
    activeOperators: Operator[]
  ): FeeDistribution {
    const mainNodeAmount = Math.floor(
      (totalFeeSats * this.config.mainNodePercentage) / 100
    );

    const operatorPoolAmount = totalFeeSats - mainNodeAmount;

    const operatorCount = activeOperators.filter(
      op => op.operatorId !== this.config.mainNodeId
    ).length;

    const perOperatorAmount = operatorCount > 0
      ? Math.floor(operatorPoolAmount / operatorCount)
      : 0;

    const operators = activeOperators
      .filter(op => op.operatorId !== this.config.mainNodeId)
      .map(op => ({
        operatorId: op.operatorId,
        address: op.btcAddress,
        amount: perOperatorAmount,
        percentage: operatorCount > 0
          ? this.config.operatorPercentage / operatorCount
          : 0
      }));

    return {
      mainNode: {
        operatorId: this.config.mainNodeId,
        address: this.config.mainNodeAddress,
        amount: mainNodeAmount,
        percentage: this.config.mainNodePercentage
      },
      operators,
      total: totalFeeSats
    };
  }

  getMainNodeShare(totalFeeSats: number): number {
    return Math.floor((totalFeeSats * this.config.mainNodePercentage) / 100);
  }

  getOperatorShare(totalFeeSats: number, operatorCount: number): number {
    const operatorPool = totalFeeSats - this.getMainNodeShare(totalFeeSats);
    return operatorCount > 0 ? Math.floor(operatorPool / operatorCount) : 0;
  }

  updateConfig(newConfig: Partial<FeeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): FeeConfig {
    return { ...this.config };
  }
}

export function createDefaultFeeConfig(
  mainNodeId: string,
  mainNodeAddress: string
): FeeConfig {
  return {
    mainNodeId,
    mainNodeAddress,
    mainNodePercentage: 60,
    operatorPercentage: 40
  };
}
