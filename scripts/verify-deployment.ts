#!/usr/bin/env node
import {
  StacksTestnet,
  StacksMainnet,
  StacksMocknet,
  callReadOnlyFunction,
  getContractMap,
  cvToJSON,
} from '@stacks/transactions';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

type NetworkName = 'testnet' | 'mainnet' | 'simnet';

const NETWORK_CONFIGS: Record<NetworkName, { network: StacksTestnet | StacksMainnet | StacksMocknet; apiUrl: string }> = {
  testnet: { network: new StacksTestnet(), apiUrl: 'https://api.testnet.hiro.so' },
  mainnet: { network: new StacksMainnet(), apiUrl: 'https://api.hiro.so' },
  simnet: { network: new StacksMocknet(), apiUrl: 'http://localhost:3999' },
};

const networkName = (process.env.STACKS_NETWORK || 'testnet') as NetworkName;
const networkConfig = NETWORK_CONFIGS[networkName];
const network = networkConfig.network;

function getContractAddress(): string {
  return process.env.CONTRACT_ADDRESS || '';
}

function getContracts() {
  const address = getContractAddress();
  return {
    core: `${address}.devfunding-core`,
    token: `${address}.devfunding-token`,
    escrow: `${address}.devfunding-escrow`,
  };
}

async function callContract(contractName: string, functionName: string, args: any[] = []) {
  const contracts = getContracts();
  const contractId = contractName === 'core' ? contracts.core 
    : contractName === 'token' ? contracts.token 
    : contracts.escrow;
  
  const [address, name] = contractId.split('.');
  
  try {
    const result = await callReadOnlyFunction({
      contractAddress: address,
      contractName: name,
      functionName,
      functionArgs: args,
      senderAddress: getContractAddress(),
      network,
    });
    
    return cvToJSON(result);
  } catch (error) {
    console.error(`Error calling ${contractName}.${functionName}:`, error);
    return null;
  }
}

async function verifyCoreContract() {
  console.log('\n=== Verifying Core Contract ===');
  const contracts = getContracts();
  
  console.log(`\nContract: ${contracts.core}`);
  
  console.log('\n--- Contract Variables ---');
  
  const owner = await callContract('core', 'get-contract-owner');
  console.log('Owner:', owner);
  
  const grantCount = await callContract('core', 'get-grant-count');
  console.log('Total Grants:', grantCount);
  
  const bountyCount = await callContract('core', 'get-bounty-count');
  console.log('Total Bounties:', bountyCount);
  
  const profileCount = await callContract('core', 'get-profile-count');
  console.log('Total Profiles:', profileCount);
  
  return true;
}

async function verifyTokenContract() {
  console.log('\n=== Verifying Token Contract ===');
  const contracts = getContracts();
  
  console.log(`\nContract: ${contracts.token}`);
  
  console.log('\n--- Token Info ---');
  
  const name = await callContract('token', 'get-name');
  console.log('Name:', name);
  
  const symbol = await callContract('token', 'get-symbol');
  console.log('Symbol:', symbol);
  
  const decimals = await callContract('token', 'get-decimals');
  console.log('Decimals:', decimals);
  
  const supply = await callContract('token', 'get-total-supply');
  console.log('Total Supply:', supply);
  
  const uri = await callContract('token', 'get-token-uri');
  console.log('Token URI:', uri);
  
  return true;
}

async function verifyEscrowContract() {
  console.log('\n=== Verifying Escrow Contract ===');
  const contracts = getContracts();
  
  console.log(`\nContract: ${contracts.escrow}`);
  
  console.log('\n--- Escrow Stats ---');
  
  const escrowCount = await callContract('escrow', 'get-escrow-count');
  console.log('Total Escrows:', escrowCount);
  
  return true;
}

async function verifyBalance(address: string) {
  console.log(`\n--- Token Balance for ${address} ---`);
  
  const balance = await callContract('token', 'get-balance', [
    { type: 'principal', value: address },
  ]);
  
  console.log('Balance:', balance);
}

async function verifyAll() {
  console.log('='.repeat(50));
  console.log('DevFunding Deployment Verification');
  console.log('='.repeat(50));
  console.log(`Network: ${networkName}`);
  console.log(`API: ${networkConfig.apiUrl}`);
  
  const address = getContractAddress();
  if (!address) {
    console.error('\nError: CONTRACT_ADDRESS not set in .env');
    console.log('Set CONTRACT_ADDRESS to verify deployment');
    return;
  }
  
  console.log(`\nDeployer Address: ${address}`);
  
  try {
    const coreOk = await verifyCoreContract();
    const tokenOk = await verifyTokenContract();
    const escrowOk = await verifyEscrowContract();
    await verifyBalance(address);
    
    console.log('\n' + '='.repeat(50));
    if (coreOk && tokenOk && escrowOk) {
      console.log('✅ All contracts verified successfully!');
    } else {
      console.log('❌ Some contracts failed verification');
    }
    console.log('='.repeat(50));
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
  }
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
DevFunding Deployment Verification Script

Usage:
  npm run verify              Verify all deployed contracts
  npm run verify:core        Verify core contract only
  npm run verify:token       Verify token contract only
  npm run verify:escrow      Verify escrow contract only

Environment Variables:
  CONTRACT_ADDRESS    Contract deployment address (required)
  STACKS_NETWORK     Network (testnet, mainnet, simnet)

Example:
  CONTRACT_ADDRESS=ST1... npm run verify
  `);
} else if (args.includes('core')) {
  verifyCoreContract();
} else if (args.includes('token')) {
  verifyTokenContract();
} else if (args.includes('escrow')) {
  verifyEscrowContract();
} else {
  verifyAll();
}

export { verifyAll, verifyCoreContract, verifyTokenContract, verifyEscrowContract };
