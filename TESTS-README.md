# DevFunding Test Suite

This directory contains comprehensive test suites for the DevFunding smart contracts.

## Test Structure

### Contract Tests

- **`tests/contracts/core.test.ts`** - Tests for the main DevFunding Core contract
- **`tests/contracts/token.test.ts`** - Tests for the DevFunding Token (SIP-010) contract
- **`tests/contracts/escrow.test.ts`** - Tests for the Escrow contract

### Test Utilities

- **`tests/test-helpers.ts`** - Shared test utilities and helper functions

## Running Tests

### Available Scripts

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage

# Run detailed report with costs
npm run test:report

# Run specific contract tests
npm run test:core      # Core contract only
npm run test:token     # Token contract only
npm run test:escrow    # Escrow contract only
npm run test:all       # All contract tests
```

### Test Environment

Tests use the Clarinet SDK with Simnet environment to simulate Stacks blockchain behavior without requiring actual network connections.

## Test Coverage

### Core Contract Tests

- Developer profile creation and management
- Grant lifecycle (creation, application, selection, claiming)
- Premium feature subscriptions
- Governance (proposals and voting)
- Bounty system
- Dispute resolution
- Error conditions and edge cases

### Token Contract Tests

- SIP-010 compliance verification
- Token transfers with and without memos
- Minting and burning operations
- Token metadata (name, symbol, decimals, URI)
- Admin functions
- Error handling

### Escrow Contract Tests

- Escrow creation for grants and bounties
- Fund release to beneficiaries
- Refunds after lock periods
- Dispute initiation and resolution
- State validation
- Time-based operations

## Writing New Tests

### Using Test Helpers

Import helper functions from `test-helpers.ts`:

```typescript
import { WALLETS, TEST_AMOUNTS, createDevProfile, createGrant } from '../test-helpers';

describe('My Test Suite', () => {
  it('should use helper functions', () => {
    const simnet = setupTestEnvironment();

    // Create a developer profile
    createDevProfile(simnet, WALLETS.WALLET_1, 'githubuser', 'https://example.com');

    // Create a grant
    const result = createGrant(
      simnet,
      WALLETS.WALLET_1,
      TEST_AMOUNTS.TEN_STX,
      'Test grant',
      'Requirements',
      TEST_DURATIONS.THIRTY_DAYS
    );

    expectOk(result, Cl.uint(0));
  });
});
```

### Best Practices

1. **Use standardized wallet addresses** from `WALLETS` constant
2. **Use standardized test amounts** from `TEST_AMOUNTS` constant
3. **Follow Arrange-Act-Assert pattern** for test structure
4. **Test both success and failure cases**
5. **Include edge cases** (zero values, maximum limits, etc.)
6. **Document test purpose** with descriptive `it()` statements

## Test Output

Tests generate detailed output including:

- Pass/fail status for each test
- Error messages with contract error codes
- Coverage reports (when enabled)
- Transaction costs (when using `--costs` flag)

## Continuous Integration

The test suite is designed to run in CI environments:

- No external dependencies required
- Deterministic test execution
- Fast execution time
- Comprehensive coverage reporting
