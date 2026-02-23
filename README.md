# DevFunding - Decentralized Developer Funding Platform

## Overview

DevFunding is a decentralized platform built on the Stacks blockchain that enables funding for developer grants, bounties, and open-source projects. The platform provides transparent, trust-minimized mechanisms for developers to showcase their skills, apply for funding, and receive payments through smart contracts.

## Architecture

### Smart Contracts

- **Core Contract** (`contracts/core.clar`): Main platform logic for developer profiles, grants, bounties, and referrals
- **Token Contract** (`contracts/token.clar`): DFT (DevFunding Token) - SIP-010 compliant fungible token
- **Escrow Contract** (`contracts/escrow.clar`): Secure fund holding and dispute resolution system

### Technology Stack

- **Blockchain**: Stacks (Bitcoin layer for smart contracts)
- **Smart Contract Language**: Clarity
- **Testing**: Vitest + Clarinet SDK
- **CI/CD**: GitHub Actions
- **Development Tools**: Clarinet, TypeScript

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Git
- Clarinet (for local development)

### Installation

```bash
# Clone repository
git clone https://github.com/developerfred/devfunding-stacks.git
cd devfunding-stacks

# Install dependencies
npm install

# Run tests
npm test
```

### Development Setup

1. Install Clarinet (if not already installed):
   ```bash
   npm install -g clarinet
   ```

2. Check contracts:
   ```bash
   npx clarinet check
   ```

3. Run specific test suites:
   ```bash
   npm run test:core    # Test Core contract
   npm run test:token   # Test Token contract  
   npm run test:escrow  # Test Escrow contract
   ```

## Smart Contracts

### Core Contract (`core.clar`)

The main platform contract handles:
- **Developer Profiles**: Create and update developer profiles with skills and portfolio
- **Grants**: Create, apply for, and manage developer grants
- **Bounties**: Post and complete development bounties
- **Referrals**: Referral system with reward mechanisms
- **Dispute Resolution**: Platform-mediated dispute handling

#### Key Functions

- `create-profile`: Register as a developer
- `create-grant`: Create a new funding grant
- `apply-grant`: Apply for an existing grant
- `claim-grant`: Claim completed grant funds
- `create-bounty`: Post a development bounty
- `submit-bounty`: Submit bounty completion

### Token Contract (`token.clar`)

SIP-010 compliant fungible token (DFT) with:
- Standard token transfers
- Minting and burning capabilities
- Metadata support (name, symbol, decimals, URI)

#### Key Functions
- `transfer`: Transfer tokens between accounts
- `mint`: Mint new tokens (owner only)
- `burn`: Burn tokens from holder balance
- `get-token-uri`: Get token metadata URI

### Escrow Contract (`escrow.clar`)

Secure escrow system for:
- **Grant/Bounty Funds**: Hold funds securely until completion
- **Dispute Handling**: Platform-mediated dispute resolution
- **Timed Releases**: Automatic release after lock period
- **Refund Mechanisms**: Secure refund pathways

#### Key Functions
- `create-escrow`: Create a new escrow
- `release-escrow`: Release funds to beneficiary
- `refund-escrow`: Refund to depositor
- `raise-dispute`: Raise a dispute on escrow

## Testing

The project uses Vitest with Clarinet SDK for testing:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with coverage and cost reports
npm run test:report

# Watch mode
npm run test:watch
```

## Code Quality

### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Auto-fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Pre-commit checks
npm run pre-commit
```

### Type Checking

```bash
npx tsc --noEmit
```

## CI/CD Pipeline

GitHub Actions workflows provide:

- **Test Job**: Runs all test suites with coverage
- **Lint Job**: ESLint, Prettier, and TypeScript checks
- **Clarity Job**: Validates Clarity contracts and costs
- **Security Audit**: npm audit and Snyk vulnerability scanning

## Deployment

### Testnet Deployment

1. Ensure you have testnet STX for deployment fees
2. Update `deployments/default.simnet-plan.yaml` with your configuration
3. Deploy using Clarinet:

```bash
# Generate deployment plan
npx clarinet generate deployment-plan

# Deploy to testnet
npx clarinet deploy --network testnet
```

### Mainnet Considerations

Before mainnet deployment:
- Complete security audits
- Test thoroughly on testnet
- Verify all contract interactions
- Establish upgrade/migration paths

## Security

### Audit Status

The contracts have undergone security audits with findings documented in Portuguese comments within the contract files. Key audit findings addressed:

