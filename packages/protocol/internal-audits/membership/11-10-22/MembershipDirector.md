# MembershipDirector

MembershipDirector.sol audit.
Handles assessing holdings in relation to membership score and rewards distribution

# Summary

I found a view function returning stale storage values. This is a pattern across MembershipDirector,
MembershipOrchestrator, and MembershipVault. See comments in the general summary arguing why we shouldn't
return stale values in view functions.

- _currentScore_ can return stale values when an epoch is over but not finalized
  - **Severity**: 🟢 Informational
  - **Description**: _currentScore_ returns the position from _MembershipVault#positionOwnedBy_, and
    this returns the position from storage: `return positions[owners[owner]];`. The storage struct doesn't
    account for epochs that have ended but are not finalized.
    - Example: If I deposit 100 GFI and 1 Capital (alpha = 1) in epoch 1 then my nextEpochAmount would be
      100 and my eligibleAmount would be 0. Now advance to epoch 2. My eligibleAmount should be 100 now but
      the storage struct hasn't been updated to reflect that.
  - **Suggested Fix**: Add logic to account for ended non-finalized epochs
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference/completeness

## Legend

- ✅ Looks good
  - reasonably confident in the security
- ❓ Questionable
  - An non-security issue, an issue where it's unclear if it's security related, or a security
    related issue that isn't a launch blocker.
- 🛑 Security vulnerability
  - A security bug that must be fixed before launch

### Analysis

- 🛑 _currentScore(address owner)_

  - 🛑 **It can return stale values**: Does not update until my next deposit or withdrawal, making
    it return the incorrect value if I haven't deposited or withdrawn since the epoch in which I
    did my most recent deposit. This also causes _memberScoreOf(address addr)_ to return incorrect
    values.

- _consumeWithdrawal(address owner)_
  - How could it break?
    - Rewards are allocated on the user/epoch's post-withdrawal totals
      - Although _consumeDeposit_ is called **after** GFI and Capital withdrawals are processed (and
        their respective totals decrease in the ledger), the ledger decreases don't propagate to the
        vault until _decreaseHoldings_ is called. Since _decreaseHoldings_ is called **after** rewards
        are allocated via _\_allocateRewards(owner)_, rewards are allocated according to the correct
        totals.
- _consumeDeposit(address owner)_

  - How could it break?
    - Rewards are allocated on the user/epoch's post-deposit totals
      - See analysis for _consumeWithdrawal_

- _collectRewards_
  - How could it break?
    - Forgets to allocate rewards

### Pre-audit checklist

#### Legend

- ✅ Looks good
- 🚧 No action needed but good to be aware of
- 🛑 Action needed
- ⚪ Not applicable

- Testing and compilation

  - ✅ Changes have solid branch and line coverage
    - 100% line and function coverage is solid
  - 🚧 Tests for event emissions
    - Missing test for RewardsClaimed
  - ⚪ Mainnet forking tests
  - ✅ Contract compiles without warnings
  - 🛑 Any public fns not called internally are `external`
    - _claimableRewards_ can be `external`
    - _currentScore_ can be `external`

- ✅ Documentation

  - 🛑 All `external` and `public` functions are documented with NatSpec
    - _claimableRewards_ NatSpec is incorrect. Claimable rewards are for `owner`, not `caller`.
    - _collectRewards_ NatSpec is incorrect for the same reason.
  - ⚪ If the behavior of existing `external` and `public` functions was changed then their NatSpec was updated

- ✅ Access Control

  - ✅ Permissions on external functions check out
    - ✅ All non-view external functions should have _onlyOperator_ because only the orchestrator should be able to call them
  - ✅ New roles are documented
    - See _AccessControl.sol_
  - ✅ An event is emitted when roles are assigned or revoked
    - See _AccessControl.sol_

- 🚧 For the auditors

  - Implicit security assumptions the changes rely on are documented
    - Assumes callers who possess the operator role are acting honestly
    - Trusts the context returns non-malicious addresses
  - 🚧 Library dependency release notes checked for vulnerabilities
    - We're on version 4.3.2 and MembershipDirector uses /contracts-upgradeable/utils/math/MathUpgradeable.sol and
      /contracts-upgradeable/proxy/utils/Initializable.sol". I looked at the release notes from 4.3.2 to the current
      4.7.3 and found
      - v4.4.1 had a low severity patch in for Initializable: https://github.com/OpenZeppelin/openzeppelin-contracts/security/advisories/GHSA-9c22-pwxw-p6hx
      - v4.6.0 added non-security related improvements to Initializable
        - Emit an event with version number: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/3294
        - Reuse the storage of the intializer bool for subsequent initializations instead of adding a storage slot each time: https://github.com/OpenZeppelin/openzeppelin-contracts/issues/2901

