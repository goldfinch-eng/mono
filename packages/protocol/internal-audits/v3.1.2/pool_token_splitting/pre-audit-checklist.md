# Pre-audit Checklist

Auditor: [Carter](https://github.com/carterappleton)

## Legend

🚧 = WIP
✅ = Done
🚫 = Not applicable

## List

**Owner**

- ✅ Testing and compilation
  - ✅ I have written mainnet forking tests for my changes
  - ✅ The contracts compile without errors or warnings
    - There are _some_ compilation warnings but they're all in testing files. This is acceptable.
  - ✅ Public fns restricted to `external` where possible
- ✅ Documentation
  - ✅ All new `external` and `public` fns are documented with NatSpec
  - ✅ If the behavior of existing `external` or `public` fns was changed then their NatSpec was updated
- ✅ Access control
  - ✅ I have double checked the permissions on `external` and `public` fns
    - ✅ `PookTokens`
      - ✅ mint(): onlyPool
      - ✅ burn(): callable by the pool, token owner, or token approval
      - ✅ getPoolInfo(): view
      - ✅ splitToken(): callable by token owner or token approval
    - ✅ `BackerRewards`
      - ✅ setBackerAndStakingRewardsTokenInfoOnSplit(): onlyPoolTokens (msg.sender must be config's PoolTokens address)
      - ✅ clearTokenInfo(): onlyPoolTokens
      - ✅ getBackerRewardsTokenInfo(): view
      - ✅ getBackerStakingRewardsTokenInfo(): view
      - ✅ getBackerStakingRewardsPoolInfo(): view
      - ✅ poolTokenClaimableRewards(): view

**Auditors**

- ✅ critical areas for the auditors to focus on are called out
- 🚫 Library Dependencies
- ✅ Proxies
  - ✅ Changes to upgradeable contracts do not cause storage collisions
- ✅ Safe Operations
  - 🚫 Using SafeERC20TRansfer
  - ✅ Using SafeMath for arithmetic
  - 🚫 Using SafeCast for casting
  - ✅ No iterating on unbounded arrays or passing them around as params
  - ✅ Arithmetic performs division steps at the end to minimize rounding errors
  - ✅ Not using the built-in transfer fn
  - ✅ All user-input addresses are verified before instantiating them in a contract (e.g. `CreditLine(userSuppliedAddress)`)
    - Only externally-input address is for pool token minting, and uses the address to mint to
  - ✅ State updates are done BEFORE calls to untrusted addresses
    - Minting uses `_mint` not `_safeMint` so there's no untrusted call
  - ✅ Inputs to `external` and `public` fns are validated
    - ✅ `PookTokens`
      - ✅ mint(params, to):
        - trusted, only pool can call
        - even if there were an adversarial pool, tokens are pool-specific so there wouldn't be cross contamination
      - ✅ burn(tokenId):
        - trusted, only owning pool, owner or approved can call
        - even if there were an adversarial pool, tokens are pool-specific and can't be burnt if there is redeemable remaining
      - ✅ getPoolInfo(pool):
        - view
      - ✅ splitToken(tokenId, newPrincipal1, newPrincipal2): callable by token owner or token approval
        - tokenId: required to be owned by msg.sender
        - newPrincipal1 & newPrincipal2: must be greater than 0 and less than token total principal
    - ✅ `BackerRewards`
      - ✅ setBackerAndStakingRewardsTokenInfoOnSplit(tokenId, newTokenId, newRewardsClaimed):
        - trusted, only pool tokens can call
      - ✅ clearTokenInfo(): onlyPoolTokens
        - trusted, only pool tokens can call
      - ✅ getBackerRewardsTokenInfo():
        - view
      - ✅ getBackerStakingRewardsTokenInfo():
        - view
      - ✅ getBackerStakingRewardsPoolInfo():
        - view
      - ✅ poolTokenClaimableRewards():
        - view
  - 🚫 If your feature relies on SECONDS_PER_YEAR then it is not adversely affected by leap years
- ✅ Speed bumps, circuit breakers, and monitoring
  - 🚫 Are any speed bumps necessary? E.g. a delay between locking a TranchedPool and drawing down
  - 🚫 If changes rely on a pricing oracle (e.g. Curve Pool) then a circuit breaker is build in to limit
    the effect of drastic price changes
  - ✅ Events are emitted for all state changes
    - ✅ Events are emitted for
      - ✅ `PookTokens`
        - ✅ mint(params, to):
          - calls \_createToken which emits event
        - ✅ burn(tokenId):
          - calls \_destroyAndBurn which emits event
        - ✅ splitToken(tokenId, newPrincipal1, newPrincipal2): callable by token owner or token approval
          - no specific splitting event, but there are events for burning and minting of tokens whichs is sufficient
      - ✅ `BackerRewards`
        - ✅ setBackerAndStakingRewardsTokenInfoOnSplit(tokenId, newTokenId, newRewardsClaimed):
          - no events, none expected
        - ✅ clearTokenInfo(): onlyPoolTokens
          - no events, none expected
- ✅ Third party integrations
  - ✅ I have assessed the impact of changes (breaking or non-breaking) to existing
    functions on 3rd party protocols that have integrated with Goldfinch.
    - Taken care of by posting in the discord to warn community about the breaking changes
