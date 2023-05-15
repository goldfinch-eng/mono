# Internal Audit August - `Go` contract `tx.origin` as source of truth for access control

## Audit authors

@daltyboy11 @bstchow

## Goals

- Review Go.sol for vulnerabilities since there were changes to allow tx.origin UID owners to be considered golisted
- Review Go-dependent contracts in the Goldfinch protocol for potential vulnerabilities as a result of new msg.sender possibilities. Reentrancy attacks are a specific concern.
- Review general Ethereum contract ecosystem for smart contract attack vectors - any smart contracts which could amplify existing attacks or enable new attacks.

- Timebox the audit to roughly 8 hrs total eng time (eng resource constraint)

  - Roughly 1 hour per eng. for each of the following
    - Discussions
    - Finding & reviewing functions of interest in Go & dependent contracts
    - Looking for general Ethereum smart contract attack vectors which could pose threats
    - Sharing findings and then investigating any new, shared concerns

- Only review public/external functions of Goldfinch protocol contracts to satisfy time constraints.

## Go

### Responsibilities of the contract

Go is the source of truth on whether an Ethereum address is allowed to interact with KYC-gated features of the Goldfinch protocol.

#### State mutating functions

- initialize(address owner,GoldfinchConfig \_config,address \_uniqueIdentity) public initializer
  - [x] How could it break?
    - Allow reinitialization
      - review status?
        - OK - added a mainnet forking that verifies call to initialize fails
- performUpgrade() external onlyAdmin
  - [x] How could it break?
    - callable by non-admin
      - review status
        - OK - has onlyAdmin modifier
    - `allIdTypes` array set to incorrect values
      - review status
        - OK - values are fine
- [x] setLegacyGoList(GoldfinchConfig \_legacyGoList) external onlyAdmin
  - No threat found.
  - Role modifiers are correctly used, and impact is limited to modifying Go listed addresses.
- [x] initZapperRole() external onlyAdmin
  - No threat found.
  - Role modifiers are correctly used, and impact is limited to modifying Zapper role admin address
  - Zapper role holder is limited to being a goListed address.

#### View / pure functions

<!-- Add reviewed external/public view/pure functions here, along with steps taken to verify expected behavior  -->

- goOnlyIdTypes(address account, uint256[] memory onlyIdTypes) public view
- [] How could it break?
- getAllIdTypes() public view returns (uint256[] memory)
- [] How could it break?
- [x] getSeniorPoolIdTypes() public pure returns (uint256[] memory)
  - No threat found. Pure function with hard coded values and no inputs - basically static constant.
- go(address account) public view override returns (bool)
  - Might exhibits threats (if any) found in goOnlyIdTypes.
  - However, no threats found in how `go` utilizes goOnlyIdTypes
- goSeniorPool(address account) public view override returns (bool)
  - Might exhibits threats (if any) found in goOnlyIdTypes.
  - However, no threats found in how `goSeniorPool` utilizes goOnlyIdTypes

#### Additional Notes

- Go contract state variables and internal functions were not reviewed due to time constraints.
- No modifiers exist for Go contract.

## TranchedPool

### State Mutating Functions

- 🟢 consider removing infinite USDC self approval
  - current pattern: in initializer we self approve the max amount `require(config.getUSDC().approve(address(this), uint256(-1)))` and perform transfers as
    `config.getUSDC().safeERC20TransferFrom(address(this), config.reserveAddress(), totalReserveAmount);`.
  - suggestion: remove the self approval and use safeERC20Transfer for transfers from self
  - impact: simplification and gas savings

