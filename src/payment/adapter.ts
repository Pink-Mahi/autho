import { PaymentProof } from '../types';

export interface Invoice {
  invoiceId: string;
  amountSats: number;
  paymentAddress?: string;
  lightningInvoice?: string;
  expiryTimestamp: number;
  description: string;
}

export interface PaymentAdapter {
  createInvoice(params: {
    amountSats: number;
    description: string;
    expirySeconds: number;
  }): Promise<Invoice>;

  verifyPayment(invoiceId: string): Promise<PaymentProof | null>;

  releaseFunds(address: string, amountSats: number): Promise<string>;

  getBalance(): Promise<number>;
}

export class MockPaymentAdapter implements PaymentAdapter {
  private invoices: Map<string, Invoice> = new Map();
  private payments: Map<string, PaymentProof> = new Map();
  private balance: number = 1000000;

  async createInvoice(params: {
    amountSats: number;
    description: string;
    expirySeconds: number;
  }): Promise<Invoice> {
    const invoiceId = this.generateInvoiceId();
    const invoice: Invoice = {
      invoiceId,
      amountSats: params.amountSats,
      paymentAddress: this.generateBitcoinAddress(),
      expiryTimestamp: Date.now() + params.expirySeconds * 1000,
      description: params.description
    };

    this.invoices.set(invoiceId, invoice);
    return invoice;
  }

  async verifyPayment(invoiceId: string): Promise<PaymentProof | null> {
    return this.payments.get(invoiceId) || null;
  }

  async releaseFunds(address: string, amountSats: number): Promise<string> {
    if (this.balance < amountSats) {
      throw new Error('Insufficient balance');
    }

    this.balance -= amountSats;
    const txHash = this.generateTxHash();
    
    console.log(`[MockPayment] Released ${amountSats} sats to ${address}, txHash: ${txHash}`);
    return txHash;
  }

  async getBalance(): Promise<number> {
    return this.balance;
  }

  mockPayInvoice(invoiceId: string, txHash?: string): void {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const proof: PaymentProof = {
      paymentType: 'ONCHAIN',
      txHash: txHash || this.generateTxHash(),
      amountSats: invoice.amountSats,
      confirmations: 6,
      verifiedAt: Date.now()
    };

    this.payments.set(invoiceId, proof);
    this.balance += invoice.amountSats;
  }

  private generateInvoiceId(): string {
    return 'inv_' + Math.random().toString(36).substring(2, 15);
  }

  private generateBitcoinAddress(): string {
    return '1' + Math.random().toString(36).substring(2, 15).toUpperCase();
  }

  private generateTxHash(): string {
    return Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}

export class BitcoinRPCAdapter implements PaymentAdapter {
  private rpcUrl: string;
  private rpcUser: string;
  private rpcPassword: string;

  constructor(rpcUrl: string, rpcUser: string, rpcPassword: string) {
    this.rpcUrl = rpcUrl;
    this.rpcUser = rpcUser;
    this.rpcPassword = rpcPassword;
  }

  async createInvoice(params: {
    amountSats: number;
    description: string;
    expirySeconds: number;
  }): Promise<Invoice> {
    const address = await this.rpcCall('getnewaddress', [params.description]);
    
    return {
      invoiceId: address,
      amountSats: params.amountSats,
      paymentAddress: address,
      expiryTimestamp: Date.now() + params.expirySeconds * 1000,
      description: params.description
    };
  }

  async verifyPayment(invoiceId: string): Promise<PaymentProof | null> {
    try {
      const received = await this.rpcCall('getreceivedbyaddress', [invoiceId, 1]);
      
      if (received === 0) {
        return null;
      }

      const txs = await this.rpcCall('listtransactions', ['*', 100]);
      const relevantTx = txs.find((tx: any) => tx.address === invoiceId);

      if (!relevantTx) {
        return null;
      }

      return {
        paymentType: 'ONCHAIN',
        txHash: relevantTx.txid,
        amountSats: Math.floor(relevantTx.amount * 100000000),
        confirmations: relevantTx.confirmations,
        verifiedAt: Date.now()
      };
    } catch (error) {
      console.error('Error verifying payment:', error);
      return null;
    }
  }

  async releaseFunds(address: string, amountSats: number): Promise<string> {
    const btcAmount = amountSats / 100000000;
    const txid = await this.rpcCall('sendtoaddress', [address, btcAmount]);
    return txid;
  }

  async getBalance(): Promise<number> {
    const balance = await this.rpcCall('getbalance', []);
    return Math.floor(balance * 100000000);
  }

  private async rpcCall(method: string, params: any[]): Promise<any> {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${this.rpcUser}:${this.rpcPassword}`).toString('base64')
      },
      body: JSON.stringify({
        jsonrpc: '1.0',
        id: 'bitcoin-ownership-protocol',
        method,
        params
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Bitcoin RPC error: ${data.error.message}`);
    }

    return data.result;
  }
}

export class LightningAdapter implements PaymentAdapter {
  private lndUrl: string;
  private macaroon: string;

  constructor(lndUrl: string, macaroon: string) {
    this.lndUrl = lndUrl;
    this.macaroon = macaroon;
  }

  async createInvoice(params: {
    amountSats: number;
    description: string;
    expirySeconds: number;
  }): Promise<Invoice> {
    const response = await this.lndCall('/v1/invoices', 'POST', {
      value: params.amountSats,
      memo: params.description,
      expiry: params.expirySeconds
    });

    return {
      invoiceId: response.r_hash,
      amountSats: params.amountSats,
      lightningInvoice: response.payment_request,
      expiryTimestamp: Date.now() + params.expirySeconds * 1000,
      description: params.description
    };
  }

  async verifyPayment(invoiceId: string): Promise<PaymentProof | null> {
    try {
      const invoice = await this.lndCall(`/v1/invoice/${invoiceId}`, 'GET');

      if (!invoice.settled) {
        return null;
      }

      return {
        paymentType: 'LIGHTNING',
        paymentHash: invoice.r_hash,
        preimage: invoice.r_preimage,
        amountSats: parseInt(invoice.value),
        verifiedAt: Date.now()
      };
    } catch (error) {
      console.error('Error verifying Lightning payment:', error);
      return null;
    }
  }

  async releaseFunds(address: string, amountSats: number): Promise<string> {
    const response = await this.lndCall('/v1/channels/transactions', 'POST', {
      addr: address,
      amount: amountSats
    });

    return response.txid;
  }

  async getBalance(): Promise<number> {
    const response = await this.lndCall('/v1/balance/blockchain', 'GET');
    return parseInt(response.confirmed_balance);
  }

  private async lndCall(endpoint: string, method: string, body?: any): Promise<any> {
    const response = await fetch(`${this.lndUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Grpc-Metadata-macaroon': this.macaroon
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Lightning API error: ${response.statusText}`);
    }

    return response.json();
  }
}
