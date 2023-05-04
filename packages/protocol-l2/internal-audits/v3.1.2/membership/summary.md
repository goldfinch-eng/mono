![Warbler-Logo](../../warbler-logo.png)

# Membership Harvesting Audit 01/19/23

Auditors: [Dalton](https://github.com/daltyboy11)

## Overview
Harvesting is a new feature to Membership Vaults that allows rewards to be claimed on vaulted assets without having to unvault those assets.

For pool tokens, this means claiming interest redeemable, principal redeemable, and backer rewards without having to unvault the pool token. For staked fidu, this means claiming GFI staking rewards without having
to unvault the staked fidu position.

## Scope
The audit's focus is on these contracts
* PoolTokenAsset.sol
* StakedFiduAsset.sol
* CapitalAssets.sol
* MembershipOrchestrator.sol

## Summary of findings
Nothing serious found.

However, I'm concerned by the excessive mocking in unit tests and the potential
mainnet code paths that go untested because of this stubbing. The example I found in the audit was with
calling harvest on duplicate pool token position id's. I expected the second invocation on the same id
to revert, because TranchedPool's _withdrawMax_ reverts if the withdrawable amount is 0. But when I wrote
a test to confirm this (`test_harvest_poolToken_duplicate`), it didn't revert because the TranchedPool's
_withdrawMax_ is replaced by MockedTranchedPool's _withdrawMax_. The mocked version forwards the call to
_withdrawMax_ in MockedPoolTokens, which doesn't even exist on mainnet.