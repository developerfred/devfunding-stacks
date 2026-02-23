#!/usr/bin/env node
/**
 * DevFunding Deployment Script
 * 
 * Deploys all three DevFunding smart contracts to testnet or mainnet.
 * 
 * Usage:
 *   npm run deploy           # Deploy to testnet (default)
 *   npm run deploy:mainnet  # Deploy to mainnet
 *   npm run deploy:simnet  # Deploy to local simnet
 * 
 * Environment:
 *   - DEPLOYER_KEY: Private key for deployment (required)
 *   - STACKS_NETWORK: testnet, mainnet, or simnet (default: testnet)
 */

import {
  StacksTestnet,
  StacksMainnet,
  StacksMocknet,
  makeContractDeploy,
  broadcastTransaction,
  waitForTransaction,
  getAddressFromPrivateKey,
  TransactionWorker,
  TransactionWorkerConfig,
} from '@stacks/transactions';
import { Cl } from '@stacks/clarity-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Contract paths
const CONTRACTS = {
  token: 'contracts/token.clar',
  core: 'contracts/core.clar',
  escrow: 'contracts/escrow.clar',
};

// Network configuration
type NetworkName = 'testnet' | 'mainnet' | 'simnet';

interface NetworkConfig {
  network: StacksTestnet | StacksMainnet | StacksMocknet;
  apiUrl: string;
  explorerUrl: string;
}

const NETWORK_CONFIGS: Record<NetworkName, NetworkConfig> = {
  testnet: {
    network: new StacksTestnet(),
    apiUrl: 'https://api.testnet.hiro.so',
    explorerUrl: 'https://explorer.hiro.so/txid',
  },
  mainnet: {
    network: new StacksMainnet(),
    apiUrl: 'https://api.hiro.so',
    explorerUrl: 'https://explorer.hiro.so/txid',
  },
  simnet: {
    network: new StacksMocknet(),
    apiUrl: 'http://localhost:3999',
    explorerUrl: 'http://localhost:8000/txid',
  },
};

// Deployment state
interface DeploymentState {
  network: NetworkName;
  deployerAddress: string;
  contracts: {
    token?: { txid: string; address: string; name: string };
    core?: { txid: string; address: string; name: string };
    escrow?: { txid: string; address: string; name: string };
  };
}

/**
 * Read contract source code
 */
