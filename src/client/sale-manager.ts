import { generateId } from '../crypto';
import { signMessage } from '../crypto';
import { calculateOfferId } from '../core/hashing';
import {
  Offer,
  OfferAcceptance,
  Item,
  ItemState,
  ItemLockedEvent,
  ItemSettledEvent,
  EventType,
  PaymentProof
} from '../types';
import { PaymentAdapter, Invoice } from '../payment/adapter';

export class SaleManager {
  private paymentAdapter: PaymentAdapter;

  constructor(paymentAdapter: PaymentAdapter) {
    this.paymentAdapter = paymentAdapter;
  }

  createOffer(
    itemId: string,
    buyerWallet: string,
    buyerPrivateKey: string,
    priceSats: number,
    expirySeconds: number = 3600
  ): Offer {
    const timestamp = Date.now();
    const offerId = calculateOfferId(itemId, buyerWallet, priceSats, timestamp);
    const expiryTimestamp = timestamp + expirySeconds * 1000;

    const message = `${offerId}:${itemId}:${buyerWallet}:${priceSats}:${expiryTimestamp}`;
    const buyerSignature = signMessage(message, buyerPrivateKey);

    return {
      offerId,
      itemId,
      buyerWallet,
      priceSats,
      expiryTimestamp,
      buyerSignature
    };
  }

  acceptOffer(
    offer: Offer,
    sellerWallet: string,
    sellerPrivateKey: string
  ): OfferAcceptance {
    const message = `${offer.offerId}:${sellerWallet}:accept`;
    const sellerSignature = signMessage(message, sellerPrivateKey);

    return {
      offerId: offer.offerId,
      sellerWallet,
      sellerSignature
    };
  }

  async createEscrowLock(
    offer: Offer,
    acceptance: OfferAcceptance,
    item: Item,
    escrowFeeSats: number
  ): Promise<Partial<ItemLockedEvent>> {
    if (item.currentState !== ItemState.ACTIVE_HELD) {
      throw new Error('Item must be in ACTIVE_HELD state to lock');
    }

    if (item.currentOwnerWallet !== acceptance.sellerWallet) {
      throw new Error('Seller does not own the item');
    }

    if (Date.now() > offer.expiryTimestamp) {
      throw new Error('Offer has expired');
    }

    return {
      eventType: EventType.ITEM_LOCKED,
      itemId: offer.itemId,
      previousEventHash: item.lastEventHash,
      actorSignature: acceptance.sellerSignature,
      offerId: offer.offerId,
      sellerWallet: acceptance.sellerWallet,
      buyerWallet: offer.buyerWallet,
      priceSats: offer.priceSats,
      expiryTimestamp: offer.expiryTimestamp,
      escrowFeeSats
    };
  }

  async createPaymentInvoice(
    offer: Offer,
    escrowFeeSats: number
  ): Promise<Invoice> {
    const totalAmount = offer.priceSats + escrowFeeSats;
    const expirySeconds = Math.floor((offer.expiryTimestamp - Date.now()) / 1000);

    return this.paymentAdapter.createInvoice({
      amountSats: totalAmount,
      description: `Purchase item ${offer.itemId}`,
      expirySeconds: Math.max(expirySeconds, 60)
    });
  }

  async verifyPayment(invoiceId: string): Promise<PaymentProof | null> {
    return this.paymentAdapter.verifyPayment(invoiceId);
  }

  async createSettlement(
    offer: Offer,
    lockEvent: ItemLockedEvent,
    paymentProof: PaymentProof,
    settlementFeeSats: number
  ): Promise<Partial<ItemSettledEvent>> {
    if (!paymentProof) {
      throw new Error('Payment not verified');
    }

    if (paymentProof.amountSats < offer.priceSats) {
      throw new Error('Payment amount insufficient');
    }

    return {
      eventType: EventType.ITEM_SETTLED,
      itemId: offer.itemId,
      previousEventHash: lockEvent.eventId,
      actorSignature: '',
      offerId: offer.offerId,
      buyerWallet: offer.buyerWallet,
      priceSats: offer.priceSats,
      paymentProof,
      settlementFeeSats
    };
  }

  async releasePayment(
    sellerWallet: string,
    priceSats: number,
    settlementFeeSats: number
  ): Promise<string> {
    const sellerAmount = priceSats - settlementFeeSats;
    return this.paymentAdapter.releaseFunds(sellerWallet, sellerAmount);
  }

  calculateEscrowFee(priceSats: number): number {
    const feePercent = 0.01;
    const minFee = 1000;
    return Math.max(Math.floor(priceSats * feePercent), minFee);
  }

  calculateSettlementFee(priceSats: number): number {
    const feePercent = 0.02;
    const minFee = 2000;
    return Math.max(Math.floor(priceSats * feePercent), minFee);
  }

  isOfferExpired(offer: Offer): boolean {
    return Date.now() > offer.expiryTimestamp;
  }

  async distributeFees(
    totalFeeSats: number,
    operatorAddresses: string[],
    protocolTreasuryAddress: string
  ): Promise<void> {
    const operatorShare = Math.floor(totalFeeSats * 0.80);
    const protocolShare = Math.floor(totalFeeSats * 0.15);
    const anchorReserve = Math.floor(totalFeeSats * 0.05);

    const perOperatorShare = Math.floor(operatorShare / operatorAddresses.length);

    for (const address of operatorAddresses) {
      await this.paymentAdapter.releaseFunds(address, perOperatorShare);
    }

    await this.paymentAdapter.releaseFunds(protocolTreasuryAddress, protocolShare);

    console.log(`[SaleManager] Distributed fees: ${totalFeeSats} sats`);
    console.log(`[SaleManager] Operators: ${operatorShare}, Protocol: ${protocolShare}, Anchor: ${anchorReserve}`);
  }
}
