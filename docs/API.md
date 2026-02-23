# DevFunding API Documentation

## Overview

This document provides detailed API documentation for the DevFunding smart contracts. All contracts are written in Clarity and deployed on the Stacks blockchain.

## Core Contract (`devfunding-core`)

Contract Address: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.devfunding-core`

### Developer Profiles

#### `create-profile`

Creates or updates a developer profile.

**Signature:**
```clarity
(define-public (create-profile
  (name          (string-utf8 100))
  (bio           (string-utf8 500))
  (location      (string-utf8 100))
  (github-url    (string-utf8 200))
  (portfolio-url (string-utf8 200))
  (skills-list   (list 10 (string-utf8 50)))
))
```

**Parameters:**
- `name`: Developer name (max 100 UTF-8 chars)
- `bio`: Short biography (max 500 UTF-8 chars)
- `location`: Geographic location (max 100 UTF-8 chars)
- `github-url`: GitHub profile URL (max 200 UTF-8 chars)
- `portfolio-url`: Portfolio website URL (max 200 UTF-8 chars)
- `skills-list`: List of skills (max 10 items, 50 chars each)

**Returns:** `(response bool uint)` - `(ok true)` on success

**Errors:**
- `ERR-PROFILE-EXISTS` (1005): Profile already exists (only for initial creation)

#### `update-profile`

Updates an existing developer profile.

**Signature:**
```clarity
(define-public (update-profile
  (name          (string-utf8 100))
  (bio           (string-utf8 500))
  (location      (string-utf8 100))
  (github-url    (string-utf8 200))
  (portfolio-url (string-utf8 200))
))
```

**Returns:** `(response bool uint)`

**Errors:**
- `ERR-PROFILE-NOT-FOUND` (1000): Profile does not exist

#### `add-skill`

Adds a skill to developer profile.

**Signature:**
```clarity
(define-public (add-skill
  (skill (string-utf8 50))
))
```

**Returns:** `(response bool uint)`

**Errors:**
- `ERR-PROFILE-NOT-FOUND` (1000)
- `ERR-SKILLS-LIMIT` (1006): Maximum 10 skills reached

#### `register-referral`

Registers a referral relationship between developers.

**Signature:**
```clarity
(define-public (register-referral
  (referrer principal)
))
```

**Parameters:**
- `referrer`: Principal address of referring developer

**Returns:** `(response bool uint)`

**Errors:**
- `ERR-PROFILE-NOT-FOUND` (1000): Referrer or referee profile not found
- `ERR-SELF-REFERRAL` (1007): Cannot refer yourself

### Grants

#### `create-grant`

Creates a new funding grant.

**Signature:**
```clarity
(define-public (create-grant
  (amount        uint)
  (description   (string-utf8 1000))
  (requirements  (string-utf8 1000))
  (duration-days uint)
  (referrer      (optional principal))
))
```

**Parameters:**
- `amount`: Grant amount in microSTX (uSTX)
- `description`: Grant description (max 1000 UTF-8 chars)
- `requirements`: Developer requirements (max 1000 UTF-8 chars)
- `duration-days`: Duration in days
- `referrer`: Optional referrer principal address

**Returns:** `(response uint uint)` - `(ok grant-id)` on success

**Errors:**
- `ERR-INSUFFICIENT-AMOUNT` (1002): Amount too low (minimum 100,000 uSTX)
- `ERR-INSUFFICIENT-FEE` (1008): Insufficient fee payment

#### `apply-grant`

Applies for an existing grant.

**Signature:**
```clarity
(define-public (apply-grant
  (grant-id uint)
  (proposal (string-utf8 2000))
))
```

**Parameters:**
- `grant-id`: Grant identifier
- `proposal`: Application proposal (max 2000 UTF-8 chars)

**Returns:** `(response uint uint)` - `(ok application-id)` on success

**Errors:**
- `ERR-GRANT-NOT-FOUND` (1001)
- `ERR-GRANT-EXPIRED` (1003)
- `ERR-PROFILE-NOT-FOUND` (1000)
- `ERR-ALREADY-APPLIED` (1009): Already applied for this grant

#### `claim-grant`

Claims completed grant funds.

**Signature:**
```clarity
(define-public (claim-grant
  (grant-id uint)
))
```

**Returns:** `(response bool uint)` - `(ok true)` on successful claim

**Errors:**
- `ERR-GRANT-NOT-FOUND` (1001)
- `ERR-GRANT-NOT-COMPLETED` (1010): Grant not in completed state
- `ERR-NOT-GRANTEE` (1011): Caller is not grant recipient

#### `cancel-grant`

Cancels a grant and refunds creator.

**Signature:**
```clarity
(define-public (cancel-grant
  (grant-id uint)
))
```

**Returns:** `(response bool uint)`

**Errors:**
- `ERR-GRANT-NOT-FOUND` (1001)
- `ERR-NOT-GRANT-CREATOR` (1012): Caller is not grant creator
- `ERR-GRANT-ACTIVE` (1013): Grant has active applications

### Bounties

#### `create-bounty`

Creates a development bounty.

**Signature:**
```clarity
(define-public (create-bounty
  (amount       uint)
  (title        (string-utf8 200))
  (description  (string-utf8 2000))
  (requirements (string-utf8 1000))
))
```

**Returns:** `(response uint uint)` - `(ok bounty-id)` on success

#### `submit-bounty`

Submits bounty completion.

**Signature:**
```clarity
(define-public (submit-bounty
  (bounty-id uint)
  (proof     (string-utf8 1000))
))
```

**Returns:** `(response bool uint)`

### Dispute Resolution

#### `raise-dispute`

Raises a dispute on a grant or bounty.

**Signature:**
```clarity
(define-public (raise-dispute
  (context-id   uint)
  (context-type uint)
  (reason       (string-utf8 1000))
))
```

**Parameters:**
- `context-id`: Grant or bounty ID
- `context-type`: 0 for grant, 1 for bounty
- `reason`: Dispute reason (max 1000 UTF-8 chars)

**Returns:** `(response uint uint)` - `(ok dispute-id)` on success

#### `resolve-dispute`

Resolves a dispute (admin only).

**Signature:**
```clarity
(define-public (resolve-dispute
  (dispute-id uint)
  (decision   bool)
  (reason     (string-utf8 1000))
))
```

**Parameters:**
- `decision`: `true` for beneficiary, `false` for depositor
- `reason`: Resolution reason

**Returns:** `(response bool uint)`

### Read-only Functions

#### `get-profile`

```clarity
(define-read-only (get-profile
  (developer principal)
))
```

Returns developer profile tuple.

#### `get-grant`

```clarity
(define-read-only (get-grant
  (grant-id uint)
))
```

Returns grant details tuple.

#### `get-bounty`

```clarity
(define-read-only (get-bounty
  (bounty-id uint)
))
```

Returns bounty details tuple.

## Token Contract (`devfunding-token`)

Contract Address: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.devfunding-token`

