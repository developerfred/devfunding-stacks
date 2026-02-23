import {
  StacksTestnet,
  StacksMainnet,
  makeContractCall,
  makeContractDeploy,
  broadcastTransaction,
  waitForTransaction,
  getAddressFromPrivateKey,
  uint,
  stringUtf8,
  list,
  none,
  some,
} from '@stacks/transactions';
import * as dotenv from 'dotenv';

dotenv.config();

const NETWORK = new StacksTestnet();
const PRIVATE_KEY = process.env.DEPLOYER_KEY || process.env.DEVELOPER_KEY || '';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';

if (!PRIVATE_KEY) {
  console.error('Error: DEPLOYER_KEY or DEVELOPER_KEY not set in .env');
  process.exit(1);
}

const senderAddress = getAddressFromPrivateKey(PRIVATE_KEY, NETWORK);

interface ContractAddresses {
  core: string;
  token: string;
  escrow: string;
}

function getContractAddresses(): ContractAddresses {
  const address = CONTRACT_ADDRESS || senderAddress;
  return {
    core: `${address}.devfunding-core`,
    token: `${address}.devfunding-token`,
    escrow: `${address}.devfunding-escrow`,
  };
}

async function createDeveloperProfile() {
  console.log('\n=== Creating Developer Profile ===');
  
  const contracts = getContractAddresses();
  
  const tx = await makeContractCall({
    contractAddress: contracts.core.split('.')[0],
    contractName: 'devfunding-core',
    functionName: 'create-profile',
    functionArgs: [
      stringUtf8('Alice Developer'),
      stringUtf8('Full-stack developer with expertise in TypeScript and Clarity'),
      stringUtf8('San Francisco, CA'),
      stringUtf8('https://github.com/alice'),
      stringUtf8('https://alice.dev'),
      list([
        stringUtf8('TypeScript'),
        stringUtf8('React'),
        stringUtf8('Clarity'),
      ]),
    ],
    senderKey: PRIVATE_KEY,
    network: NETWORK,
  });
  
  const result = await broadcastTransaction(tx, NETWORK);
  console.log('Transaction ID:', result.txid);
  
  const receipt = await waitForTransaction(result.txid, NETWORK);
  console.log('Success:', receipt.success);
  
  return receipt;
}

async function createGrant() {
  console.log('\n=== Creating Grant ===');
  
  const contracts = getContractAddresses();
  
  const tx = await makeContractCall({
    contractAddress: contracts.core.split('.')[0],
    contractName: 'devfunding-core',
    functionName: 'create-grant',
    functionArgs: [
      uint(5000000),  // 5 STX in microSTX
      stringUtf8('Build a decentralized identity system'),
      stringUtf8('Create DID management with credential verification'),
      uint(60),       // 60 days
      none(),         // No referrer
    ],
    senderKey: PRIVATE_KEY,
    network: NETWORK,
  });
  
  const result = await broadcastTransaction(tx, NETWORK);
  console.log('Transaction ID:', result.txid);
  
  const receipt = await waitForTransaction(result.txid, NETWORK);
  console.log('Success:', receipt.success);
  
  return receipt;
}

async function createBounty() {
  console.log('\n=== Creating Bounty ===');
  
  const contracts = getContractAddresses();
  
  const tx = await makeContractCall({
    contractAddress: contracts.core.split('.')[0],
    contractName: 'devfunding-core',
    functionName: 'create-bounty',
    functionArgs: [
      uint(1000000),  // 1 STX
      stringUtf8('Fix authentication bug'),
      stringUtf8('Resolve token refresh issue in login flow'),
      uint(7),        // 7 days deadline
    ],
    senderKey: PRIVATE_KEY,
    network: NETWORK,
  });
  
  const result = await broadcastTransaction(tx, NETWORK);
  console.log('Transaction ID:', result.txid);
  
  const receipt = await waitForTransaction(result.txid, NETWORK);
  console.log('Success:', receipt.success);
  
  return receipt;
}

async function applyForGrant(grantId: uint) {
  console.log('\n=== Applying for Grant ===');
  
  const contracts = getContractAddresses();
  
  const tx = await makeContractCall({
    contractAddress: contracts.core.split('.')[0],
    contractName: 'devfunding-core',
    functionName: 'apply-grant',
    functionArgs: [
      grantId,
      stringUtf8('I have experience building identity systems'),
      stringUtf8('https://github.com/alice/identity-project'),
    ],
    senderKey: PRIVATE_KEY,
    network: NETWORK,
  });
  
  const result = await broadcastTransaction(tx, NETWORK);
  console.log('Transaction ID:', result.txid);
  
  const receipt = await waitForTransaction(result.txid, NETWORK);
  console.log('Success:', receipt.success);
  
  return receipt;
}

async function purchasePremium() {
  console.log('\n=== Purchasing Premium ===');
  
  const contracts = getContractAddresses();
  
  const tx = await makeContractCall({
    contractAddress: contracts.core.split('.')[0],
    contractName: 'devfunding-core',
    functionName: 'purchase-premium',
    functionArgs: [
      uint(30),  // 30 days
    ],
    senderKey: PRIVATE_KEY,
    network: NETWORK,
  });
  
  const result = await broadcastTransaction(tx, NETWORK);
  console.log('Transaction ID:', result.txid);
  
  const receipt = await waitForTransaction(result.txid, NETWORK);
  console.log('Success:', receipt.success);
  
  return receipt;
}

