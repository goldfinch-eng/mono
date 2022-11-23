
# MembershipOrchestrator

## External Functions

### `initialize`
- [x] uses `initializer` modifier
- [!] initializes inherited
  - Does not call `Pausable_init_unchained()`

### `deposit`
- [x] NonReentrant
- [x] WhenNotPause
- Even though this function does not follow check effects interactions, the reentrancy gaurd and interactions with only trusted contracts make this not an issue

#### External calls
- `GFI.approve`
- `GFI.transfer`
- `GFI.balanceOf`
- [`GFILedger.deposit`](./GFILedger.md#deposit) **trusted** when depositing GFI
- [`CapitalLedger.depositERC721`](./CapitalLedger.md#depositERC721) **trusted** when depositing erc721 assets like pool tokens or staked fidu
- [`MembershipDirector.consumeHoldingsAdjustment`](./MembershipDirector.md#consumeholdingsadjustment) **trusted** Used to refresh membership score after deposit

### `withdraw`
- [x] NonReentrant
- [x] WhenNotPaused
- [x] Verifies ownership of assets when withdrawing
  - [x] Capital assets
  - [x] GFI assets
  - Gets the owner from the first position being withdrawn `.id` field
  - Verifies that the caller is the owner of the position
- Even though this function does not follow check effects interactions, the reentrancy gaurd and interactions with only trusted contracts make this not an issue

#### External calls
- [`GFILedger.withdraw`](./GFILedger.md#withdraw) **trusted** when withdrawing GFI
- [`CapitalLedger.ownerOf`](./CapitalLedger.md#ownerOf) **trusted** when withdrawing non-gfi assets
- [`CapitalLedger.withdraw`](./CapitalLedger.md#withdraw) **trusted** when withdrawing non-gfi assets

### `collectRewards`
- [x] NonReentrant
- [x] WhenNotPaused

#### External calls

- [MembershipDirector.collectRewards](./MembershipDirector.md#collectrewards) **trusted**

### `finalizeEpochs`
- [x] NonReentrant
- [x] WhenNotPaused

#### External calls
- [MembershipDirector.finalizeEpochs](./MembershipDirector.md#finalizeepochs) **trusted**

### `onERC721Received`
- [-] NonReentrant
- [-] WhenNotPaused

inert.

## External View functions

### `estimateRewardsFor`

Simple proxy method

#### External calls
- [MembershipCollector.estimateRewardsFor](./MembershipCollector.md#) **trusted**

### `claimableRewards`

Simple proxy method

#### External calls
- [MembershipDirector.claimableRewards](./MembershipDirector.md#claimablerewards) **trusted**

### `votingPower`

Simple proxy method

#### External calls
- [`GFILedger.totalsOf`](./GFILedger.md#totalsof) **trusted**

### `totalGFIHeldBy`

Simple proxy method

#### External calls
- [`GFILedger.totalsOf`](./GFILedger.md#totalsof) **trusted**

### `totalCapitalHeldBy`

Simple proxy method

#### External calls
- [`CapitalLedger.totalsOf`](./CapitalLedger.md#totalsOf) **trusted**

### `memberScoreOf`

Simple proxy method

#### External calls

- [`MembershipDirector.currentScore`](./MembershipDirector.md#currentScore) **trusted**

### `calculateMemberScore`

Simple proxy method

#### External calls
- [`MembershipDirector.calculateMembershipScore`](./MembershipDirector.md#calculatemembershipscore) **trusted**

### `estimateMemberScore`

Simple proxy method

#### External calls
- [`MembershipDirector.estimateMemberScore`](./MembershipDirector.md#estimatememberscore) **trusted**

### `totalMemberScores`

Simple proxy method

#### External calls
- [`MembershipDirector.totalMemberScores`](./MembershipDirector.md#totalmemberscores) **trusted**

## Issues
* 🌕 `MembershipOrchestrator.initialize` does not call `PausableUpgradeable.init_unchained()`