Standard SIP-010 fungible token interface.

### Core Functions

#### `transfer`

Transfers tokens between accounts.

**Signature:**
```clarity
(define-public (transfer
  (amount    uint)
  (sender    principal)
  (recipient principal)
  (memo      (optional (buff 34)))
))
```

**Errors:**
- `ERR-INSUFFICIENT-BALANCE` (2000)
- `ERR-ZERO-AMOUNT` (2002)

#### `mint`

Mints new tokens (owner only).

**Signature:**
```clarity
(define-public (mint
  (amount uint)
  (recipient principal)
))
```

**Errors:**
- `ERR-NOT-TOKEN-OWNER` (2001)
- `ERR-MAX-SUPPLY` (2003): Exceeds maximum supply

#### `burn`

Burns tokens from caller's balance.

**Signature:**
```clarity
(define-public (burn
  (amount uint)
))
```

### SIP-010 Compliance

#### `get-name`

```clarity
(define-read-only (get-name))
```

Returns token name: `"DevFunding Token"`

#### `get-symbol`

```clarity
(define-read-only (get-symbol))
```

Returns token symbol: `"DFT"`

#### `get-decimals`

```clarity
(define-read-only (get-decimals))
```

Returns decimals: `6`

#### `get-balance`

```clarity
(define-read-only (get-balance
  (account principal)
))
```

Returns account balance.

#### `get-total-supply`

```clarity
(define-read-only (get-total-supply))
```

Returns total token supply.

#### `get-token-uri`

```clarity
(define-read-only (get-token-uri))
```

Returns token metadata URI.

### Admin Functions

#### `set-token-uri`

Updates token metadata URI (owner only).

**Signature:**
```clarity
(define-public (set-token-uri
  (new-uri (string-utf8 200))
))
```

## Escrow Contract (`devfunding-escrow`)