- ✅ Proxies

  - ⚪ Changes to upgradeble contracts don't cause storage collisions

- ✅ Safe Operataions

  - ⚪ Using SafeERC20Transfer for ERC20 transfers
    - Doesn't do any erc20 transfers
  - ⚪ Using SafeMath for arithmetic
    - Not applicable because solc >= 8.0.0
  - ⚪ Using SafeCast
  - ⚪ Unbounded arrays: no iterating on them or passing them as params
    - No unbounded arrays in this contract
  - ✅ Division operations appear at the end of a computation to minimize rounding error
    - There is a division operation in _\_calculateEpochRewards_ and it's at the end of the operation
  - ⚪ Not using built in _transfer_
  - ⚪ Untrusted input sanitization
    - There aren't any untrusted inputs to this contract because all the external functions require an operator
      and it's a security assumption that the operator is trusted
  - ⚪ State updates doen BEFORE calls to untrusted addresses
    - There aren't any calls to untrusted addresses.
  - ✅ Follows checks-effects-interaction pattern
    - ✅ _consumeDeposit_
    - ✅ _consumeWithdraw_
    - ✅ _collectRewards_
  - ✅ Inputs to external and public fns are validated
    - Again, they're implicitly validated because they're only callable by a trusted operator who we assume
      does the validation
  - `SECONDS_PER_YEAR` leap year issue

- ✅ Speed bumps, circuit breakers, and monitoring

  - Do there need to be any delays between actions?
    - Brainstorming potential combinations of actions and assessing if they need a delay
      - Delay between multiple successive deposts
        - Doesn't seem necessary because each deposit I make is a completely new position,
          so any future deposits don't affect earlier ones. Each deposit will add to my
          totals amount but I don't see how that's negatively impacted by making many deposits
          in quick succession
      - Delay between deposits and withdrawals
        - I don't think there needs to be a delay here. In terms of how a timing between a deposit
          and withdrawal affects my rewards accrued, this is covered by the epoch system - there's
          little incentive to deposit and withdraw quickly thereafter because I wouldn't earn rewards
          by doing that
  - ✅ Are events emitted for important state changes?
    - _RewardsRedeemed_ emitted for redeeming rewards
    - This is the only significant event

- ⚪ Protocol Integrations

## External Functions

### `consumeHoldingsAdjustment`

- [x] Uses onlyOperator

Called to refresh a given membership score

#### External calls

- [`CapitalLedger.totalsOf`](./CapitalLedger.md#totalsof) **trusted**
- [`GFILedger.totalsOf`](./GFILedger.md#totalsof) **trusted**
- [`MembershipVault.adjustHoldings`](./MembershipVault.md#adjustholdings) **trusted**

### `collectRewards`

- [x] Uses onlyOperator

#### External calls

- [`MembershipLedger.resetRewards`](./MembershipLedger.md#resetrewards) **trusted**
- [`MembershipCollector.distributeFiduTo`](./MembershipCollector.md#distributefiduto) **trusted**

- [`MembershipCollector.lastFinalizedEpoch`](./MembershipCollector.md#lastfinalizedepoch) **trusted**

### `finalizeEpochs`

- [ ] Uses onlyOperator

## External View Functions

### `claimableRewards`

- [x] Takes into account rewards that will be distributed for epochs that
      haven't been finalized yet

#### External Calls

- [`MembershipLedger.getPendingRewardsFor`](./MembershipLedger.md#getpendingrewardsfor)
- [`MembershipVault.positionOwnedBy`](./MembershipVault.md#positionownedby)

### `currentScore`

#### External Calls

- [`MembershipVault.positionOwnedBy`](./MembershipVault.md#positionownedby)

### `estimateMemberScore`

#### External Calls

- [`MembershipVault.totalAtEpoch`](./MembershipVault.md#totalatepoch)

### `totalMemberScores`

Good.

### `calculateMembershipScore`

Basically a simple proxy method

#### External calls

- [`MembershipLedger.alpha`](./MembershipLedger.md#alpha) **trusted**
- [`MembershipScores.calculateScore`](./MembershipScores.md#calculatescore) **trusted**

### Internal Functions

#### `_allocateRewards`

None
