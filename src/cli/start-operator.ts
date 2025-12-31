#!/usr/bin/env node

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { OperatorNode } from '../operator/node';
import { OperatorAPIServer } from '../operator/api-server';
import { generateKeyPair } from '../crypto';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const program = new Command();

program
  .name('operator')
  .description('Bitcoin-Native Product Ownership Protocol - Operator Node')
  .version('1.0.0');

program
  .command('start')
  .description('Start the operator node')
  .option('-p, --port <port>', 'Port to listen on', process.env.OPERATOR_PORT || '3000')
  .option('-d, --data-dir <dir>', 'Data directory', process.env.OPERATOR_DATA_DIR || './operator-data')
  .option('-i, --id <id>', 'Operator ID', process.env.OPERATOR_ID || 'operator-1')
  .action(async (options) => {
    console.log('🚀 Starting Bitcoin Ownership Protocol Operator Node...\n');

    const dataDir = options.dataDir;
    const port = parseInt(options.port);
    const operatorId = options.id;

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const keysFile = path.join(dataDir, 'operator-keys.json');
    let keys;

    if (fs.existsSync(keysFile)) {
      console.log('📂 Loading existing operator keys...');
      keys = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
    } else {
      console.log('🔑 Generating new operator keys...');
      keys = generateKeyPair();
      fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2));
      console.log('✅ Keys saved to:', keysFile);
      console.log('⚠️  IMPORTANT: Backup your private key securely!\n');
    }

    const config = {
      operatorId,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      btcAddress: keys.address,
      port,
      peers: []
    };

    const quorum = {
      m: parseInt(process.env.QUORUM_M || '3'),
      n: parseInt(process.env.QUORUM_N || '5')
    };

    console.log('📋 Operator Configuration:');
    console.log(`   ID: ${operatorId}`);
    console.log(`   Port: ${port}`);
    console.log(`   BTC Address: ${keys.address}`);
    console.log(`   Quorum: ${quorum.m}-of-${quorum.n}`);
    console.log(`   Data Dir: ${dataDir}\n`);

    const node = new OperatorNode(config, quorum, dataDir);
    await node.initialize();

    const apiServer = new OperatorAPIServer(node, port);
    await apiServer.start();

    console.log('✅ Operator node is running!');
    console.log(`📊 Dashboard: http://localhost:${port}/dashboard`);
    console.log(`🔍 API: http://localhost:${port}/api`);
    console.log(`💰 Earning BTC fees on successful settlements\n`);
    console.log('Press Ctrl+C to stop\n');
  });

program
  .command('generate-keys')
  .description('Generate new operator keys')
  .action(() => {
    console.log('🔑 Generating operator keys...\n');
    
    const keys = generateKeyPair();
    
    console.log('✅ Keys generated successfully!\n');
    console.log('Public Key:');
    console.log(keys.publicKey);
    console.log('\nBTC Address:');
    console.log(keys.address);
    console.log('\n⚠️  PRIVATE KEY (KEEP SECRET!):');
    console.log(keys.privateKey);
    console.log('\n💾 Save these keys securely!');
    
    fs.writeFileSync('operator-public-key.txt', keys.publicKey);
    fs.writeFileSync('operator-address.txt', keys.address);
    fs.writeFileSync('operator-private-key.txt', keys.privateKey);
    
    console.log('\n📁 Keys saved to:');
    console.log('   - operator-public-key.txt');
    console.log('   - operator-address.txt');
    console.log('   - operator-private-key.txt (KEEP SECRET!)');
  });

program
  .command('info')
  .description('Show operator information')
  .option('-d, --data-dir <dir>', 'Data directory', './operator-data')
  .action((options) => {
    const keysFile = path.join(options.dataDir, 'operator-keys.json');
    
    if (!fs.existsSync(keysFile)) {
      console.log('❌ No operator keys found. Run "operator start" first.');
      return;
    }
    
    const keys = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
    
    console.log('📋 Operator Information:\n');
    console.log('Public Key:');
    console.log(keys.publicKey);
    console.log('\nBTC Address:');
    console.log(keys.address);
    console.log('\nData Directory:');
    console.log(options.dataDir);
  });

program.parse();