Contract Address: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.devfunding-escrow`

### Core Functions

#### `create-escrow`

Creates a new escrow.

**Signature:**
```clarity
(define-public (create-escrow
  (beneficiary principal)
  (amount      uint)
  (context-id  uint)
  (context-type uint)
))
```

**Parameters:**
- `beneficiary`: Funds recipient
- `amount`: Escrow amount in uSTX
- `context-id`: Grant/bounty ID
- `context-type`: 0 for grant, 1 for bounty

**Returns:** `(response uint uint)` - `(ok escrow-id)` on success

**Errors:**
- `ERR-INVALID-AMOUNT` (3004): Zero amount
- `ERR-SELF-ESCROW` (3005): Depositor = beneficiary
- `ERR-DUPLICATE-CONTEXT` (3006): Context already has escrow

#### `release-escrow`

Releases escrow funds to beneficiary.

**Signature:**
```clarity
(define-public (release-escrow
  (escrow-id uint)
))
```

**Errors:**
- `ERR-ESCROW-NOT-FOUND` (3000)
- `ERR-NOT-AUTHORIZED` (3007): Caller not depositor or beneficiary
- `ERR-LOCK-ACTIVE` (3001)
- `ERR-IS-DISPUTED` (3003)

#### `refund-escrow`

Refunds escrow to depositor.

**Signature:**
```clarity
(define-public (refund-escrow
  (escrow-id uint)
))
```

**Errors:**
- `ERR-ESCROW-NOT-FOUND` (3000)
- `ERR-NOT-AUTHORIZED` (3007): Caller not depositor
- `ERR-ALREADY-RELEASED` (3002)
- `ERR-ALREADY-REFUNDED` (3008)

#### `raise-dispute`

Raises dispute on escrow.

**Signature:**
```clarity
(define-public (raise-dispute
  (escrow-id uint)
  (reason    (string-utf8 1000))
))
```

### Admin Functions

#### `resolve-escrow-dispute`

Resolves disputed escrow (admin only).

**Signature:**
```clarity
(define-public (resolve-escrow-dispute
  (escrow-id uint)
  (release-to-beneficiary bool)
))
```

**Parameters:**
- `release-to-beneficiary`: `true` to release to beneficiary, `false` to refund depositor

#### `admin-release-escrow`

Admin emergency release (admin only).

**Signature:**
```clarity
(define-public (admin-release-escrow
  (escrow-id uint)
))
```

### Read-only Functions

#### `get-escrow`

```clarity
(define-read-only (get-escrow
  (escrow-id uint)
))
```

Returns escrow details tuple.

#### `get-escrow-by-context`

```clarity
(define-read-only (get-escrow-by-context
  (context-id   uint)
  (context-type uint)
))
```

Returns escrow ID for given context.

#### `is-escrow-releasable`

```clarity
(define-read-only (is-escrow-releasable
  (escrow-id uint)
))
```

Returns `true` if escrow can be released.

## Error Code Reference

### Core Contract Errors (1000-1999)
- `1000`: `ERR-PROFILE-NOT-FOUND`
- `1001`: `ERR-GRANT-NOT-FOUND`
- `1002`: `ERR-INSUFFICIENT-AMOUNT`
- `1003`: `ERR-GRANT-EXPIRED`
- `1004`: `ERR-NOT-AUTHORIZED`
- `1005`: `ERR-PROFILE-EXISTS`
- `1006`: `ERR-SKILLS-LIMIT`
- `1007`: `ERR-SELF-REFERRAL`
- `1008`: `ERR-INSUFFICIENT-FEE`
- `1009`: `ERR-ALREADY-APPLIED`
- `1010`: `ERR-GRANT-NOT-COMPLETED`
- `1011`: `ERR-NOT-GRANTEE`
- `1012`: `ERR-NOT-GRANT-CREATOR`
- `1013`: `ERR-GRANT-ACTIVE`

### Token Contract Errors (2000-2999)
- `2000`: `ERR-INSUFFICIENT-BALANCE`
- `2001`: `ERR-NOT-TOKEN-OWNER`
- `2002`: `ERR-ZERO-AMOUNT`
- `2003`: `ERR-MAX-SUPPLY`

### Escrow Contract Errors (3000-3999)
- `3000`: `ERR-ESCROW-NOT-FOUND`
- `3001`: `ERR-LOCK-ACTIVE`
- `3002`: `ERR-ALREADY-RELEASED`
- `3003`: `ERR-IS-DISPUTED`
- `3004`: `ERR-INVALID-AMOUNT`
- `3005`: `ERR-SELF-ESCROW`
- `3006`: `ERR-DUPLICATE-CONTEXT`
- `3007`: `ERR-NOT-AUTHORIZED`
- `3008`: `ERR-ALREADY-REFUNDED`

## Data Types

### Profile Tuple
```clarity
{
  name: (string-utf8 100),
  bio: (string-utf8 500),
  location: (string-utf8 100),
  github-url: (string-utf8 200),
  portfolio-url: (string-utf8 200),
  skills: (list 10 (string-utf8 50)),
  completed-grants: uint,
  completed-bounties: uint,
  total-earned: uint,
  reputation-score: uint
}
```

### Grant Tuple
```clarity
{
  creator: principal,
  amount: uint,
  description: (string-utf8 1000),
  requirements: (string-utf8 1000),
  created-at: uint,
  deadline: uint,
  status: uint,  ;; 0=open, 1=assigned, 2=completed, 3=cancelled
  assignee: (optional principal),
  referrer: (optional principal),
  referral-fee: uint
}
```

### Escrow Tuple
```clarity
{
  depositor: principal,
  beneficiary: principal,
  amount: uint,
  created-at: uint,
  release-after: uint,
  context-id: uint,
  context-type: uint,
  is-released: bool,
  is-refunded: bool,
  is-disputed: bool
}
```

## Integration Examples

### TypeScript/JavaScript

```typescript
import { 
  makeContractCall, 
  broadcastTransaction, 
  uintCV, 
  stringUtf8CV, 
  someCV,
  noneCV,
  standardPrincipalCV,
  StacksTestnet 
} from '@stacks/transactions';

