# MembershipDirector

Handles assessing holdings in relation to membership score and rewards distribution


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