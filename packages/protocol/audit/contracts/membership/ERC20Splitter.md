# ERC20Splitter

## Functions

### `constructor`
* doesn't need an initializer because all of the fields being initialized in the constructor are immutable

### `pendingDistributionFor`

Returns the amount that will be distributed to a given address if distribute were called

### `distribute`

- [x] Vulnerable to re-entrancy attacks?
  - No. 1) you cannot call distribute mutiliple times within the same TX.
  `lastDistributionAt` is used effectively as a non-reentrancy gaurd. 2) there
  is no internal accounting updating to keep track of. The entire balance of the
  splitter is paid out on every call of distribute. 3) `payees` are most likely
  trusted addresses, so even if it was vulnerable to reentrancy attacks it
  wouldn't matter.
  - If you were the first payee and you re-entered `distribute` you could have multiple calls to `usdc.safeTransfer` invoked where
    you would receive your share of the remaining balance. Example:
    Given these shares
    | Bob    | Alice  | 
    |:-------|:-------|
    |1 (25%) | 3 (75%)|

    Imagine Bob is the first payee and has set his payee contract to call
    `distribute` onReceive. Currently there are 10 USDC in the splitter.

    `distribute()`
    -> balanceForBob = 0.25 * 10 = 2.5
    -> `usdc.transferTo(balanceForBob, bob)`
    -> `bob.onReceive(balanceForBob)`
      -> `distribute()`
        -> balanceForBob = 7.5 * 0.25 = 1.875
        -> `usdc.transferTo(balanceForBob, b)`
        -> `bob.onReceive(balanceForBob)`
          -> ...

    Bob would have more than the amount of usdc expected to be sent to him
    within the tx, but eventually the tx would revert because when the
    re-entrant loop eventually is terminated the contract will try to send the
    USDC that should have been sent to alice because the amount that is going to
    be distributed is saved _before_ calling the on receive hook.

    -> return from `bob.onReceive`
    -> balanceForAlice = 0.75 * 10 = 7.5
    -> `usdc.safeTransfer(balanceForAlice, alice)`
      -> REVERT, not enough USDC balance

    This has the effect that a malicious payee could prevent the contract from distributing by causing the contract
    to revert over and over again, but this is true regardless because a payee can just revert `onReceive`


### `replacePayees`

* onlyAdmin

Replaces all of the payees and the amount that is distributed to them.

* Allows for shares to be `0` for a given caller
  - This will result in nothing being distributed to the caller though, so it
  doesn't effect correctness.
* Allows the zero address to be passed
  - This will result in the splitter reverting on calls to `distribute` because the zero address
    won't correctly handle `IERC20SplitterReceiver.onReceive`. No funds will be lost and an admin action
    will be needed to update the payee, but this is fine.