const network = new StacksTestnet();
const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';

// Create profile
const createProfileTx = await makeContractCall({
  contractAddress,
  contractName: 'devfunding-core',
  functionName: 'create-profile',
  functionArgs: [
    stringUtf8CV('Developer Name'),
    stringUtf8CV('Bio description'),
    stringUtf8CV('Location'),
    stringUtf8CV('https://github.com/username'),
    stringUtf8CV('https://portfolio.dev'),
    listCV([stringUtf8CV('JavaScript'), stringUtf8CV('TypeScript')])
  ],
  senderKey: 'your-private-key',
  network
});

// Create grant
const createGrantTx = await makeContractCall({
  contractAddress,
  contractName: 'devfunding-core',
  functionName: 'create-grant',
  functionArgs: [
    uintCV(1000000), // 1 STX
    stringUtf8CV('Build feature X'),
    stringUtf8CV('Requirements description'),
    uintCV(30), // 30 days
    noneCV() // No referrer
  ],
  senderKey: 'your-private-key',
  network
});
```

### Python

```python
from stacks import StacksNetwork, Transaction

network = StacksNetwork.testnet()
contract_address = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'

# Transfer tokens
tx = Transaction(
    contract_address=contract_address,
    contract_name='devfunding-token',
    function_name='transfer',
    function_args=[
        {'type': 'uint', 'value': 1000000},
        {'type': 'principal', 'value': 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5'},
        {'type': 'principal', 'value': 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'},
        {'type': 'optional', 'value': {'type': 'buffer', 'value': '0x74657374696e67'}}
    ],
    sender_key='your-private-key'
)
```

## Rate Limits and Constraints

### Transaction Limits
- Maximum grant amount: 10,000,000,000 uSTX (10,000 STX)
- Minimum grant amount: 100,000 uSTX (0.1 STX)
- Maximum grant duration: 365 days
- Minimum grant duration: 1 day
- Maximum skills per profile: 10
- Maximum proposal length: 2000 characters

### Fee Structure
- Grant creation fee: 1% of grant amount (minimum 10,000 uSTX)
- Referral fee: 5% of grant amount
- Dispute fee: 50,000 uSTX (refundable if dispute valid)

### Security Considerations
- Funds are held in escrow until completion
- Disputes have 7-day resolution period
- Admin functions require contract owner signature
- All transfers include proper authorization checks

## Version History

### v1.0.0 (Current)
- Initial contract deployment
- Core platform functionality
- SIP-010 compliant token
- Secure escrow system
- Audit-complete security model

### Planned Features
- Multi-signature support
- Token staking mechanisms
- Governance voting
- Advanced analytics
- Integration with other DeFi protocols

---

*Last Updated: February 2026*  
*Documentation Version: 1.0.0*