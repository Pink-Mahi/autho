import {
  OperatorNode,
  OperatorAPIServer,
  ManufacturerIssuer,
  ClientVerifier,
  SaleManager,
  MockPaymentAdapter,
  generateKeyPair,
  OperatorConfig,
  QuorumConfig,
  Operator,
  EventType,
  ItemState
} from '../src';

async function runDemo() {
  console.log('=== Bitcoin-Native Product Ownership & Escrow Protocol - Demo ===\n');

  const QUORUM: QuorumConfig = { m: 3, n: 5 };

  console.log('Step 1: Setting up 5 operator nodes...');
  const operators: OperatorNode[] = [];
  const operatorInfos: Operator[] = [];

  for (let i = 0; i < 5; i++) {
    const keyPair = generateKeyPair();
    const config: OperatorConfig = {
      operatorId: `operator-${i + 1}`,
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      btcAddress: keyPair.address,
      port: 3000 + i,
      peers: []
    };

    const node = new OperatorNode(config, QUORUM, `./.operator-data/operator-${i + 1}`);
    await node.initialize();
    operators.push(node);
    operatorInfos.push(node.getOperatorInfo());

    const apiServer = new OperatorAPIServer(node, config.port);
    apiServer.start();
  }

  console.log(`✓ ${operators.length} operators initialized with 3-of-5 quorum\n`);

  console.log('Step 2: Manufacturer registration...');
  const manufacturer = new ManufacturerIssuer('Luxury Watch Co.');
  const mfgKeys = manufacturer.exportKeys();
  console.log(`Manufacturer ID: ${manufacturer.getManufacturerId()}`);
  console.log(`Public Key: ${manufacturer.getPublicKey().substring(0, 20)}...`);
  console.log(`BTC Address: ${manufacturer.getBtcAddress()}\n`);

  const regEvent = manufacturer.createRegistrationEvent(10000);
  regEvent.height = 1;
  regEvent.actorSignature = manufacturer.signEvent(regEvent);
  regEvent.operatorSignatures = [];

  for (let i = 0; i < 3; i++) {
    const sig = await operators[i].signEvent(regEvent as any);
    regEvent.operatorSignatures!.push(sig);
  }

  const fullRegEvent = await operators[0].proposeEvent(regEvent);
  
  for (const op of operators) {
    await op.registerManufacturer(manufacturer.getManufacturer());
  }

  console.log('✓ Manufacturer registered with quorum signatures\n');

  console.log('Step 3: Minting a luxury watch item...');
  const watchMetadata = {
    model: 'Chronograph Elite X1',
    serialNumber: 'LWC-2024-001234',
    description: 'Limited edition luxury chronograph with sapphire crystal',
    imageUri: 'ipfs://QmXxxx...'
  };

  const mintEvent = manufacturer.createMintEvent(watchMetadata, 5000);
  mintEvent.height = 2;
  mintEvent.actorSignature = manufacturer.signEvent(mintEvent);
  mintEvent.operatorSignatures = [];

  for (let i = 0; i < 3; i++) {
    const sig = await operators[i].signEvent(mintEvent as any);
    mintEvent.operatorSignatures!.push(sig);
  }

  const fullMintEvent = await operators[0].proposeEvent(mintEvent);
  
  for (const op of operators) {
    await op.submitEvent(fullMintEvent);
  }

  const itemId = fullMintEvent.itemId;
  console.log(`✓ Item minted: ${itemId}\n`);

  console.log('Step 4: Assigning item to initial owner...');
  const ownerKeys = generateKeyPair();
  const assignEvent = {
    eventType: EventType.ITEM_ASSIGNED,
    itemId,
    height: 3,
    timestamp: Date.now(),
    previousEventHash: fullMintEvent.eventId,
    actorSignature: '',
    ownerWallet: ownerKeys.address,
    ownerSignature: '',
    operatorSignatures: []
  };

  const assignFullEvent = await operators[0].proposeEvent(assignEvent);
  
  for (const op of operators) {
    await op.submitEvent(assignFullEvent);
  }

  console.log(`✓ Item assigned to owner: ${ownerKeys.address}\n`);

  console.log('Step 5: Buyer scans item to verify authenticity...');
  const paymentAdapter = new MockPaymentAdapter();
  const verifier = new ClientVerifier(QUORUM);
  
  const scanResult = await verifier.scanItem(itemId, operatorInfos);
  
  console.log('Scan Result:');
  console.log(`  - Authentic: ${scanResult.isAuthentic ? '✓ YES' : '✗ NO'}`);
  console.log(`  - Manufacturer: ${scanResult.manufacturer.name}`);
  console.log(`  - State: ${scanResult.currentState}`);
  console.log(`  - Can Purchase: ${scanResult.canPurchase ? '✓ YES' : '✗ NO'}`);
  console.log(`  - Anchored: ${scanResult.anchorStatus.isAnchored ? '✓ YES' : '✗ NOT YET'}`);
  if (scanResult.warnings.length > 0) {
    console.log(`  - Warnings: ${scanResult.warnings.join(', ')}`);
  }
  console.log();

  console.log('Step 6: Creating sale offer...');
  const buyerKeys = generateKeyPair();
  const saleManager = new SaleManager(paymentAdapter);
  
  const offer = saleManager.createOffer(
    itemId,
    buyerKeys.address,
    buyerKeys.privateKey,
    50000000,
    3600
  );

  console.log(`✓ Offer created: ${offer.offerId}`);
  console.log(`  - Price: ${offer.priceSats} sats (0.5 BTC)`);
  console.log(`  - Expiry: ${new Date(offer.expiryTimestamp).toISOString()}\n`);

  console.log('Step 7: Seller accepts offer...');
  const acceptance = saleManager.acceptOffer(offer, ownerKeys.address, ownerKeys.privateKey);
  console.log(`✓ Offer accepted by seller\n`);

  console.log('Step 8: Locking item in escrow...');
  const item = await operators[0].getItem(itemId);
  const escrowFeeSats = saleManager.calculateEscrowFee(offer.priceSats);
  
  const lockEvent = await saleManager.createEscrowLock(offer, acceptance, item!, escrowFeeSats);
  const fullLockEvent = await operators[0].proposeEvent(lockEvent);
  
  for (const op of operators) {
    await op.submitEvent(fullLockEvent);
  }

  console.log(`✓ Item locked in escrow`);
  console.log(`  - Escrow Fee: ${escrowFeeSats} sats\n`);

  console.log('Step 9: Buyer pays BTC...');
  const invoice = await saleManager.createPaymentInvoice(offer, escrowFeeSats);
  console.log(`Invoice created: ${invoice.invoiceId}`);
  console.log(`  - Amount: ${invoice.amountSats} sats`);
  console.log(`  - Address: ${invoice.paymentAddress}`);

  paymentAdapter.mockPayInvoice(invoice.invoiceId);
  console.log(`✓ Payment received and verified\n`);

  console.log('Step 10: Settling sale and transferring ownership...');
  const paymentProof = await saleManager.verifyPayment(invoice.invoiceId);
  const settlementFeeSats = saleManager.calculateSettlementFee(offer.priceSats);
  
  const settleEvent = await saleManager.createSettlement(
    offer,
    fullLockEvent as any,
    paymentProof!,
    settlementFeeSats
  );

  const fullSettleEvent = await operators[0].proposeEvent(settleEvent);
  
  for (const op of operators) {
    await op.submitEvent(fullSettleEvent);
  }

  console.log(`✓ Sale settled`);
  console.log(`  - Settlement Fee: ${settlementFeeSats} sats`);
  console.log(`  - New Owner: ${buyerKeys.address}\n`);

  console.log('Step 11: Releasing payment to seller...');
  const txHash = await saleManager.releasePayment(
    ownerKeys.address,
    offer.priceSats,
    settlementFeeSats
  );
  console.log(`✓ Payment released to seller`);
  console.log(`  - TX Hash: ${txHash}\n`);

  console.log('Step 12: Verifying final state...');
  const finalItem = await operators[0].getItem(itemId);
  console.log(`Final Item State:`);
  console.log(`  - State: ${finalItem?.currentState}`);
  console.log(`  - Owner: ${finalItem?.currentOwnerWallet}`);
  console.log(`  - Event Height: ${finalItem?.lastEventHeight}\n`);

  const events = await operators[0].getItemEvents(itemId);
  console.log(`Event History (${events.length} events):`);
  events.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.eventType} (height: ${e.height})`);
  });

  console.log('\n=== Demo Complete ===');
  console.log('The item has been successfully:');
  console.log('  ✓ Minted by verified manufacturer');
  console.log('  ✓ Authenticated via cryptographic scan');
  console.log('  ✓ Sold with BTC payment');
  console.log('  ✓ Ownership transferred atomically');
  console.log('  ✓ All events signed by 3-of-5 operator quorum');
  console.log('\nNo human arbitration. No reversals. Bitcoin-native finality.');
}

runDemo().catch(console.error);
