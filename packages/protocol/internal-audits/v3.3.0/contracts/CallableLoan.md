- UncalledCapitalInfo `principalReserved`
  - Is this necessary for a technical reason or to be consistent with the concept of reserved
    principal in the CallRequestPeriod tranches? Could we pay down Uncalled tranch principal
    right away instead of reserving it first?

- _submitCall_
  - Allows you to submit a call even when the loan is fully paid off
    - I believe this is a symptom of LoanState being incomplete
    - What's the impact?

- _initialize_
  - Should enforce that _numLockupPeriods < periodsPerPrincipalPeriods
  
- Drawdown
  - Can they drawdown again after the term end time?
    - No they cannot. I wrote a test to prove it
      ```
      function testCannotDrawdownAfterTermEndTime() public {
        uint128 depositAmount = uint128(usdcVal(100));
        setupFullyFundedAndDrawndown(depositAmount);
        CallableCreditLine storage cpcl = callableCreditLine.checkpoint();
        vm.warp(cpcl.termEndTime());
        assertEq(cpcl.principalOwed(), depositAmount);
        uint256 totalOwed = cpcl.principalOwed() + cpcl.interestOwed();
        cpcl.pay({principalPayment: cpcl.principalOwed(), interestPayment: cpcl.interestOwed()});

        // Past term end time and we can drawdown!!
        cpcl.drawdown(uint256(100));
      }
      ```
      It reverts because the loan state is "InProgress" and it only allows drawdowns
      during the drawdown period.
    - But what if everything is paid back AND we're still in the drawdown period?
      