- **Access Control**: Proper authorization checks
- **Input Validation**: Comprehensive parameter validation
- **Fund Safety**: Secure escrow and transfer mechanisms
- **Error Handling**: Proper error codes and revert conditions

### Security Best Practices

- Never store sensitive data on-chain
- Use time locks for critical operations
- Implement proper access controls
- Regular security reviews and updates

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`npm run pre-commit`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Pull Request Requirements

- All tests must pass
- Code must pass linting and formatting checks
- Include appropriate test coverage
- Update documentation as needed
- Follow existing code patterns

### Code Style

- Use TypeScript for test files
- Follow ESLint configuration rules
- Use Prettier formatting
- Add comments for complex logic
- Use meaningful variable and function names

## API Documentation

### Core Contract API

#### Developer Profiles

```clarity
;; Create or update developer profile
(define-public (create-profile
  (name          (string-utf8 100))
  (bio           (string-utf8 500))
  (location      (string-utf8 100))
  (github-url    (string-utf8 200))
  (portfolio-url (string-utf8 200))
  (skills-list   (list 10 (string-utf8 50)))
))
```

#### Grants

```clarity
;; Create a new grant
(define-public (create-grant
  (amount        uint)
  (description   (string-utf8 1000))
  (requirements  (string-utf8 1000))
  (duration-days uint)
  (referrer      (optional principal))
))
```

### Token Contract API

Standard SIP-010 interface:

```clarity
;; Transfer tokens
(define-public (transfer
  (amount uint)
  (sender principal)
  (recipient principal)
  (memo (optional (buff 34)))
))
```

### Escrow Contract API

```clarity
;; Create escrow
(define-public (create-escrow
  (beneficiary principal)
  (amount      uint)
  (context-id  uint)
  (context-type uint)
))
```

## Error Codes

### Core Contract Errors
- `ERR-PROFILE-NOT-FOUND` (1000): Developer profile does not exist
- `ERR-GRANT-NOT-FOUND` (1001): Grant does not exist
- `ERR-INSUFFICIENT-AMOUNT` (1002): Insufficient funding amount
- `ERR-GRANT-EXPIRED` (1003): Grant deadline has passed
- `ERR-NOT-AUTHORIZED` (1004): Caller not authorized for operation

### Token Contract Errors
- `ERR-INSUFFICIENT-BALANCE` (2000): Insufficient token balance
- `ERR-NOT-TOKEN-OWNER` (2001): Caller is not token owner
- `ERR-ZERO-AMOUNT` (2002): Cannot transfer zero amount

### Escrow Contract Errors
- `ERR-ESCROW-NOT-FOUND` (3000): Escrow does not exist
- `ERR-LOCK-ACTIVE` (3001): Escrow lock period still active
- `ERR-ALREADY-RELEASED` (3002): Escrow already released
- `ERR-IS-DISPUTED` (3003): Escrow is in dispute

## Examples

### Creating a Developer Profile

```typescript
// Example TypeScript interaction
const tx = await makeContractCall({
  contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  contractName: 'devfunding-core',
  functionName: 'create-profile',
  functionArgs: [
    stringUtf8('John Doe'),
    stringUtf8('Full-stack developer with 5 years experience'),
    stringUtf8('San Francisco, CA'),
    stringUtf8('https://github.com/johndoe'),
    stringUtf8('https://portfolio.johndoe.dev'),
    list([stringUtf8('JavaScript'), stringUtf8('TypeScript'), stringUtf8('React')])
  ],
  senderKey: 'your-private-key',
  network: new StacksTestnet()
});
```

### Creating a Grant

```typescript
const tx = await makeContractCall({
  contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  contractName: 'devfunding-core',
  functionName: 'create-grant',
  functionArgs: [
    uint(1000000), // 1,000,000 uSTX = 1 STX
    stringUtf8('Build authentication system'),
    stringUtf8('Implement JWT-based auth with refresh tokens'),
    uint(30), // 30 days
    none() // No referrer
  ],
  senderKey: 'your-private-key',
  network: new StacksTestnet()
});
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/developerfred/devfunding-stacks/issues)
- Documentation: This README and code comments
- Community: Stacks Discord and Forum

## Acknowledgements

- Stacks blockchain ecosystem
- Hiro team for Clarinet and development tools
- Security auditors for thorough contract review
- Open source contributors

---

**Status**: Active Development  
**Version**: 1.0.0  
**Last Updated**: February 2026