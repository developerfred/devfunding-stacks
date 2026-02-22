import { initSimnet } from '@stacks/clarinet-sdk';
import { Cl } from '@stacks/transactions';

// Standard wallet addresses for testing
export const WALLETS = {
  DEPLOYER: 'deployer',
  WALLET_1: 'wallet_1',
  WALLET_2: 'wallet_2',
  WALLET_3: 'wallet_3',
  WALLET_4: 'wallet_4',
  WALLET_5: 'wallet_5',
} as const;

// Standard test amounts (in microSTX)
export const TEST_AMOUNTS = {
  ONE_STX: Cl.uint(1000000),
  TEN_STX: Cl.uint(10000000),
  HUNDRED_STX: Cl.uint(100000000),
  THOUSAND_STX: Cl.uint(1000000000),
} as const;

// Common test durations
export const TEST_DURATIONS = {
  ONE_DAY: Cl.uint(1),
  THIRTY_DAYS: Cl.uint(30),
  NINETY_DAYS: Cl.uint(90),
} as const;

// Initialize a test environment with all contracts deployed
export async function setupTestEnvironment(): Promise<any> {
  const simnet = await initSimnet();
  
  // Deploy all contracts
  simnet.deployContract('devfunding-core', './contracts/core.clar');
  simnet.deployContract('devfunding-token', './contracts/token.clar');
  simnet.deployContract('devfunding-escrow', './contracts/escrow.clar');
  
  return simnet;
}

/**
 * Create a developer profile for testing
 */
export function createDevProfile(
  simnet: Simnet,
  developer: string,
  githubHandle: string = 'testuser',
  portfolioUrl: string = 'https://portfolio.example.com'
) {
  return simnet.callPublicFn(
    'devfunding-core',
    'create-dev-profile',
    [
      Cl.stringUtf8(githubHandle),
      Cl.stringUtf8(portfolioUrl)
    ],
    developer
  );
}

/**
 * Create a grant for testing
 */
export function createGrant(
  simnet: Simnet,
  creator: string,
  amount: any = TEST_AMOUNTS.TEN_STX,
  description: string = 'Test grant description',
  requirements: string = 'Test requirements',
  durationDays: any = TEST_DURATIONS.THIRTY_DAYS,
  referrer: any = Cl.none()
) {
  // Fund the creator if needed
  const balance = simnet.stxBalance(creator);
  if (balance < Cl.tupleGet(amount, 'value')) {
    simnet.mintStx(Cl.tupleGet(amount, 'value') * 2, creator);
  }
  
  return simnet.callPublicFn(
    'devfunding-core',
    'create-grant',
    [
      amount,
      Cl.stringUtf8(description),
      Cl.stringUtf8(requirements),
      durationDays,
      referrer
    ],
    creator
  );
}

/**
 * Apply for a grant
 */
export function applyForGrant(
  simnet: Simnet,
  applicant: string,
  grantId: number
) {
  return simnet.callPublicFn(
    'devfunding-core',
    'apply-for-grant',
    [Cl.uint(grantId)],
    applicant
  );
}

/**
 * Select a developer for a grant
 */
export function selectDeveloper(
  simnet: Simnet,
  grantCreator: string,
  grantId: number,
  developer: string
) {
  return simnet.callPublicFn(
    'devfunding-core',
    'select-developer',
    [Cl.uint(grantId), Cl.principal(developer)],
    grantCreator
  );
}

/**
 * Create an escrow for testing
 */
export function createEscrow(
  simnet: Simnet,
  depositor: string,
  beneficiary: string,
  contextId: number,
  isGrant: boolean = true,
  amount: any = TEST_AMOUNTS.TEN_STX
) {
  // Fund the depositor if needed
  const balance = simnet.stxBalance(depositor);
  if (balance < Cl.tupleGet(amount, 'value')) {
    simnet.mintStx(Cl.tupleGet(amount, 'value') * 2, depositor);
  }
  
  return simnet.callPublicFn(
    'devfunding-escrow',
    'create-escrow',
    [
      Cl.principal(beneficiary),
      Cl.uint(contextId),
      Cl.bool(isGrant),
      amount
    ],
    depositor
  );
}

/**
 * Mint DFT tokens for testing
 */
export function mintDftTokens(
  simnet: Simnet,
  recipient: string,
  amount: any = Cl.uint(1000000)
) {
  return simnet.mintFt('devfunding-token', Cl.tupleGet(amount, 'value'), recipient);
}

/**
 * Advance time by mining empty blocks
 */
export function advanceTime(simnet: Simnet, blocks: number = 100) {
  simnet.mineEmptyBlocks(blocks);
}

/**
 * Get a developer profile from the contract
 */
export function getDevProfile(simnet: Simnet, developer: string) {
  return simnet.callReadOnlyFn(
    'devfunding-core',
    'get-developer-profile',
    [Cl.principal(developer)],
    developer
  );
}

/**
 * Get a grant from the contract
 */
export function getGrant(simnet: Simnet, grantId: number, caller: string = WALLETS.DEPLOYER) {
  return simnet.callReadOnlyFn(
    'devfunding-core',
    'get-grant',
    [Cl.uint(grantId)],
    caller
  );
}

/**
 * Get an escrow from the contract
 */
export function getEscrow(simnet: Simnet, escrowId: number, caller: string = WALLETS.DEPLOYER) {
  return simnet.callReadOnlyFn(
    'devfunding-escrow',
    'get-escrow',
    [Cl.uint(escrowId)],
    caller
  );
}

/**
 * Assert that a result is Ok with expected value
 */
export function expectOk<T>(result: any, expected?: T) {
  expect(result.result).toBeOk();
  if (expected !== undefined) {
    expect(Cl.tupleGet(result.result!, 'value')).toEqual(expected);
  }
}

/**
 * Assert that a result is Err with expected error code
 */
export function expectErr(result: any, errorCode: number) {
  expect(result.result).toBeErr(Cl.uint(errorCode));
}

/**
 * Assert that a result is Some with expected value
 */
export function expectSome<T>(result: any, expected?: T) {
  expect(result.result).toBeSome();
  if (expected !== undefined) {
    expect(result.result).toBeSome(expected);
  }
}

/**
 * Assert that a result is None
 */
export function expectNone(result: any) {
  expect(result.result).toBeNone();
}

/**
 * Helper to extract value from Ok result
 */
export function extractOkValue(result: any): any {
  return Cl.tupleGet(result.result!, 'value');
}

/**
 * Helper to extract value from Some result
 */
export function extractSomeValue(result: any): any {
  return result.result;
}

/**
 * Calculate net amount after fees for testing
 */
export function calculateNetAmount(amount: number, platformFeeBps: number = 250, referralFeeBps: number = 0): number {
  const platformFee = Math.floor((amount * platformFeeBps) / 10000);
  const referralFee = Math.floor((amount * referralFeeBps) / 10000);
  return amount - platformFee - referralFee;
}

/**
 * Sleep utility for async tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}