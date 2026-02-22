import { describe, it, expect, beforeEach } from 'vitest';
import { initSimnet } from '@stacks/clarinet-sdk';
import { Cl } from '@stacks/transactions';

describe('DevFunding Escrow Contract', () => {
  let simnet: any;
  let accounts: Map<string, string>;

  beforeEach(async () => {
    simnet = await initSimnet();
    accounts = simnet.getAccounts();
    
    simnet.deployContract('devfunding-escrow', './contracts/escrow.clar');
  });

  describe('Escrow Creation', () => {
    const depositor = 'wallet_1';
    const beneficiary = 'wallet_2';
    const amount = Cl.uint(10000000); // 10 STX

    beforeEach(() => {
      simnet.mintStx(20000000, depositor); // Fund depositor
    });

    it('should create an escrow for a grant', () => {
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'create-escrow',
        [
          Cl.principal(beneficiary),
          Cl.uint(123), // grant ID
          Cl.bool(true), // is-grant
          amount
        ],
        depositor
      );

      expect(result.result).toBeOk(Cl.uint(0)); // First escrow ID

      // Verify escrow was created
      const escrow = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'get-escrow',
        [Cl.uint(0)],
        depositor
      );

      expect(escrow.result).toBeSome(
        Cl.tuple({
          'depositor': Cl.principal(depositor),
          'beneficiary': Cl.principal(beneficiary),
          'amount': amount,
          'context-id': Cl.uint(123),
          'is-grant': Cl.bool(true),
          'is-released': Cl.bool(false),
          'is-disputed': Cl.bool(false),
          'is-refunded': Cl.bool(false),
          'created-at': expect.any(Object),
          'release-after': expect.any(Object)
        })
      );
    });

    it('should create an escrow for a bounty', () => {
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'create-escrow',
        [
          Cl.principal(beneficiary),
          Cl.uint(456), // bounty ID
          Cl.bool(false), // is-grant = false (bounty)
          amount
        ],
        depositor
      );

      expect(result.result).toBeOk(Cl.uint(0));

      // Verify by context lookup
      const escrowByContext = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'get-escrow-by-context',
        [Cl.uint(456), Cl.bool(false)],
        depositor
      );

      expect(escrowByContext.result).toBeSome(
        Cl.tuple({
          'depositor': Cl.principal(depositor),
          'beneficiary': Cl.principal(beneficiary),
          'amount': amount,
          'context-id': Cl.uint(456),
          'is-grant': Cl.bool(false),
          'is-released': Cl.bool(false),
          'is-disputed': Cl.bool(false),
          'is-refunded': Cl.bool(false),
          'created-at': expect.any(Object),
          'release-after': expect.any(Object)
        })
      );
    });

    it('should reject self-escrow', () => {
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'create-escrow',
        [
          Cl.principal(depositor), // Same as depositor
          Cl.uint(123),
          Cl.bool(true),
          amount
        ],
        depositor
      );

      expect(result.result).toBeErr(Cl.uint(209)); // ERR-SELF-ESCROW
    });

    it('should reject duplicate context escrow', () => {
      // Create first escrow
      simnet.callPublicFn(
        'devfunding-escrow',
        'create-escrow',
        [
          Cl.principal(beneficiary),
          Cl.uint(123),
          Cl.bool(true),
          amount
        ],
        depositor
      );

      // Try to create duplicate
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'create-escrow',
        [
          Cl.principal(beneficiary),
          Cl.uint(123),
          Cl.bool(true),
          amount
        ],
        depositor
      );

      expect(result.result).toBeErr(Cl.uint(210)); // ERR-CONTEXT-EXISTS
    });

    it('should reject zero amount escrow', () => {
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'create-escrow',
        [
          Cl.principal(beneficiary),
          Cl.uint(123),
          Cl.bool(true),
          Cl.uint(0)
        ],
        depositor
      );

      expect(result.result).toBeErr(Cl.uint(207)); // ERR-INVALID-AMOUNT
    });
  });

  describe('Escrow Release', () => {
    const depositor = 'wallet_1';
    const beneficiary = 'wallet_2';
    const amount = Cl.uint(10000000);
    let escrowId: number;

    beforeEach(() => {
      simnet.mintStx(20000000, depositor);
      
      // Create escrow
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'create-escrow',
        [
          Cl.principal(beneficiary),
          Cl.uint(123),
          Cl.bool(true),
          amount
        ],
        depositor
      );

      escrowId = Cl.tupleGet(result.result!, 'value');
    });

    it('should allow depositor to release escrow to beneficiary', () => {
      const initialBeneficiaryBalance = simnet.stxBalance(beneficiary);
      
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'release-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify funds transferred
      const finalBeneficiaryBalance = simnet.stxBalance(beneficiary);
      expect(finalBeneficiaryBalance).toBeGreaterThan(initialBeneficiaryBalance);

      // Verify escrow marked as released
      const escrow = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'get-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      const isReleased = Cl.tupleGet(escrow.result!, 'is-released');
      expect(isReleased).toBeBool(true);
    });

    it('should reject release by non-depositor', () => {
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'release-escrow',
        [Cl.uint(escrowId)],
        beneficiary // Not the depositor
      );

      expect(result.result).toBeErr(Cl.uint(200)); // ERR-NOT-AUTHORIZED
    });

    it('should reject release of already released escrow', () => {
      // Release once
      simnet.callPublicFn(
        'devfunding-escrow',
        'release-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      // Try to release again
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'release-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeErr(Cl.uint(202)); // ERR-ALREADY-RELEASED
    });

    it('should reject release of disputed escrow', () => {
      // Start dispute
      simnet.callPublicFn(
        'devfunding-escrow',
        'dispute-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      // Try to release
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'release-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeErr(Cl.uint(204)); // ERR-IS-DISPUTED
    });

    it('should reject release of refunded escrow', () => {
      // Advance time past lock period
      simnet.mineEmptyBlocks(10000); // Enough blocks to pass 7 days
      
      // Refund escrow
      simnet.callPublicFn(
        'devfunding-escrow',
        'refund-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      // Try to release
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'release-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeErr(Cl.uint(203)); // ERR-ALREADY-REFUNDED
    });
  });

  describe('Escrow Refund', () => {
    const depositor = 'wallet_1';
    const beneficiary = 'wallet_2';
    const amount = Cl.uint(10000000);
    let escrowId: number;

    beforeEach(() => {
      simnet.mintStx(20000000, depositor);
      
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'create-escrow',
        [
          Cl.principal(beneficiary),
          Cl.uint(123),
          Cl.bool(true),
          amount
        ],
        depositor
      );

      escrowId = Cl.tupleGet(result.result!, 'value');
    });

    it('should allow depositor to refund after lock period', () => {
      // Advance time past lock period (7 days)
      simnet.mineEmptyBlocks(10000);
      
      const initialDepositorBalance = simnet.stxBalance(depositor);
      
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'refund-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify funds returned
      const finalDepositorBalance = simnet.stxBalance(depositor);
      expect(finalDepositorBalance).toBeGreaterThan(initialDepositorBalance);

      // Verify escrow marked as refunded
      const escrow = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'get-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      const isRefunded = Cl.tupleGet(escrow.result!, 'is-refunded');
      expect(isRefunded).toBeBool(true);
    });

    it('should reject refund before lock period', () => {
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'refund-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeErr(Cl.uint(206)); // ERR-LOCK-ACTIVE
    });

    it('should reject refund by non-depositor', () => {
      simnet.mineEmptyBlocks(10000);
      
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'refund-escrow',
        [Cl.uint(escrowId)],
        beneficiary // Not the depositor
      );

      expect(result.result).toBeErr(Cl.uint(200)); // ERR-NOT-AUTHORIZED
    });

    it('should reject refund of released escrow', () => {
      // Release escrow
      simnet.callPublicFn(
        'devfunding-escrow',
        'release-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      simnet.mineEmptyBlocks(10000);
      
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'refund-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeErr(Cl.uint(202)); // ERR-ALREADY-RELEASED
    });

    it('should reject refund of disputed escrow', () => {
      simnet.mineEmptyBlocks(10000);
      
      // Start dispute
      simnet.callPublicFn(
        'devfunding-escrow',
        'dispute-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'refund-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeErr(Cl.uint(204)); // ERR-IS-DISPUTED
    });
  });

  describe('Escrow Disputes', () => {
    const depositor = 'wallet_1';
    const beneficiary = 'wallet_2';
    const amount = Cl.uint(10000000);
    let escrowId: number;

    beforeEach(() => {
      simnet.mintStx(20000000, depositor);
      
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'create-escrow',
        [
          Cl.principal(beneficiary),
          Cl.uint(123),
          Cl.bool(true),
          amount
        ],
        depositor
      );

      escrowId = Cl.tupleGet(result.result!, 'value');
    });

    it('should allow depositor to dispute escrow', () => {
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'dispute-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify escrow marked as disputed
      const escrow = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'get-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      const isDisputed = Cl.tupleGet(escrow.result!, 'is-disputed');
      expect(isDisputed).toBeBool(true);
    });

    it('should allow beneficiary to dispute escrow', () => {
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'dispute-escrow',
        [Cl.uint(escrowId)],
        beneficiary
      );

      expect(result.result).toBeOk(Cl.bool(true));
    });

    it('should reject dispute by third party', () => {
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'dispute-escrow',
        [Cl.uint(escrowId)],
        'wallet_3' // Not depositor or beneficiary
      );

      expect(result.result).toBeErr(Cl.uint(200)); // ERR-NOT-AUTHORIZED
    });

    it('should reject dispute of released escrow', () => {
      // Release escrow
      simnet.callPublicFn(
        'devfunding-escrow',
        'release-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'dispute-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeErr(Cl.uint(202)); // ERR-ALREADY-RELEASED
    });

    it('should reject dispute of refunded escrow', () => {
      // Advance time and refund
      simnet.mineEmptyBlocks(10000);
      simnet.callPublicFn(
        'devfunding-escrow',
        'refund-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'dispute-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeErr(Cl.uint(203)); // ERR-ALREADY-REFUNDED
    });

    it('should reject duplicate dispute', () => {
      // Start dispute
      simnet.callPublicFn(
        'devfunding-escrow',
        'dispute-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      // Try to dispute again
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'dispute-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeErr(Cl.uint(208)); // ERR-ALREADY-DISPUTED
    });
  });

  describe('Dispute Resolution', () => {
    const depositor = 'wallet_1';
    const beneficiary = 'wallet_2';
    const contractOwner = 'deployer';
    const amount = Cl.uint(10000000);
    let escrowId: number;

    beforeEach(() => {
      simnet.mintStx(20000000, depositor);
      
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'create-escrow',
        [
          Cl.principal(beneficiary),
          Cl.uint(123),
          Cl.bool(true),
          amount
        ],
        depositor
      );

      escrowId = Cl.tupleGet(result.result!, 'value');
      
      // Start dispute
      simnet.callPublicFn(
        'devfunding-escrow',
        'dispute-escrow',
        [Cl.uint(escrowId)],
        depositor
      );
    });

    it('should allow contract owner to resolve dispute in favor of beneficiary', () => {
      const initialBeneficiaryBalance = simnet.stxBalance(beneficiary);
      
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'resolve-escrow-dispute',
        [Cl.uint(escrowId), Cl.bool(true)], // release-to-beneficiary = true
        contractOwner
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify funds transferred to beneficiary
      const finalBeneficiaryBalance = simnet.stxBalance(beneficiary);
      expect(finalBeneficiaryBalance).toBeGreaterThan(initialBeneficiaryBalance);

      // Verify escrow marked as released (not refunded)
      const escrow = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'get-escrow',
        [Cl.uint(escrowId)],
        contractOwner
      );

      const isReleased = Cl.tupleGet(escrow.result!, 'is-released');
      const isRefunded = Cl.tupleGet(escrow.result!, 'is-refunded');
      const isDisputed = Cl.tupleGet(escrow.result!, 'is-disputed');

      expect(isReleased).toBeBool(true);
      expect(isRefunded).toBeBool(false);
      expect(isDisputed).toBeBool(false);
    });

    it('should allow contract owner to resolve dispute in favor of depositor', () => {
      const initialDepositorBalance = simnet.stxBalance(depositor);
      
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'resolve-escrow-dispute',
        [Cl.uint(escrowId), Cl.bool(false)], // release-to-beneficiary = false
        contractOwner
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify funds returned to depositor
      const finalDepositorBalance = simnet.stxBalance(depositor);
      expect(finalDepositorBalance).toBeGreaterThan(initialDepositorBalance);

      // Verify escrow marked as refunded (not released)
      const escrow = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'get-escrow',
        [Cl.uint(escrowId)],
        contractOwner
      );

      const isReleased = Cl.tupleGet(escrow.result!, 'is-released');
      const isRefunded = Cl.tupleGet(escrow.result!, 'is-refunded');
      const isDisputed = Cl.tupleGet(escrow.result!, 'is-disputed');

      expect(isReleased).toBeBool(false);
      expect(isRefunded).toBeBool(true);
      expect(isDisputed).toBeBool(false);
    });

    it('should reject dispute resolution by non-owner', () => {
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'resolve-escrow-dispute',
        [Cl.uint(escrowId), Cl.bool(true)],
        depositor // Not owner
      );

      expect(result.result).toBeErr(Cl.uint(200)); // ERR-NOT-AUTHORIZED
    });

    it('should reject resolution of non-disputed escrow', () => {
      // Create new escrow without dispute
      simnet.mintStx(20000000, depositor);
      const newResult = simnet.callPublicFn(
        'devfunding-escrow',
        'create-escrow',
        [
          Cl.principal(beneficiary),
          Cl.uint(456),
          Cl.bool(true),
          amount
        ],
        depositor
      );

      const newEscrowId = Cl.tupleGet(newResult.result!, 'value');

      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'resolve-escrow-dispute',
        [Cl.uint(newEscrowId), Cl.bool(true)],
        contractOwner
      );

      expect(result.result).toBeErr(Cl.uint(205)); // ERR-NOT-DISPUTED
    });

    it('should reject resolution of already released escrow', () => {
      // Resolve dispute first
      simnet.callPublicFn(
        'devfunding-escrow',
        'resolve-escrow-dispute',
        [Cl.uint(escrowId), Cl.bool(true)],
        contractOwner
      );

      // Try to resolve again
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'resolve-escrow-dispute',
        [Cl.uint(escrowId), Cl.bool(true)],
        contractOwner
      );

      expect(result.result).toBeErr(Cl.uint(202)); // ERR-ALREADY-RELEASED
    });

    it('should reject resolution of already refunded escrow', () => {
      // Advance time and refund (bypassing dispute)
      simnet.mineEmptyBlocks(10000);
      simnet.callPublicFn(
        'devfunding-escrow',
        'refund-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'resolve-escrow-dispute',
        [Cl.uint(escrowId), Cl.bool(true)],
        contractOwner
      );

      expect(result.result).toBeErr(Cl.uint(203)); // ERR-ALREADY-REFUNDED
    });
  });

  describe('Admin Functions', () => {
    const contractOwner = 'deployer';
    const nonOwner = 'wallet_1';

    it('should allow owner to set lock period', () => {
      const newPeriod = Cl.uint(86400); // 1 day
      
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'set-lock-period',
        [newPeriod],
        contractOwner
      );

      expect(result.result).toBeOk(newPeriod);

      // Verify lock period updated
      const lockPeriod = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'get-lock-period',
        [],
        contractOwner
      );

      expect(lockPeriod.result).toBeOk(newPeriod);
    });

    it('should reject lock period update by non-owner', () => {
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'set-lock-period',
        [Cl.uint(86400)],
        nonOwner
      );

      expect(result.result).toBeErr(Cl.uint(200)); // ERR-NOT-AUTHORIZED
    });

    it('should reject zero lock period', () => {
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'set-lock-period',
        [Cl.uint(0)],
        contractOwner
      );

      expect(result.result).toBeErr(Cl.uint(207)); // ERR-INVALID-AMOUNT
    });
  });

  describe('Read-only Functions', () => {
    const depositor = 'wallet_1';
    const beneficiary = 'wallet_2';
    const amount = Cl.uint(10000000);
    let escrowId: number;

    beforeEach(() => {
      simnet.mintStx(20000000, depositor);
      
      const result = simnet.callPublicFn(
        'devfunding-escrow',
        'create-escrow',
        [
          Cl.principal(beneficiary),
          Cl.uint(123),
          Cl.bool(true),
          amount
        ],
        depositor
      );

      escrowId = Cl.tupleGet(result.result!, 'value');
    });

    it('should correctly report escrow count', () => {
      const result = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'get-escrow-count',
        [],
        depositor
      );

      expect(result.result).toBeOk(Cl.uint(1));
    });

    it('should correctly report escrow activity', () => {
      const result = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'is-escrow-active',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeBool(true);
    });

    it('should report inactive escrow after release', () => {
      // Release escrow
      simnet.callPublicFn(
        'devfunding-escrow',
        'release-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      const result = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'is-escrow-active',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeBool(false);
    });

    it('should correctly report refund eligibility', () => {
      // Initially should not be refundable
      const initialResult = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'can-refund?',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(initialResult.result).toBeBool(false);

      // After lock period should be refundable
      simnet.mineEmptyBlocks(10000);
      
      const finalResult = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'can-refund?',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(finalResult.result).toBeBool(true);
    });

    it('should not be refundable if disputed', () => {
      simnet.mineEmptyBlocks(10000);
      
      // Start dispute
      simnet.callPublicFn(
        'devfunding-escrow',
        'dispute-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      const result = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'can-refund?',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeBool(false);
    });

    it('should not be refundable if already refunded', () => {
      simnet.mineEmptyBlocks(10000);
      
      // Refund
      simnet.callPublicFn(
        'devfunding-escrow',
        'refund-escrow',
        [Cl.uint(escrowId)],
        depositor
      );

      const result = simnet.callReadOnlyFn(
        'devfunding-escrow',
        'can-refund?',
        [Cl.uint(escrowId)],
        depositor
      );

      expect(result.result).toBeBool(false);
    });
  });
});