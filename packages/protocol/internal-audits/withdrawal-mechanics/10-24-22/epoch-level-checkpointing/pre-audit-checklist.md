# Pre-audit Checklist

Auditor: [Dalton](https://github.com/daltyboy11)

In this section we go through the [audit checklist](internal-audits/withdrawal-mechanics/withdrawal-mechanics-audit.md)

## Legend

🚧 = WIP
✅ = Done
🚫 = Not applicable

## List

- ✅ Testing and compilation
  - ✅ Changes have 100% line and branch coverage
    - Generated coverage data using `forge coverage --match-contract SeniorPoolTest --report lcov`. Then I generated the html report
      using `genhtml lcov.info`. Initial line coverage was 93.2%. We were missing tests for initialization and epoch initialization. After
      adding them in line coverage is at 99.6% and I'm satisfied with that.
  - ✅ I have written mainnet forking tests for my changes
  - ✅ The contracts compile without errors or warnings
    - There are _some_ compilation warnings but they're all in testing files. This is acceptable.
  - ✅ Public fns restricted to `external` where possible
- ✅ Documentation
  - ✅ All new `external` and `public` fns are documented with NatSpec
  - ✅ If the behavior of existing `external` or `public` fns was changed then their NatSpec was updated
- ✅ Access control
  - ✅ I have double checked the permissions on `external` and `public` fns
    - ✅ `ISeniorPoolEpochWithdrawals`
      - ✅_setEpochDuration: onlyAdmin
      - ✅ \_initializeEpochs: onlyAdmin
        - There's no reason why it needs onlyAdmin because the require statement will make it revert after the firt call. There's also no harm in keeping it.
      - ✅ requestWithdrawal: callable by KYC'd addresses, cannot be called by address with existing token
      - ✅ addToWithdrawalRequest(): callable by KYC'd address who owns the token
      - ✅ cancelWithdrawalRequest(): callable by KYC'd address who owns the token
      - ✅ claimWithdrawalRequest(): callable by KYC'd address who owns the token
    - ✅ `WithdrawalRequestToken`
      - ✅ initialize: onlyInitializer
      - ✅ mint(), burn(): onlySeniorPool,
      - ✅ approve(), setApprovalForAll(), transferFrom(), safeTransferFrom(): revert unconditionally
- ✅ For the auditors
- ✅ critical areas for the auditors to focus on are called out
- 🚫 Library Dependencies
- ✅ Proxies
  - ✅ Changes to upgradeable contracts do not cause storage collisions
- ✅ Safe Operations
  - ✅ Using SafeERC20TRansfer
  - ✅ Using SafeMath for arithmetic
    - There are a couple places where we don't use SafeMath because we don't think it's necessary. We don't use SafeMath for incrementing `_checkpointedEpochId`
      because it starts from 0 and is incremented by 1 at the end of each epoch duration. We don't use SafeMath for incrementing a request's `epochCursor` for the
      same reason
  - ✅ Using SafeCast for casting
    - Added SafeCast for converting the writedown amount from `int256` to `uint256`
  - ✅ No iterating on unbounded arrays or pasing them around as params
    - We can consider the for loops in \_previewWithdrawRequestCheckpoint and
      \_applyWithdrawalRequestCheckpoint to be semi unbounded. They're theoretically
      unbounded but Goldfinch will be long out of business before they reach a number
      of iterations that cannot be executed in a single block.
  - ✅ Arithmetic performs division steps at the end to minimize rounding errors
  - ✅ Not using the built-in transfer fn
  - 🚫 All user-inputted addresses are verified before instantiating them in a contract (e.g. `CreditLine(userSuppliedAddress)`)
    - The changes to not instantiate any contracts from user supplied addresses
  - 🚫 State updates are done BEFORE calls to untrusted addresses
    - The senior pool does not call any untrusted contracts
  - ✅ Inputs to `external` and `public` fns are validated
    - ✅ setEpochDuration
      - ✅ Check epochDuration > 0
    - ✅ requestWithdrawal
      - ✅ Check request amount doesn't exceed caller's fidu balance
        - We don't check explicitly, but if the user doesn't have sufficient balance
          then the safeTransferFrom call will revert
    - ✅ addToWithdrawalRequest
      - ✅ Check that request amount doesn't exceed caller's fidu balance
        - Like requestWithdrawal, we don't check explicitly
      - ✅ Check that caller owns tokenId
    - ✅ cancelWithdrawalRequest
      - ✅ Check that caller owns tokenId
    - ✅ claimWithdrawalRequest
      - ✅ Check that caller owns tokenId
  - 🚫 If your feature relies on SECONDS_PER_YEAR then it is not adversely affected by leap years
- ✅ Speed bumps, circuit breakers, and monitoring
  - 🚫 Are any speed bumps necessary? E.g. a delay between locking a TranchedPool and drawing down
  - 🚫 If changes rely on a pricing oracle (e.g. Curve Pool) then a circuit breaker is build in to limit
    the effect of drastic price changes
  - ✅ Events are emitted for all state changes
    - ✅ Events are emitted for
      - ✅ requestWithdrawal (WithdrawalRequested)
      - ✅ addToWithdrawalRequest (WithdrawalAddedTo)
      - ✅ cancelWithdrawalRequest (WithdrawalCanceled)
      - ✅ claimWithdrawalRequest (Withdraw - reusing existing event)
      - ✅ setEpochDuration
- ✅ Third party integrations
  - ✅ I have assessed the impact of changes (breaking or non-breaking) to existing
    functions on 3rd party protocols that have integrated with Goldfinch.
    - Taken care of by posting in the discord to warn community about the breaking changes
