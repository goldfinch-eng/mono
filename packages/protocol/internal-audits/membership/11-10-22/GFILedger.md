# GFILedger

GFILedger.sol audit

# Summary

I found a couple of medium-severity issues that should be fixed before going to production.

- _tokenByIndex_ off-by-one error

  - **Severity**: 🟡 Medium
  - **Description**: The first valid position id is 1. So the token at position 0 should be 1 and the token at position i should be i + 1.
  - **Suggested Fix**: We should return `index + 1` instead of `index`
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

- _withdraw(uint256,uint256)_ is inaccessible

  - **Severity**: 🟡 Medium
  - **Description**: There's no Orchestrator level fn implemented to call into this fn
  - **Suggested Fix**: Implement partial GFI withdrawals at the orchestrator level
  - **Commit**: [9b5d5a9](https://github.com/warbler-labs/mono/pull/1069/commits/9b5d5a923f071cf54b3ca5324bcc08c0ffaf25e9)

- _deposit_ return value doesn't match return value described in interface

  - **Severity**: 🟢 Informational
  - **Description**: The interface says it returns how much was deposited but the impl returns the position id
  - **Suggested Fix**: Update the impl to conform to the interface or vice versa (probably the latter because current usage
    treats the return value as the position id)
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

- Methods to fetch a position should revert if a position doesn't exist

  - **Severity**: 🟢 Informational
  - **Description**: It would make sense for the method to revert entirely
    if a position doesn't exist. That way the caller doesn't need to validate
    that a position actually exists.
  - **Suggested Fix**: Add an internal helper method like this

    ```solidity
    function _getPosition(uint positionId) internal returns (Position storage) {
      Position storage p = positions[positionId];

      bool positionExists = /* do some validation here */;
      if (!positionExists  {
        revert PositionDoesNotExist();
      }

      return p;
    }
    ```

    and use it throughout the contract

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

## Analysis

### Function-by-function analysis

- ❓ _deposit(address,uint256)_

  - ❓ Return value in interface doesn't match implementation return value
    - The interface says "@return how much was deposited" but the impl returns the token id:
      `return _mintPosition(owner, amount);`. We should fix this inconsistency and I recommend we
      return the position id instead of the amount.
  - How could it break?
    - ✅ Incorrect access controls
      - It's guarded by _onlyOperator_ so the call will fail unless `msg.sender` is a valid operator for
        `address(this)`. That is to say the modifier will revert unless
        `operators[address(GFILedger)][msg.sender] == true`. Access controls check out (assuming delpoyment
        properly grants GFIDirector operator privileges and does not grant any other address operator privileges).
    - ✅ or❓ Minting zero amount positions
      - Lack of validation on the `amount` param means someone can mint an arbitrary amount of 0 GFI positions. And
        since positions cannot be added to, this would be a useless "phantom" position that has the negative effect
        of increasing the total supply without making any meaningful difference to the GFI vault. I don't know why
        someone would do this. In terms of griefing they would only be griefing themselves. Given no obvious motivation
        for doing this, I don't think any action is needed, but leaving it here just in case you can think of something.
    - ✅ Amount deposited is greater than `owner`'s GFI balance.
      - **Analysis**: I am reasonably confident this can't be done
      - Theoretically, the line
        `context.gfi().transferFrom(address(context.membershipOrchestrator()), address(this), amount);` could transfer ALL the GFI held by the membership orchestrator to the ledger, and record
        that amount for `owner`'s position. Let's look further up the call stack to see if `amount`
        can be manipulated to be more than what `owner` actually owns.
        - GFIDirector deposits into GFILedger through it's own _deposit(address,uint256)_ fn. This is a simple pass through. If `amount`
          is manipulable it will have to be further up the call stack.
        - MembershipOrchestrator deposits into GFIDirector through _depositGFI(uint256)_. The `amount` parameter is
          constrained by `msg.sender`'s balance by `context.gfi().transferFrom(msg.sender, address(this), amount);`
          in _\_depositGFI(uint256)_.
    - ✅ Owner's `totals().totalAmount` changes by incorrect amount
      - `totals[owner].recordIncrease(amount);` does in fact increase `owner`'s `totalAmount` by `amount`, so this
        checks out.
    - ✅ GFI balance increase != owner totals increase
      - `amount` worth of GFI is transfered to GFILedger and `owner`'s `totalAmount` also increases by `amount`, so
        this checks out.

- _withdraw(uint256)_

  - How could it break?
    - ✅ Retval as described in IGFILedger doesn't match retval in impl
      - Interface says retval is the amount withdrawn and this is the same as the impl. It checks out.
    - ✅ Incorrect access controls
      - Callable by a non-operator
        - It's guarded by onlyOperator. This checks out
    - ✅ Wrong amount is withdrawn
      - Amount withdrawn > owner's max withdrawable
        - This would cause the owner to steal other depositors' GFI.
      - Amount withdrawn < owner's max withdrawable
        - This would cause the owner to lose GFI because their position info would be wiped without having
          withdrawn their full position.
      - For analysis we look at _\_withdraw(uint256)_
        - The impl transfers the whole position amount to the owner via `context.gfi().transfer(position.owner, position.amount);`.
          Furthermore it clears the position via `delete positions[id];` and the array removal, which prevents `owner` from being
          able to withdraw multiple times on the same position. This behavior looks correct but there's no unit test for it, so I
          added the test skeleton and my recommendation is to implement it.
    - ✅ `owner`'s `totals().totalAmount()` decreases by too much or too little
      - The impl calls _recordDecrease_ for the `owner` with `position.amount`. This is the corret amount for the position
    - ✅ `owner`'s `totals().eligibleAmount()` decreases by too much or too little.
      - If the position was created in a previous epoch, then it decreases by `position.amount`. This checks out.
      - If the position was created in the current epoch, then it doesn't decrease. This checks out.
    - ❓ Doesn't decrease _totalSupply()_ when a position is fully withdrawn
      - See analysis for _totalSupply()_. It doesn't decrease total supply, although it should.
    - ✅ position info not properly deleted
      - Position is deleted from the positions array and also the owners array. This checks out

- ❓ _withdraw(uint256,uint256)_

  - General Comments
    - ❓ It's inaccessbile by end users. The only GFI withdrawal function supported at the MembershipOrchestrator level
      is _withdrawGFI(positionId)_. **Recommendation** Implement _withdrawGFI(positionId,amount)_ in MembershipOrchestrator
      so users can specify their withdrawal amounts in GFI withdrawals.
  - How could it break?
    - ✅ Incorrect access controls
      - Guarded by onlyOperator modifier. Checks out.
    - ✅ Allows you to withdraw more than the position amount
      - It reverts with InvalidWithdrawAmount if the amount requested exceeds the position. Furthermore it follows the
        checks-effects-interactions pattern: `positions[id].amount -= amount` occurs before the gfi transfer. This eliminates
        potential re-entrancy attacks where one could repeatedly transfer out GFI without decreasing their amount. Further
        evidence of resistance to re-entrancy is the external entrypoint _MembershipOrchestrator#withdrawGfi(uint256)_ has
        the _nonReentrant_ modifier. With these facts in mind I'm pretty confident you cannot withdraw more than your
        position amount
    - ✅ Has the wrong return value
      - Retval in impl matches retval described in IGFILedger. Checks out
  - ❓ I noticed you're allowed to withdraw a 0 amount. We've enforced "no zero deposits or withdrawals" in past contracts
    but I'm not sure if it matters. Yeah a GFIWIthdrawal with an amount of 0 is emitted but that's not harming anyone. I
    can't see any reason why someone would do it. They can't use it for a griefing attack either.
  - ❓ There's a lot of code duplication in _\_withdraw(uint256)_ and this one - swapping in the array, emitting
    the event, and recording the decrease I think reusing the logic would in a single internal _\_withdraw()_
    fn is easier to reason about, and reduce the chance for bugs from having to update logic in two places. Example implementation:

    ```
    function withdraw(uint256 tokenId) external onlyOperator returns (uint256) {
      return _withdraw(tokenId, positions[tokenId].amount);
    }

    function withdraw(uint256 id, uint256 amount) external onlyOperator returns (uint256) {
      Position memory position = positions[id];
      if (amount > position.amount) revert InvalidWithdrawAmount(amount, position.amount);
      return _withdraw(id, amount);
    }

    function _withdraw(uint256 id, uint256 amount) private returns (uint256) {
      Position memory position = positions[id];

      positions[id].amount -= amount;
      totals[position.owner].recordDecrease(amount, position.depositTimestamp);

      if (positions[id].amount == 0) {
        _deletePosition(id);
      }

      context.gfi().transfer(position.owner, position.amount);
      totals[position.owner].recordDecrease(position.amount, position.depositTimestamp);

      emit GFIWithdrawal({
        owner: position.owner,
        tokenId: id,
        withdrawnAmount: position.amount,
        remainingAmount: 0,
        depositTimestamp: position.depositTimestamp
      });

      return amount;
    }

    function _deletePosition(uint256 id) internal {
      Position memory position = positions[id];
      delete positions[id];
      {
        // Remove token from owners array
        uint256[] memory ownedPositions = owners[position.owner];
        uint256 replacerTokenId = ownedPositions[ownedPositions.length - 1];

        owners[position.owner][position.ownedIndex] = replacerTokenId;
        positions[replacerTokenId].ownedIndex = position.ownedIndex;
        owners[position.owner].pop();
      }
    }
    ```

- ✅ _tokenOfOwnerByIndex(owner, index)_

  - How could it break?
    - ✅ Does not revert given an invalid `index` for `owner`. If `owner has n tokens then invalid indices are index >= n.
      - ✅ If `owner` has zero deposits then `owners[owner]` is an uninitialized array. Calling _tokenOfOwnerByIndex_ will
        revert for all n >= 0, which is correct.
      - ✅ If `owner` has n >= 0 tokens and makes a deposit then the range of valid indices should increase by 1
        from `[0, ..., n-1]` to `[0, ..., n]`:
        - _deposit(owner,amount)_ calls _\_mintPosition(owner,amount)_ which unconditionally appends `id` to the `owners[owner]`
          array. `owners[position.owner].length` increases by 1 and _tokenOfOwnerByIndex_ reverts for index > n as expected
      - ✅ If `owner` has n > 0 tokens and fully withdraws a token then the range of valid indices should
        decrease by 1 from `[0, ..., n-1]` to `[0, ..., n-2]`:
        - ✅ _withdraw(id)_ unconditionally pops from the `owners[position.owner]` array. `owners[position.owner].length` decreases
          by 1 and _tokenOfOwnerByIndex_ reverts for index > n-2 as expected.
        - ✅ _withdraw(id,amount)_ calls _withdraw(id)_ if and only if `amount` is the full position amount. `owners[position.owner].length`
          decreases by 1 and _tokenOfOwnerByIndex_ reverts for index > n-2 as expected.
        - ✅ _withdraw(id,amount)_ doesn't push or pop the `owners[position.owner]` array for partial withdrawals. `owners[position.owner].length`
          is unchanged and _tokenOfOwnerByIndex_ reverts for index > n-1 as expected.
      - ✅ The range of valid tokens should not increase or decrease under any other circumstances
        - there is no other part of the code that pushes/pops `owners[position.owner].length`
    - ✅ Returns an id NOT owned by `owner`, given a valid `index` for `owner`. After establishing it reverts for non-valid indices we should
      establish that the return value for every valid index is a tokenId owned by `owner`. This would be true if there was a tokenId in
      `id = owners[owner]` such that `positions[id].owner != owner`. Let's verify that whenever `positions[id].owner` is set, that same id
      is pushed onto the owner's positions array, and vice versa
      - `positions[id].owner` is set to `owner` in _\_mintPosition()_. On the next line we have `owners[owner].push(id)`. Also, the index
        of `id` in the array is recorded in `positions[id].ownedIndex`.
      - `positions[id].owner` is set to `address(0)` in _\_withdraw()_. On the next few lines, `id` is deleted from the owner array.
      - There are no other places where `positions[id].owner` is set or `id` is added or removed from the array.
      - Having identified all the situations where `positions[id].owner` is set or `id` is added to the owner array and showing that they
        are always set together, I can be reasonably confident that `tokenOfOwnerByIndex(owner,index)` returns a tokenId owned by `owner`
        for every valid `index`.

- 🛑 _tokenByIndex(index)_

  - How could it break?
    - ❓ Returns non-zero id for non-existent index
      - In the _totalSupply()_ we showed that tokens aren't properly burned. Consider this minimal example
        - User makes the very first deposit (id = 1), then fully withdraws. _totalSupply()_ doesn't decrease
          on withdrawal so calling _tokenByIndex(1)_ returns 1 even though that position doesn't exist anymore
    - 🛑 Returns incorrect non-zero id for valid index
      - OFF BY ONE ERROR: Simple example: User makes the very first deposit (id = 1) and then I call _tokenByIndex(0)_.
        It returns 0, but it should be 1.
    - ✅ Reverts for a valid index
      - It reverts if `index > totalSupply()`. We established in the _totalSupply()_ analysis that `totalSupply() >= true supply`.
        If _totalSupply()_ is always greater than or equal to the true supply then there is no valid index in the true supply that
        could exceed the total supply, so the function can't revert for valid indices
    - ❓ Doesn't revert for an invalid index
      - We established in the _totalSupply()_ analysis that indices are not properly burned on withdrawal, so the behavior is incorrect.
        Example: User makes very first deposit (id = 1) and then fully withdraws. `tokenByIndex(0)` returns 0 instead of reverting.

- ✅ _totalsOf(id)_

  - How could it break
    - ✅ Returns non-zero total for address with no deposits
      A non-existent position is a position for which `addr` has never deposited (case 1) or `addr` has deposited but has fully
      withdrawn.
      - Case 1: If `addr` never deposited then `totals[addr]` is uinitialized. This means `totalAmount == 0` and `eligibleAmount == 0`.
        If they're both 0 then `totals[addr].getTotals()` will return `(0, 0)`, which is correct.
      - Case 2: If `addr` has fully withdrawn then _\_withdraw(id)_ must have been called. This unconditionally sets decreases `addr`'s
        totals: `totals[position.owner].recordDecrease(position.amount, position.depositTimestamp);`.
        - If the current epoch is the deposit epoch then _recordDecrease_ decreases `totalAmount` to 0 (decrease by the full position
          amount). It doesn't have to decrease `eligibleAmount` because it's already 0. A subsequent call to `totals[addr].getTotals()`
          will return `(0, 0)`, which is correct.
        - If the current epoch is NOT the deposit epoch then _recordDecrease_ decreases `totalAmount` and `eligibleAmount` to 0 (decrease
          by the full position amount). A subsequent call to `totals[addr].getTotals()` will return `(0, 0)`, which is correct.
    - ✅ Returns total too high or too low for a valid position id
      - If the total is too high or too low then either the `totalAmount` or `eligibleAmount` is too high or too low. When `addr` deposits,
        `totals[addr].totalAmount` is set to the deposited amount and `totals[addr].eligibleAmount` is 0. A call to `getTotals()` in the
        current epoch will return `(total.eligibleAmount, total.totalAmount) = (0, depositAmount)` which is correct. In a subsequent epoch
        but before a checkpoint a call to `getTotals()` will return `(total.totalAmount, total.totalAmount) = (depositAmount, depositAmount)`,
        which is correct. In a subsequent epoch after a checkpoint (the only way to trigger a checkpoint would be a withdrawal) a call to
        `getTotals()` returns `(total.eligibleAmount, total.totalAmount)` = `(depositAmount - withdrawAmount, depositAmount - withdrawAmount)`,
        which is correct.

- ✅ _ownerOf(id)_

  - How could it break?
    - ✅ Returns non-zero address for a non-existent position
      A non-existent position is a position for which `id` has never been minted (case 1) or `id` has been minted but was fully
      withdrawn (case 2).
      - case 1: If the `id` has never been minted then the position struct was never written to the `positions` mapping. If it was
        never written to the mapping then it has uninitialized values and `positions[id].owner == address(0)`, which is correct.
      - case 2: If the `id` has been fully withdrawn then _\_withdraw(id)_ was executed. This unconditionally deletes `positions[id]`
        from the mapping, which zeros out the struct and makes `positions[id].owner == address(0)` once again. This is correct
    - ✅ Returns incorrect address for a valid position
      - A valid position would be an `id` that has been minted but not fully withdrawn. When `owner` deposits, the position is
        minted through _\_mintPosition(owner, amount)_. This sets `positions[id].owner = owner`, which is correct.

- ✅ _balanceOf(address)_

  - How could it break?
    - ✅ Retval is greater than the true balance or retval is less than the true balance
      **Analysis**: The true balance should increase by 1 for every deposit and decrease by 1 for every FULL withdrawal. Since
      the retval is `owners[addr].length`, the retval is correct if and only if the array length increases by 1 for every deposit
      from `addr` and decreases by 1 for every FULL withdrawal by `addr`.
      - In _deposit(owner,amount)_ the position is minted. In _\_mintPosition(owner, amount)_ we unconditionally push on the
        `owners[addr]` array, increasing the balance by 1. This checks out.
      - In _withdraw(tokenId)_ we call _\_withdraw(tokenId)_ which unconditionally pops the `owners[position.owner]` array, decreasing
        the balance by 1. This checks out.
      - In _withdraw(id,amount)_ we call _\_withdraw(tokenId)_ if and only if `amount` matches the full position amount. As we've already
        seen this will pop from the array, decreasing the balance by 1. If `amount` doesn't match the full position amount then the array
        is unchanged. This behavior checks out.
    - ✅ Incorrect default values
      - Since all mappings are zero initialized, the default balance for an `addr` that has never deposited is 0, which is correct.

- ❓ _totalSupply()_

  - How could it break?
    - It can break if ret val > true total supply or ret val < true total supply. Since the ret val of _totalSupply()_ is
      `tokenCounter` we will look at how `tokenCounter` changes when positions are created and destroyed.
    - **Analysis**: The ret val `tokenCounter` is insufficient to track the true total supply of tokens.
      Each full withdrawal causes the return value of _totalSupply()_ to drift from the true total supply
      by 1. This error will surface in _GFIDirector#totalSupply()_ but it's unclear whether this is a security
      vulnerability because our contracts do not call _GFIDirector#totalSupply()_.
      - `tokenCounter` initial value
        - `tokenCounter` is initialized to 0 during contract deployment. This matches the true total supply of 0
          because no positions have been minted yet.
      - Creating a position through _deposit(address,uint256)_
        - _\_mintPosition()_ is called. It increments the token counter and increases the actual total supply
          by 1. Thus _\_mintPosition()_ keeps `tokenCounter` aligned with the true total supply.
      - Withdrawing a position
        - _withdraw(uint256)_ withdraws an entire position. We can see in _\_withdraw(uint256)_ that the
          position is **deleted**: it's popped from the array in the `owners` mapping and deleted from the
          `positions` mapping. Despite this deletion, `tokenCounter` is unaffected. Therefore calling
          _withdraw(uint256)_ decreases the true total supply of tokens without decreasing `tokenCounter`.
          _totalSupply()_'s ret val is now than the true total supply.
        - _withdraw(uint256,uint256)_ withdraws up to an entire position. If you withdraw your full position
          then it calls _\_withdraw(uint256)_, which we've already seen is problematic. If you partially withdraw
          your position then nothing is deleted and `tokenCounter` is unchanged, which is correct behavior.

- ✅ _\_mintPosition(owner,amount)_
  - ✅ Fairly confident in the correctness of this one given the _deposit_ analysis
  - ✅ How could it break?
    - Invalid access controls
      - It's `private`, which checks out

### Variables

- _positions_

  - can be made internal. this will reduce contract bytecode size and is better encapsulation

- _owners_
  - can be made internal. this will reduce contract bytecode size and is better encapsulation

## Pre-audit checklist

### Legend

- ✅ Looks good
- 🚧 No action needed but good to be aware of
- 🛑 Action needed
- ⚪ Not applicable

### Checks

- ✅ Testing and compilation

  - ✅ Changes have solid branch and line coverage
    - 🚧 Missing tests for tokenOfOwnerByIndex and tokenByIndex. Having tests here isn't critical because they're view functions
      But recall the bug we found in tokenByIndex... Well, overall test coverage looks solid
  - ✅ Tests for event emissions
    - ✅ GFIDeposit and GFIWithdrawal covered
  - ⚪ Mainnet forking tests
  - ✅ Contract compiles without warnings
  - ✅ Any public fns not called internally are `external`

- ✅ Documentation

  - ✅ All `external` and `public` functions are documented with NatSpec
  - ⚪ If the behavior of existing `external` and `public` functions was changed then their NatSpec was updated

- Access Control

  - ✅ Permissions on external functions checkout
    - ✅ All non-view external functions should have _onlyOperator_ because this is a Ledger contract
  - ✅ New roles are documented
    - See _AccessControl.sol_
  - ✅ An event is emitted when roles are assigned or revoked
    - See _AccessControl.sol_

- ✅ For the auditors

  - Implicit security assumptions the changes rely on are documented
    - For functions guarded by onlyOperator, the operator was set to the correct protocol owned orchestrator contract
  - ⚪ Critical areas are called out
    - N/A because this is a whole contract audit
  - ⚪ Library dependency release notes checked for vulnerabilities

- ✅ Proxies

  - ⚪ Changes to upgradeable contracts don't cause storage collisions

- Safe Operations

  - 🛑 Using SafeERC20Transfer for ERC20 transfers
    - Not using SafeERC20Transfer for GFI transfers
  - ⚪ Using SafeMath for arithmetic
    - N/A because Sol version >= 8.0
  - ⚪ Using SafeCast
  - ⚪ Unbounded arrays: no iterating on them or passing them as params
  - ⚪ Division operations appear at the end of a computation to minimize rounding error
  - ⚪ Not using build in _transfer_
  - ⚪ Untrusted input sanitization
  - ⚪ State updates doen BEFORE calls to untrusted addresses
  - ✅ Follows checks-effects-interactions pattern
    - ✅ _deposit_
    - ✅ _withdraw(uint256)_
    - ✅ _withdraw(uint256,uint256)_
  - Inputs to `external` and `public` fns are validated
    - ✅ _deposit_
      - GFILedger trusts that `owner` was validated at the Orchestrator Level. Looking at MembershipOrchestrator we see
        that the GFI depositor `msg.sender` is used as the `owner` when GFILedger#deposit is called. The `amount` param
        is validated because _transferFrom_ fails if `owner` doesn't have that amount.
    - ⚪ _withdraw(uint256)_
    - ⚪ _withdraw(uint256,uint256)_
  - ⚪ `SECONDS\_PER\_YEAR` leap year issues

- Speed bumps, circuit breakers, and monitoring

  - ✅ Do there need to be any delays between actions?
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
    - 🚧 _GFIDeposit_ is emitted but doesn't include total position amount. Left a comment in the PR. I
      also think `depositTimestamp` is unnecessary because it's the same as `block.timestamp` when the
      event was emitted. This is readily accessible in the graph.
    - ✅ _GFIWithdrawal_ is emitted with relevant parameters

- Protocol integrations
  - ✅ Assessing the impact of these changes on protocol integrations
    - There aren't any protocol integrations because this is a greenfield project

## External Functions

### `deposit`

- [x] onlyOperator
- [x] transfers GFI
- [x] creates a position

### `withdraw`

- [x] onlyOperator
- [x] transfer GFI to owner
- [x] deletes position when fully withdrawing
- [x] does not delete the position when partially withdrawing

### External View Functions

### `balanceOf`

### `totalsOf`

### `positions`

- 🚑 Consider making this revert if a position doesnt exist

### `ownerOf`

- 🚑 Consider making this revert if a position doesnt exist

calls

## Issues

- 🚑 For a number of methods that fetch a position, it would make sense for the
  method to revert entirely if a position doesn't exist. That way the caller
  doesn't need to validate that a position actually exists. To make this easier
  I would suggest adding an internal helper method like this

  ```solidity
  function _getPosition(uint positionId) internal returns (Position storage) {
    Position storage p = positions[positionId];

    bool positionExists = /* do some validation here */;
    if (!positionExists  {
      revert PositionDoesNotExist();
    }

    return p;
  }
  ```

  and use it throughout the contract
