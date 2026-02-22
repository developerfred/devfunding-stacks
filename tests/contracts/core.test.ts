import { describe, it, expect, beforeEach } from 'vitest';
import { initSimnet } from '@stacks/clarinet-sdk';
import { Cl } from '@stacks/transactions';

describe('DevFunding Core Contract', () => {
  let simnet: any;
  let accounts: Map<string, string>;

  beforeEach(async () => {
    // Initialize simnet with contracts
    simnet = await initSimnet();
    accounts = simnet.getAccounts();
    
    // Deploy all contracts
    simnet.deployContract('devfunding-core', './contracts/core.clar');
    simnet.deployContract('devfunding-token', './contracts/token.clar');
    simnet.deployContract('devfunding-escrow', './contracts/escrow.clar');
  });

  describe('Developer Profiles', () => {
    const deployer = 'deployer';
    const developer1 = 'wallet_1';
    const developer2 = 'wallet_2';

    it('should create a developer profile', () => {
      const result = simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('githubuser'),
          Cl.stringUtf8('https://portfolio.example.com')
        ],
        developer1
      );

      expect(result.result).toBeOk(Cl.bool(true));
      
      // Verify profile was created
      const profile = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-developer-profile',
        [Cl.principal(developer1)],
        developer1
      );

      expect(profile.result).toBeSome(
        Cl.tuple({
          'github-handle': Cl.stringUtf8('githubuser'),
          'portfolio-url': Cl.stringUtf8('https://portfolio.example.com'),
          'reputation': Cl.uint(0),
          'completed-grants': Cl.uint(0),
          'is-verified': Cl.bool(false),
          'referral-count': Cl.uint(0),
          'referral-earnings': Cl.uint(0),
          'referred-by': Cl.none(),
          'grants-created': Cl.uint(0),
          'grants-claimed': Cl.uint(0)
        })
      );
    });

    it('should not allow duplicate profile creation', () => {
      // Create first profile
      simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('githubuser'),
          Cl.stringUtf8('https://portfolio.example.com')
        ],
        developer1
      );

      // Try to create duplicate
      const result = simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('anotheruser'),
          Cl.stringUtf8('https://another.example.com')
        ],
        developer1
      );

      expect(result.result).toBeErr(Cl.uint(112)); // ERR-PROFILE-EXISTS
    });

    it('should update developer profile', () => {
      // Create profile
      simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('githubuser'),
          Cl.stringUtf8('https://portfolio.example.com')
        ],
        developer1
      );

      // Update profile
      const result = simnet.callPublicFn(
        'devfunding-core',
        'update-dev-profile',
        [
          Cl.stringUtf8('updateduser'),
          Cl.stringUtf8('https://updated.example.com')
        ],
        developer1
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify update
      const profile = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-developer-profile',
        [Cl.principal(developer1)],
        developer1
      );

      expect(profile.result).toBeSome(
        Cl.tuple({
          'github-handle': Cl.stringUtf8('updateduser'),
          'portfolio-url': Cl.stringUtf8('https://updated.example.com'),
          'reputation': Cl.uint(0),
          'completed-grants': Cl.uint(0),
          'is-verified': Cl.bool(false),
          'referral-count': Cl.uint(0),
          'referral-earnings': Cl.uint(0),
          'referred-by': Cl.none(),
          'grants-created': Cl.uint(0),
          'grants-claimed': Cl.uint(0)
        })
      );
    });

    it('should add skills to developer profile', () => {
      // Create profile
      simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('githubuser'),
          Cl.stringUtf8('https://portfolio.example.com')
        ],
        developer1
      );

      // Add first skill
      const result1 = simnet.callPublicFn(
        'devfunding-core',
        'add-skill',
        [Cl.stringUtf8('Clarity')],
        developer1
      );

      expect(result1.result).toBeOk(Cl.bool(true));

      // Add second skill
      const result2 = simnet.callPublicFn(
        'devfunding-core',
        'add-skill',
        [Cl.stringUtf8('TypeScript')],
        developer1
      );

      expect(result2.result).toBeOk(Cl.bool(true));

      // Verify skill count
      const skillCount = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-developer-skill-count',
        [Cl.principal(developer1)],
        developer1
      );

      expect(skillCount.result).toBeOk(Cl.uint(2));

      // Verify first skill
      const skill1 = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-developer-skill',
        [Cl.principal(developer1), Cl.uint(0)],
        developer1
      );

      expect(skill1.result).toBeSome(
        Cl.tuple({ 'skill': Cl.stringUtf8('Clarity') })
      );
    });

    it('should register referral between developers', () => {
      // Create both profiles
      simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('referrer'),
          Cl.stringUtf8('https://referrer.example.com')
        ],
        developer1
      );

      simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('referee'),
          Cl.stringUtf8('https://referee.example.com')
        ],
        developer2
      );

      // Register referral
      const result = simnet.callPublicFn(
        'devfunding-core',
        'register-referral',
        [Cl.principal(developer1)],
        developer2
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify referral was recorded
      const refereeProfile = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-developer-profile',
        [Cl.principal(developer2)],
        developer2
      );

      const refereeData = Cl.tupleGet(refereeProfile.result!, 'referred-by');
      expect(refereeData).toBeSome(Cl.principal(developer1));

      // Verify referrer count increased
      const referrerProfile = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-developer-profile',
        [Cl.principal(developer1)],
        developer1
      );

      const referralCount = Cl.tupleGet(referrerProfile.result!, 'referral-count');
      expect(referralCount).toBeUint(1);
    });
  });

  describe('Grants', () => {
    const creator = 'wallet_1';
    const applicant = 'wallet_2';
    const referrer = 'wallet_3';
    const amount = Cl.uint(10000000); // 10 STX
    const duration = Cl.uint(30); // 30 days

    beforeEach(() => {
      // Create profiles for testing
      simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('creator'),
          Cl.stringUtf8('https://creator.example.com')
        ],
        creator
      );

      simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('applicant'),
          Cl.stringUtf8('https://applicant.example.com')
        ],
        applicant
      );

      simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('referrer'),
          Cl.stringUtf8('https://referrer.example.com')
        ],
        referrer
      );
    });

    it('should create a grant', () => {
      // Fund the creator wallet first
      simnet.mintStx(100000000, creator); // 100 STX

      const result = simnet.callPublicFn(
        'devfunding-core',
        'create-grant',
        [
          amount,
          Cl.stringUtf8('Build a decentralized voting system'),
          Cl.stringUtf8('Must use Clarity and be production-ready'),
          duration,
          Cl.none()
        ],
        creator
      );

      expect(result.result).toBeOk(Cl.uint(0)); // First grant ID

      // Verify grant was created
      const grant = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-grant',
        [Cl.uint(0)],
        creator
      );

      expect(grant.result).toBeSome(
        Cl.tuple({
          'creator': Cl.principal(creator),
          'amount': Cl.uint(9750000), // After 2.5% platform fee
          'description': Cl.stringUtf8('Build a decentralized voting system'),
          'requirements': Cl.stringUtf8('Must use Clarity and be production-ready'),
          'deadline': expect.any(Object), // Will be set based on current time
          'is-active': Cl.bool(true),
          'applicants-count': Cl.uint(0),
          'selected-dev': Cl.none(),
          'is-claimed': Cl.bool(false),
          'referrer': Cl.none(),
          'is-highlighted': Cl.bool(false)
        })
      );
    });

    it('should create a grant with referral', () => {
      // Fund wallets
      simnet.mintStx(100000000, creator);
      simnet.mintStx(1000000, referrer);

      const result = simnet.callPublicFn(
        'devfunding-core',
        'create-grant',
        [
          amount,
          Cl.stringUtf8('Grant with referral'),
          Cl.stringUtf8('Requirements here'),
          duration,
          Cl.some(Cl.principal(referrer))
        ],
        creator
      );

      expect(result.result).toBeOk(Cl.uint(0));

      // Verify referral fee was transferred (1% of amount = 100000)
      const referrerBalance = simnet.stxBalance(referrer);
      expect(referrerBalance).toBeGreaterThan(1000000); // Initial + referral fee
    });

    it('should apply for a grant', () => {
      // Create and fund grant
      simnet.mintStx(100000000, creator);
      simnet.callPublicFn(
        'devfunding-core',
        'create-grant',
        [
          amount,
          Cl.stringUtf8('Test grant'),
          Cl.stringUtf8('Test requirements'),
          duration,
          Cl.none()
        ],
        creator
      );

      const result = simnet.callPublicFn(
        'devfunding-core',
        'apply-for-grant',
        [Cl.uint(0)],
        applicant
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify application was recorded
      const application = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-grant-application',
        [Cl.uint(0), Cl.principal(applicant)],
        applicant
      );

      expect(application.result).toBeSome(
        Cl.tuple({
          'applied-at': expect.any(Object),
          'is-selected': Cl.bool(false)
        })
      );

      // Verify applicant count increased
      const grant = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-grant',
        [Cl.uint(0)],
        creator
      );

      const applicantsCount = Cl.tupleGet(grant.result!, 'applicants-count');
      expect(applicantsCount).toBeUint(1);
    });

    it('should select a developer for a grant', () => {
      // Create grant and application
      simnet.mintStx(100000000, creator);
      simnet.callPublicFn(
        'devfunding-core',
        'create-grant',
        [
          amount,
          Cl.stringUtf8('Test grant'),
          Cl.stringUtf8('Test requirements'),
          duration,
          Cl.none()
        ],
        creator
      );

      simnet.callPublicFn(
        'devfunding-core',
        'apply-for-grant',
        [Cl.uint(0)],
        applicant
      );

      // Select developer
      const result = simnet.callPublicFn(
        'devfunding-core',
        'select-developer',
        [Cl.uint(0), Cl.principal(applicant)],
        creator
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify selection
      const grant = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-grant',
        [Cl.uint(0)],
        creator
      );

      const selectedDev = Cl.tupleGet(grant.result!, 'selected-dev');
      expect(selectedDev).toBeSome(Cl.principal(applicant));
    });

    it('should claim a grant as selected developer', () => {
      // Create grant, application, and selection
      simnet.mintStx(100000000, creator);
      simnet.callPublicFn(
        'devfunding-core',
        'create-grant',
        [
          amount,
          Cl.stringUtf8('Test grant'),
          Cl.stringUtf8('Test requirements'),
          duration,
          Cl.none()
        ],
        creator
      );

      simnet.callPublicFn(
        'devfunding-core',
        'apply-for-grant',
        [Cl.uint(0)],
        applicant
      );

      simnet.callPublicFn(
        'devfunding-core',
        'select-developer',
        [Cl.uint(0), Cl.principal(applicant)],
        creator
      );

      // Advance time to simulate grant completion
      simnet.mineEmptyBlocks(10);

      // Claim grant
      const initialBalance = simnet.stxBalance(applicant);
      const result = simnet.callPublicFn(
        'devfunding-core',
        'claim-grant',
        [Cl.uint(0)],
        applicant
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify funds transferred
      const finalBalance = simnet.stxBalance(applicant);
      expect(finalBalance).toBeGreaterThan(initialBalance);

      // Verify grant marked as claimed
      const grant = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-grant',
        [Cl.uint(0)],
        applicant
      );

      const isClaimed = Cl.tupleGet(grant.result!, 'is-claimed');
      expect(isClaimed).toBeBool(true);
    });
  });

  describe('Premium Features', () => {
    const user = 'wallet_1';
    const contractOwner = 'deployer';

    beforeEach(() => {
      // Create user profile
      simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('premiumuser'),
          Cl.stringUtf8('https://premium.example.com')
        ],
        user
      );
    });

    it('should purchase premium subscription', () => {
      // Fund user wallet
      simnet.mintStx(1000000000, user); // 1000 STX

      const result = simnet.callPublicFn(
        'devfunding-core',
        'purchase-premium',
        [Cl.uint(3)], // 3 months
        user
      );

      expect(result.result).toBeOk(expect.any(Object)); // Returns expiry timestamp

      // Verify premium status
      const isPremium = simnet.callReadOnlyFn(
        'devfunding-core',
        'is-premium?',
        [Cl.principal(user)],
        user
      );

      expect(isPremium.result).toBeOk(Cl.bool(true));
    });

    it('should create highlighted grant as premium user', () => {
      // Purchase premium first
      simnet.mintStx(1000000000, user);
      simnet.callPublicFn(
        'devfunding-core',
        'purchase-premium',
        [Cl.uint(1)],
        user
      );

      // Create highlighted grant
      simnet.mintStx(100000000, user);
      const result = simnet.callPublicFn(
        'devfunding-core',
        'create-highlighted-grant',
        [
          Cl.uint(10000000),
          Cl.stringUtf8('Highlighted grant'),
          Cl.stringUtf8('Premium requirements'),
          Cl.uint(30),
          Cl.none()
        ],
        user
      );

      expect(result.result).toBeOk(Cl.uint(0));

      // Verify grant is highlighted
      const grant = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-grant',
        [Cl.uint(0)],
        user
      );

      const isHighlighted = Cl.tupleGet(grant.result!, 'is-highlighted');
      expect(isHighlighted).toBeBool(true);
    });
  });

  describe('Governance', () => {
    const proposer = 'wallet_1';
    const voter = 'wallet_2';

    beforeEach(() => {
      // Create profiles
      simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('proposer'),
          Cl.stringUtf8('https://proposer.example.com')
        ],
        proposer
      );

      simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [
          Cl.stringUtf8('voter'),
          Cl.stringUtf8('https://voter.example.com')
        ],
        voter
      );
    });

    it('should create a proposal', () => {
      const result = simnet.callPublicFn(
        'devfunding-core',
        'propose-improvement',
        [Cl.stringUtf8('Add new feature X to the platform')],
        proposer
      );

      expect(result.result).toBeOk(Cl.uint(0));

      // Verify proposal exists
      const proposal = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-proposal',
        [Cl.uint(0)],
        proposer
      );

      expect(proposal.result).toBeSome(
        Cl.tuple({
          'proposer': Cl.principal(proposer),
          'description': Cl.stringUtf8('Add new feature X to the platform'),
          'yes-votes': Cl.uint(0),
          'no-votes': Cl.uint(0),
          'is-active': Cl.bool(true),
          'created-at': expect.any(Object)
        })
      );
    });

    it('should vote on a proposal', () => {
      // Create proposal
      simnet.callPublicFn(
        'devfunding-core',
        'propose-improvement',
        [Cl.stringUtf8('Test proposal')],
        proposer
      );

      // Vote yes
      const result = simnet.callPublicFn(
        'devfunding-core',
        'vote-on-proposal',
        [Cl.uint(0), Cl.bool(true)],
        voter
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify vote counted
      const proposal = simnet.callReadOnlyFn(
        'devfunding-core',
        'get-proposal',
        [Cl.uint(0)],
        voter
      );

      const yesVotes = Cl.tupleGet(proposal.result!, 'yes-votes');
      expect(yesVotes).toBeUint(1);
    });
  });

  describe('Error Conditions', () => {
    const user = 'wallet_1';

    it('should reject empty strings', () => {
      const result = simnet.callPublicFn(
        'devfunding-core',
        'create-dev-profile',
        [Cl.stringUtf8(''), Cl.stringUtf8('https://example.com')],
        user
      );

      expect(result.result).toBeErr(Cl.uint(124)); // ERR-EMPTY-STRING
    });

    it('should reject grant creation with insufficient amount', () => {
      simnet.mintStx(1000000, user); // 1 STX

      const result = simnet.callPublicFn(
        'devfunding-core',
        'create-grant',
        [
          Cl.uint(500000), // 0.5 STX < MIN-AMOUNT-USTX (1 STX)
          Cl.stringUtf8('Test grant'),
          Cl.stringUtf8('Requirements'),
          Cl.uint(30),
          Cl.none()
        ],
        user
      );

      expect(result.result).toBeErr(Cl.uint(121)); // ERR-INVALID-AMOUNT
    });

    it('should reject grant application after deadline', () => {
      // Create grant with very short duration
      simnet.mintStx(100000000, user);
      simnet.callPublicFn(
        'devfunding-core',
        'create-grant',
        [
          Cl.uint(10000000),
          Cl.stringUtf8('Short grant'),
          Cl.stringUtf8('Requirements'),
          Cl.uint(1), // 1 day
          Cl.none()
        ],
        user
      );

      // Mine enough blocks to pass deadline
      simnet.mineEmptyBlocks(200); // Assuming 1 block ≈ 10 minutes

      const result = simnet.callPublicFn(
        'devfunding-core',
        'apply-for-grant',
        [Cl.uint(0)],
        user
      );

      expect(result.result).toBeErr(Cl.uint(108)); // ERR-DEADLINE-PASSED
    });
  });
});