function readContract(contractPath: string): string {
  const fullPath = path.resolve(process.cwd(), contractPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Contract not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

/**
 * Get network configuration
 */
function getNetworkConfig(networkName?: string): NetworkConfig {
  const network = (networkName || process.env.STACKS_NETWORK || 'testnet') as NetworkName;
  const config = NETWORK_CONFIGS[network];
  if (!config) {
    throw new Error(`Unknown network: ${network}. Valid options: testnet, mainnet, simnet`);
  }
  return config;
}

/**
 * Validate deployment prerequisites
 */
function validatePrerequisites(): string {
  const privateKey = process.env.DEPLOYER_KEY;
  if (!privateKey) {
    throw new Error(
      'DEPLOYER_KEY is required. Set it in .env file or environment variable.\n' +
      'Example: DEPLOYER_KEY=your-private-key-here npm run deploy'
    );
  }
  
  // Validate private key format (should be 64 characters hex)
  if (!/^[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error('Invalid DEPLOYER_KEY format. Expected 64-character hex string.');
  }
  
  return getAddressFromPrivateKey(privateKey, getNetworkConfig().network);
}

/**
 * Deploy a single contract
 */
async function deployContract(
  contractName: string,
  contractPath: string,
  privateKey: string,
  networkConfig: NetworkConfig,
  fee?: number
): Promise<{ txid: string; address: string; name: string }> {
  console.log(`\n📦 Deploying ${contractName}...`);
  
  const codeBody = readContract(contractPath);
  
  const tx = await makeContractDeploy({
    contractName,
    codeBody,
    senderKey: privateKey,
    network: networkConfig.network,
    fee: fee || 0, // Let the SDK estimate fee if not provided
  });
  
  console.log(`   Transaction ID: ${tx.txid()}`);
  console.log(`   Fee: ${tx.auth.getFee()} STX`);
  
  // Broadcast transaction
  const broadcastResult = await broadcastTransaction(tx, networkConfig.network);
  console.log(`   Broadcast result: ${broadcastResult.txid}`);
  
  // Wait for confirmation
  console.log(`   Waiting for confirmation...`);
  const receipt = await waitForTransaction(broadcastResult.txid, networkConfig.network);
  
  if (receipt.success) {
    console.log(`   ✅ ${contractName} deployed successfully!`);
    console.log(`   📋 ${networkConfig.explorerUrl}/${broadcastResult.txid}?chain=${process.env.STACKS_NETWORK || 'testnet'}`);
    return {
      txid: broadcastResult.txid,
      address: getAddressFromPrivateKey(privateKey, networkConfig.network),
      name: contractName,
    };
  } else {
    console.error(`   ❌ Deployment failed:`, receipt.error);
    throw new Error(`Failed to deploy ${contractName}: ${receipt.error}`);
  }
}

/**
 * Deploy all contracts in order (token -> core -> escrow)
 */
async function deployAll(networkName?: string): Promise<DeploymentState> {
  console.log('🚀 DevFunding Deployment Script');
  console.log('='.repeat(50));
  
  const networkConfig = getNetworkConfig(networkName);
  const privateKey = process.env.DEPLOYER_KEY!;
  
  // Validate and get deployer address
  console.log(`\n🌐 Network: ${networkName || 'testnet'}`);
  console.log(`🔗 API URL: ${networkConfig.apiUrl}`);
  const deployerAddress = validatePrerequisites();
  console.log(`👤 Deployer: ${deployerAddress}`);
  
  const state: DeploymentState = {
    network: (networkName || 'testnet') as NetworkName,
    deployerAddress,
    contracts: {},
  };
  
  // Check and print STX balance
  try {
    const balance = await networkConfig.network.getAccountBalance(deployerAddress);
    console.log(`💰 Balance: ${Number(balance) / 1000000} STX`);
  } catch (e) {
    console.log('⚠️  Could not fetch balance (may need funds)');
  }
  
  try {
    // Deploy Token first (core depends on it)
    state.contracts.token = await deployContract(
      'devfunding-token',
      CONTRACTS.token,
      privateKey,
      networkConfig
    );
    
    // Deploy Core (no dependencies)
    state.contracts.core = await deployContract(
      'devfunding-core',
      CONTRACTS.core,
      privateKey,
      networkConfig
    );
    
    // Deploy Escrow (no direct dependencies)
    state.contracts.escrow = await deployContract(
      'devfunding-escrow',
      CONTRACTS.escrow,
      privateKey,
      networkConfig
    );
    
    // Save deployment state
    const statePath = path.resolve(process.cwd(), '.deployment-state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log(`\n💾 Deployment state saved to: ${statePath}`);
    
    // Print summary
    printSummary(state, networkConfig);
    
    return state;
  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  }
}

/**
 * Print deployment summary
 */
function printSummary(state: DeploymentState, networkConfig: NetworkConfig): void {
  console.log('\n' + '='.repeat(50));
  console.log('📊 Deployment Summary');
  console.log('='.repeat(50));
  
  for (const [name, contract] of Object.entries(state.contracts)) {
    if (contract) {
      console.log(`\n${name.toUpperCase()}:`);
      console.log(`   Contract: ${contract.address}.${contract.name}`);
      console.log(`   TXID: ${contract.txid}`);
      console.log(`   Explorer: ${networkConfig.explorerUrl}/${contract.txid}?chain=${state.network}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ All contracts deployed successfully!');
  console.log('='.repeat(50));
  
  console.log('\n📝 Next Steps:');
  console.log('1. Verify deployment: npm run verify');
  console.log('2. Initialize contracts (if needed): npm run init');
  console.log('3. Update frontend configuration with contract addresses');
}

/**
 * Show usage information
 */
function showUsage(): void {
  console.log(`
DevFunding Deployment Script

Usage:
  npm run deploy           Deploy to testnet (default)
  npm run deploy:mainnet   Deploy to mainnet
  npm run deploy:simnet    Deploy to local simnet

Environment Variables:
  DEPLOYER_KEY       Private key for deployment (required)
  STACKS_NETWORK     Network to deploy to (testnet, mainnet, simnet)

Example:
  DEPLOYER_KEY=your-private-key npm run deploy

For mainnet deployment, use:
  DEPLOYER_KEY=your-mainnet-private-key npm run deploy:mainnet
  `);
}

// Main execution
const args = process.argv.slice(2);
const networkArg = args[0]?.replace('--network=', '') || process.env.STACKS_NETWORK || 'testnet';

if (args.includes('--help') || args.includes('-h')) {
  showUsage();
} else {
  deployAll(networkArg).catch(console.error);
}

export { deployAll, deployContract, DeploymentState, NetworkConfig };
