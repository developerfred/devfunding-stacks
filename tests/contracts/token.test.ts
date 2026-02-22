import { describe, it, expect, beforeEach } from 'vitest';
import { initSimnet } from '@stacks/clarinet-sdk';
import { Cl } from '@stacks/transactions';

describe('DevFunding Token Contract (SIP-010)', () => {
  let simnet: any;
  let accounts: Map<string, string>;

  beforeEach(async () => {
    simnet = await initSimnet();
    accounts = simnet.getAccounts();
    
    simnet.deployContract('devfunding-token', './contracts/token.clar');
  });

  describe('Token Properties', () => {
    it('should return correct token name', () => {
      const result = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-name',
        [],
        'deployer'
      );

      expect(result.result).toBeOk(Cl.stringAscii('DevFunding Token'));
    });

    it('should return correct token symbol', () => {
      const result = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-symbol',
        [],
        'deployer'
      );

      expect(result.result).toBeOk(Cl.stringAscii('DFT'));
    });

    it('should return correct decimals', () => {
      const result = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-decimals',
        [],
        'deployer'
      );

      expect(result.result).toBeOk(Cl.uint(6));
    });

    it('should return initial total supply', () => {
      const result = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-total-supply',
        [],
        'deployer'
      );

      expect(result.result).toBeOk(Cl.uint(500000000000000)); // 500M tokens with 6 decimals
    });

    it('should return token URI', () => {
      const result = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-token-uri',
        [],
        'deployer'
      );

      expect(result.result).toBeOk(
        Cl.some(Cl.stringUtf8('https://devfunding.xyz/token-metadata.json'))
      );
    });
  });

  describe('Token Balances', () => {
    const deployer = 'deployer';
    const recipient = 'wallet_1';

    it('should have initial supply minted to deployer', () => {
      const result = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-balance',
        [Cl.principal(deployer)],
        deployer
      );

      expect(result.result).toBeOk(Cl.uint(500000000000000));
    });

    it('should return zero balance for new address', () => {
      const result = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-balance',
        [Cl.principal(recipient)],
        recipient
      );

      expect(result.result).toBeOk(Cl.uint(0));
    });
  });

  describe('Token Transfers', () => {
    const deployer = 'deployer';
    const sender = 'wallet_1';
    const recipient = 'wallet_2';

    beforeEach(() => {
      simnet.mintFt('devfunding-token', 1000000, sender);
    });

    it('should transfer tokens between accounts', () => {
      const initialSenderBalance = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-balance',
        [Cl.principal(sender)],
        sender
      );

      const initialRecipientBalance = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-balance',
        [Cl.principal(recipient)],
        recipient
      );

      const transferAmount = Cl.uint(100000);
      const result = simnet.callPublicFn(
        'devfunding-token',
        'transfer',
        [
          transferAmount,
          Cl.principal(sender),
          Cl.principal(recipient),
          Cl.none()
        ],
        sender
      );

      expect(result.result).toBeOk(Cl.bool(true));

      const finalSenderBalance = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-balance',
        [Cl.principal(sender)],
        sender
      );

      const finalRecipientBalance = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-balance',
        [Cl.principal(recipient)],
        recipient
      );

      expect(finalSenderBalance.result).toBeOk(
        Cl.sub(
          Cl.tupleGet(initialSenderBalance.result!, 'value'),
          transferAmount
        )
      );

      expect(finalRecipientBalance.result).toBeOk(
        Cl.add(
          Cl.tupleGet(initialRecipientBalance.result!, 'value'),
          transferAmount
        )
      );
    });

    it('should transfer tokens with memo', () => {
      const memo = Cl.some(Cl.bufferFromUtf8('Test transfer memo'));
      
      const result = simnet.callPublicFn(
        'devfunding-token',
        'transfer',
        [
          Cl.uint(100000),
          Cl.principal(sender),
          Cl.principal(recipient),
          memo
        ],
        sender
      );

      expect(result.result).toBeOk(Cl.bool(true));
    });

    it('should reject transfer from non-owner', () => {
      const result = simnet.callPublicFn(
        'devfunding-token',
        'transfer',
        [
          Cl.uint(100000),
          Cl.principal(deployer), // Not owned by sender
          Cl.principal(recipient),
          Cl.none()
        ],
        sender
      );

      expect(result.result).toBeErr(Cl.uint(303)); // ERR-NOT-TOKEN-OWNER
    });

    it('should reject zero amount transfer', () => {
      const result = simnet.callPublicFn(
        'devfunding-token',
        'transfer',
        [
          Cl.uint(0),
          Cl.principal(sender),
          Cl.principal(recipient),
          Cl.none()
        ],
        sender
      );

      expect(result.result).toBeErr(Cl.uint(301)); // ERR-INVALID-AMOUNT
    });

    it('should reject insufficient balance transfer', () => {
      const largeAmount = Cl.uint(1000000000000); // More than balance
      
      const result = simnet.callPublicFn(
        'devfunding-token',
        'transfer',
        [
          largeAmount,
          Cl.principal(sender),
          Cl.principal(recipient),
          Cl.none()
        ],
        sender
      );

      expect(result.result).toBeErr(Cl.uint(1)); // ft-transfer? error code
    });
  });

  describe('Minting', () => {
    const deployer = 'deployer';
    const recipient = 'wallet_1';

    it('should allow deployer to mint tokens', () => {
      const mintAmount = Cl.uint(1000000);
      const initialSupply = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-total-supply',
        [],
        deployer
      );

      const result = simnet.callPublicFn(
        'devfunding-token',
        'mint',
        [mintAmount, Cl.principal(recipient)],
        deployer
      );

      expect(result.result).toBeOk(Cl.bool(true));

      const finalSupply = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-total-supply',
        [],
        deployer
      );

      expect(finalSupply.result).toBeOk(
        Cl.add(
          Cl.tupleGet(initialSupply.result!, 'value'),
          mintAmount
        )
      );

      const recipientBalance = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-balance',
        [Cl.principal(recipient)],
        recipient
      );

      expect(recipientBalance.result).toBeOk(mintAmount);
    });

    it('should reject mint by non-owner', () => {
      const result = simnet.callPublicFn(
        'devfunding-token',
        'mint',
        [Cl.uint(1000000), Cl.principal('wallet_2')],
        'wallet_1'
      );

      expect(result.result).toBeErr(Cl.uint(300)); // ERR-NOT-AUTHORIZED
    });

    it('should reject zero amount mint', () => {
      const result = simnet.callPublicFn(
        'devfunding-token',
        'mint',
        [Cl.uint(0), Cl.principal(recipient)],
        deployer
      );

      expect(result.result).toBeErr(Cl.uint(301)); // ERR-INVALID-AMOUNT
    });

    it('should reject mint exceeding max supply', () => {
      const almostMaxSupply = Cl.uint(999999999999999);
      
      const result = simnet.callPublicFn(
        'devfunding-token',
        'mint',
        [almostMaxSupply, Cl.principal(recipient)],
        deployer
      );

      expect(result.result).toBeErr(Cl.uint(302)); // ERR-MAX-SUPPLY-EXCEEDED
    });
  });

  describe('Burning', () => {
    const holder = 'wallet_1';

    beforeEach(() => {
      simnet.mintFt('devfunding-token', 1000000, holder);
    });

    it('should allow token holder to burn tokens', () => {
      const burnAmount = Cl.uint(100000);
      const initialBalance = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-balance',
        [Cl.principal(holder)],
        holder
      );

      const initialSupply = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-total-supply',
        [],
        holder
      );

      const result = simnet.callPublicFn(
        'devfunding-token',
        'burn',
        [burnAmount],
        holder
      );

      expect(result.result).toBeOk(Cl.bool(true));

      const finalBalance = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-balance',
        [Cl.principal(holder)],
        holder
      );

      const finalSupply = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-total-supply',
        [],
        holder
      );

      expect(finalBalance.result).toBeOk(
        Cl.sub(
          Cl.tupleGet(initialBalance.result!, 'value'),
          burnAmount
        )
      );

      expect(finalSupply.result).toBeOk(
        Cl.sub(
          Cl.tupleGet(initialSupply.result!, 'value'),
          burnAmount
        )
      );
    });

    it('should reject zero amount burn', () => {
      const result = simnet.callPublicFn(
        'devfunding-token',
        'burn',
        [Cl.uint(0)],
        holder
      );

      expect(result.result).toBeErr(Cl.uint(301)); // ERR-INVALID-AMOUNT
    });

    it('should reject burn exceeding balance', () => {
      const largeAmount = Cl.uint(1000000000);
      
      const result = simnet.callPublicFn(
        'devfunding-token',
        'burn',
        [largeAmount],
        holder
      );

      expect(result.result).toBeErr(Cl.uint(1)); // ft-burn? error code
    });
  });

  describe('Admin Functions', () => {
    const deployer = 'deployer';
    const nonOwner = 'wallet_1';

    it('should allow owner to update token URI', () => {
      const newUri = Cl.stringUtf8('https://new-metadata.example.com/token.json');
      
      const result = simnet.callPublicFn(
        'devfunding-token',
        'set-token-uri',
        [newUri],
        deployer
      );

      expect(result.result).toBeOk(Cl.bool(true));

      const updatedUri = simnet.callReadOnlyFn(
        'devfunding-token',
        'get-token-uri',
        [],
        deployer
      );

      expect(updatedUri.result).toBeOk(
        Cl.some(newUri)
      );
    });

    it('should reject token URI update by non-owner', () => {
      const result = simnet.callPublicFn(
        'devfunding-token',
        'set-token-uri',
        [Cl.stringUtf8('https://malicious.example.com')],
        nonOwner
      );

      expect(result.result).toBeErr(Cl.uint(300)); // ERR-NOT-AUTHORIZED
    });

    it('should reject empty token URI', () => {
      const result = simnet.callPublicFn(
        'devfunding-token',
        'set-token-uri',
        [Cl.stringUtf8('')],
        deployer
      );

      expect(result.result).toBeErr(Cl.uint(301)); // ERR-INVALID-AMOUNT (reused for empty string)
    });
  });

  describe('SIP-010 Compliance', () => {
    const deployer = 'deployer';

    it('should implement all required SIP-010 functions', () => {
      const functions = [
        'transfer',
        'get-name',
        'get-symbol',
        'get-decimals',
        'get-balance',
        'get-total-supply',
        'get-token-uri'
      ];

      functions.forEach(fnName => {
        const contract = simnet.getContract('devfunding-token');
        expect(contract.contractInterface.functions).toHaveProperty(fnName);
      });
    });

    it('should have correct function signatures', () => {
      const contract = simnet.getContract('devfunding-token');
      
      const transferFn = contract.contractInterface.functions.find(
        (fn: any) => fn.name === 'transfer'
      );
      
      expect(transferFn?.args).toEqual([
        { name: 'amount', type: 'uint128' },
        { name: 'sender', type: 'principal' },
        { name: 'recipient', type: 'principal' },
        { name: 'memo', type: '(optional (buff 34))' }
      ]);
      
      expect(transferFn?.access).toBe('public');
    });
  });
});