- setAllowedUIDTypes
  - locker can set uid types to include us non-accredited, potentially opening us up to legal liability?
    - impact: unsure, need to ask Chris
  - locker can set uid types to be anything, including invalid UID values
    - impact: negligible but fixing it will improve code quality
  - 🟢 locker can get around the "has balance" requirement because it only checks the first slice
    - they can create pool, immediately lock the first slice, and initialize the second slice
    - as deposits come in for the second slice, they can change the allowed uid types at will
    - impact: these actions give no benefit to the borrower, it only inconveniences the depositors and warbler.
      Thankfully we can recoup the funds by doing an emergency shutdown. This sweeps the depositor's money to
      the protocol reserve which we could then use to make the depositors whole.
  - likelihood of exploit: LOW
    - No financial gain for Borrower (unless they were short GFI?). Only motivation would be to cause issues for Goldfinch
      and harm protocol reputation
    - Our client is hardcoded to deposit to the first slice - if a borrower secretly locked the first slice with 0 deposits
      and initialized the next, attempts to deposit on the client would fail
  - suggested fix 1: prevent allowedUIDTypes from being set after initialization - also check that all uid types are valid
  - suggested fix 2: fix the "has balance" check to check for deposits in all initialized slices

- deposit
  - 🟢 the complexity of analyzing `DepositMade` events will increase
    - Now that approved operators can deposit on behalf of a UID holder, the poolToken `owner` param in `DepositMade` events
      is not necessarily the UID holder. The UId holder can make deposits from an arbitrary number of operator contracts.
      - Questions like "How many deposits has this end user made in a particular pool?",
        "How many deposits has this user end made in any pool?", etc. are harder to answer
        are harder to answer - now we have to look at all possible approved operators for the end user's UID
      - Potential implications for client and how it currently displays info like
        - Displaying total number of depositors on a pool page
        - As a user, viewing all the deposits I have made across pools
    - impact: No security impact. But could potentially increase client/subgraph code complexity
    - suggestion 1: Keep the add new address param to `DepositMade` for `operator`, which is `msg.sender`, and change
      `owner` to be the UID holder?
      - would still need logic to bridge the old and new events into a single stream that can be processed on client/subgraph
      - operator cannot be indexable, as we've already exceeded the max number of indexable params on that event (but this isn't a problem for subgraph)
  - vulnerable to re-entrancy?
    - no
  - follows checks-effects-interactions pattern?
    - yes: state is updated before transferring usdc from depositor to pool

- withdraw
  - vulnerable to re-entrancy?
    - no
  - follows checks-effects-interactions pattern?
    - yes: state is updated before transferring USDC from pool to borrower
  - `WithdrawlMade` event
    - similar impact to `DepositMade`
  - there is a restriction on 0 amount withdrawls. Removing this restriction doesn't break any tests except the tests that assert you can't withdraw
    a zero amount
    - If seemingly nothing else breaks, is it necessary to keep the restriction? Was the motivation for it a desire to err on the side of caution, or something more?

## StakingRewards

### Mutating Functions

- depositAndStake
  - Applies noReentrancy modifier?
    - yes
- unstakeAndWithdraw
  - Applies noReentrancy modifier?
    - yes
- unstakeAndWithdrawMultiple
  - Applies noReentrancy modifier?
    - yes

## SeniorPool

### Mutating Functions

- deposit
  - Applies noReentrancy modifier?
    - yes
  - Flash loans used in conjunction with external AMM pools
    - Tokens of interest are FIDU, USDC, FIDU-USDC LP tokens, & GFI
    - Can staking be use to generate outsized rewards for a large amount of staked FIDU or FIDU-USDC Curve LP tokens?
      - Not in the context of a flash loan, 0 time diff in a single block so staking rewards should always be 0 over course of flash loan
      - Non reentrancy prevents users from calling both stake and unstake in a single transaction
        - This may be different if there is external liquidity for FIDU stake tokens, FIDU-USDC Curve LP tokens, or FIDU-USDC Curve LP Stake tokens
          - Attack vectors via external stake token liquidity would be dependent upon how external liquidity sources price assets.
          - [Brandon] I believe responsibility and risk for external stake token liquidity are held solely by external parties (i.e. external DeFi/AMM protocol designers)
    - Can large FIDU withdrawal at static share price be paired with Curve pool to generate artificial arbitrage opportunity where Curve LPs' funds are at risk?
      - Ex: https://twitter.com/valentinmihov/status/1327750899423440896
      - FIDU share price acts as buy-side price ceiling - unlimited FIDU liquidity at a static buy price
      - Normal Curve pool price mechanics shouldn't be susceptible to price manipulation without committed capital - no perceived risk.