async function transferTokens(recipient: string, amount: uint) {
  console.log('\n=== Transferring Tokens ===');
  
  const contracts = getContractAddresses();
  
  const tx = await makeContractCall({
    contractAddress: contracts.token.split('.')[0],
    contractName: 'devfunding-token',
    functionName: 'transfer',
    functionArgs: [
      amount,
      { type: 'principal', value: senderAddress } as any,
      { type: 'principal', value: recipient } as any,
      none(),
    ],
    senderKey: PRIVATE_KEY,
    network: NETWORK,
  });
  
  const result = await broadcastTransaction(tx, NETWORK);
  console.log('Transaction ID:', result.txid);
  
  const receipt = await waitForTransaction(result.txid, NETWORK);
  console.log('Success:', receipt.success);
  
  return receipt;
}

async function mintTokens(amount: uint) {
  console.log('\n=== Minting Tokens ===');
  
  const contracts = getContractAddresses();
  
  const tx = await makeContractCall({
    contractAddress: contracts.token.split('.')[0],
    contractName: 'devfunding-token',
    functionName: 'mint',
    functionArgs: [
      amount,
      { type: 'principal', value: senderAddress } as any,
    ],
    senderKey: PRIVATE_KEY,
    network: NETWORK,
  });
  
  const result = await broadcastTransaction(tx, NETWORK);
  console.log('Transaction ID:', result.txid);
  
  const receipt = await waitForTransaction(result.txid, NETWORK);
  console.log('Success:', receipt.success);
  
  return receipt;
}

async function createEscrow(beneficiary: string, amount: uint, contextId: uint) {
  console.log('\n=== Creating Escrow ===');
  
  const contracts = getContractAddresses();
  
  const tx = await makeContractCall({
    contractAddress: contracts.escrow.split('.')[0],
    contractName: 'devfunding-escrow',
    functionName: 'create-escrow',
    functionArgs: [
      { type: 'principal', value: beneficiary } as any,
      amount,
      contextId,
      uint(1),  // context-type: grant
    ],
    senderKey: PRIVATE_KEY,
    network: NETWORK,
  });
  
  const result = await broadcastTransaction(tx, NETWORK);
  console.log('Transaction ID:', result.txid);
  
  const receipt = await waitForTransaction(result.txid, NETWORK);
  console.log('Success:', receipt.success);
  
  return receipt;
}

async function releaseEscrow(escrowId: uint) {
  console.log('\n=== Releasing Escrow ===');
  
  const contracts = getContractAddresses();
  
  const tx = await makeContractCall({
    contractAddress: contracts.escrow.split('.')[0],
    contractName: 'devfunding-escrow',
    functionName: 'release-escrow',
    functionArgs: [escrowId],
    senderKey: PRIVATE_KEY,
    network: NETWORK,
  });
  
  const result = await broadcastTransaction(tx, NETWORK);
  console.log('Transaction ID:', result.txid);
  
  const receipt = await waitForTransaction(result.txid, NETWORK);
  console.log('Success:', receipt.success);
  
  return receipt;
}

async function runAllExamples() {
  console.log('DevFunding Interaction Examples');
  console.log('='.repeat(40));
  console.log('Sender Address:', senderAddress);
  console.log('Network: testnet');
  
  try {
    await createDeveloperProfile();
    await createGrant();
    await createBounty();
    await applyForGrant(uint(1));
    await purchasePremium();
    await mintTokens(uint(1000000));
    await transferTokens('ST2JHG361ZXJR51BH9E5F5K5P4WDJGYK6VQ8J8GZQ', uint(100000));
    await createEscrow('ST2JHG361ZXJR51BH9E5F5K5P4WDJGYK6VQ8J8GZQ', uint(1000000), uint(1));
    await releaseEscrow(uint(1));
    
    console.log('\n' + '='.repeat(40));
    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

const args = process.argv.slice(2);
const command = args[0] || 'all';

switch (command) {
  case 'profile':
    createDeveloperProfile();
    break;
  case 'grant':
    createGrant();
    break;
  case 'bounty':
    createBounty();
    break;
  case 'apply':
    applyForGrant(uint(args[1] || 1));
    break;
  case 'premium':
    purchasePremium();
    break;
  case 'mint':
    mintTokens(uint(args[1] || 1000000));
    break;
  case 'transfer':
    transferTokens(args[1] || 'ST2JHG361ZXJR51BH9E5F5K5P4WDJGYK6VQ8J8GZQ', uint(args[2] || 100000));
    break;
  case 'escrow':
    createEscrow(args[1] || 'ST2JHG361ZXJR51BH9E5F5K5P4WDJGYK6VQ8J8GZQ', uint(args[2] || 1000000), uint(args[3] || 1));
    break;
  case 'release':
    releaseEscrow(uint(args[1] || 1));
    break;
  case 'all':
  default:
    runAllExamples();
}

export {
  createDeveloperProfile,
  createGrant,
  createBounty,
  applyForGrant,
  purchasePremium,
  transferTokens,
  mintTokens,
  createEscrow,
  releaseEscrow,
};