- withdraw
  - Applies noReentrancy modifier?
    - yes

- withdrawInFidu
  - Applies noReentrancy modifier?
    - yes

## Issues

### Opening up `go` to tx.origin

Severity: Informational
We have opened up `go` to tx.origin Go listed users, contingent upon the tx.origin user giving UniqueIdentity#approvedForAll access to the msg.sender.

- Normally, tx.origin access control opens up a much broader surface area of phishing attacks for backers and liquidity providers: https://github.com/ethereum/solidity/issues/683
  - UniqueIdentity#approvedForAll should require users to explicitly approve access to the msg.sender, mitigating some of our phishing concerns.
    - Non-crypto natives would not be familiar with approveForAll, and crypto natives may be confused by our slightly unorthodox usage of approvedForAll.
    - The intended purpose of `approveForAll` for a non transferable NFT is not clear, nor explicitly stated at the time of transaction prompting.
    - [Brandon] I think `approveForAll` for a normal transferable NFT does not do a good enough job of prompting user to understand the implications of the "approveForAll" operation. I think
    - [Brandon] I still think there are concerns with users inadvertently calling approveForAll on a malicious actor's contract, potentially giving them control of user deposited funds or staked positions. Token recipients for mints & stakes are `msg.sender`, regardless of whether tx.origin is used as source of truth for access controll.
- Recommendation is to force users to sign a human-readable message explaining the implications of calling UniqueIdentity#approveForAll for a given address.

# Conclusions

## Action Items

- [GFI-926](https://linear.app/goldfinch/issue/GFI-926/remove-erc20-infinite-approval-on-self-pattern) Remove the pattern of self approving for an infinite amount and using safeTransferFrom(address(this)...), and replace it with calls to safeTransfer()
- [GFI-927](https://linear.app/goldfinch/issue/GFI-927/borrower-can-lock-depositor-funds-low-impact) Fix bug on TranchedPool that allows the borrower to lock up funds

## Discussion points for Opening up `go` to tx.origin

After internal team discussion, the general consensus is that using tx.origin for access control is fine as long as the economic effects of permissioned actions only impact the msg.sender.

e.g. when the tx.origin !== msg.sender and the tx.origin is the UID holder, a FIDU depositor/withdrawal recipient must be the msg.sender and only the msg.sender.

There remains some mild uneasiness with the following issues:

1. Relative lack of clarity of the amount of permission ApproveForAll provides.
   Using ApproveForAll as a flag for delegating UID's to a msg.sender is not immediately clear from the UniqueIdentity contract; someone would need to look over the Go contract as well to understand the impact of ApproveForAll.
   approveForAll flips the boolean result of isApprovedForAll. Because UniqueIdentity's are non-transferable, it could seem like the value of isApprovedForAll, and transitively approveForAll, are unused.

- **Proposed Solution** Add some comments to our Go contract implementation in which we use tx.origin & ApprovalForAll status to check a user for Go permission. Comments should emphasize that:
  - tx.origin is only used, and should only be used for access control.
  - tx.origin should never be used to determine the destination/source address of any economic costs/benefits.

2. A non-UID'ed entity/individual could phish a UID'ed user into calling a smart contract which could then interact with the Goldfinch protocol. Because the economic impact is limited to the msg.sender, in isolation, this sort of phishing attack has limited impact on victims. This seems like a relatively low reward for a very effort costly attack.

- **Conclusion** Monitor but do not need to address.

## Discussion points for addressing events

There were differing opinions on taking action for events like `DepositMade`, and potentially changing the signature to emit both the UID holding address on the operator address

### Against

- We can pull out tx.origin in subgraph code, so no need to add it directly to the event
- Making other contracts aware of the tx.origin vs msg.sender distinction is "leaking" Go implementation details to those contracts
