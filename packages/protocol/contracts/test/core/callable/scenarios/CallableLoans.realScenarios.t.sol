// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase
// solhint-disable reentrancy
// solhint-disable contract-name-camelcase

pragma solidity ^0.8.0;

import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {ICreditLine} from "../../../../interfaces/ICreditLine.sol";
import {ICallableLoan, LoanPhase} from "../../../../interfaces/ICallableLoan.sol";
import {ICallableLoanErrors} from "../../../../interfaces/ICallableLoanErrors.sol";
import {IMonthlyScheduleRepo} from "../../../../interfaces/IMonthlyScheduleRepo.sol";
import {ConfigOptions} from "../../../../protocol/core/ConfigOptions.sol";
import {CallableLoanBuilder} from "../../../helpers/CallableLoanBuilder.t.sol";
import {IGoldfinchFactory} from "../../../../interfaces/IGoldfinchFactory.sol";
import {IGoldfinchConfig} from "../../../../interfaces/IGoldfinchConfig.sol";
import {ITestUSDC} from "../../../ITestUSDC.t.sol";
import {Test} from "forge-std/Test.sol";
import {ICreditLine} from "../../../../interfaces/ICreditLine.sol";
import {TestConstants} from "../../TestConstants.t.sol";
import {CallableLoanAccountant} from "../../../../protocol/core/callable/CallableLoanAccountant.sol";
import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";

/**
 * Actor in a Callable loan scenario. Will either be a Lender or a Borrower and
 * can be trusted to complain if they end up with unexpected balances.
 */
abstract contract CallableActor is Test {
  ICallableLoan internal loan;
  ITestUSDC internal usdc;

  function setLoan(ICallableLoan _loan) external {
    loan = _loan;
  }

  function setUSDC(ITestUSDC _usdc) external {
    usdc = _usdc;
  }

  modifier expectUsdcIncrease(uint256 amount) {
    uint256 balanceBefore = usdc.balanceOf(address(this));

    _;

    uint256 balanceAfter = usdc.balanceOf(address(this));
    assertEq(balanceBefore + amount, balanceAfter, "usdc increase");
  }

  modifier expectUsdcDecrease(uint256 amount) {
    uint256 balanceBefore = usdc.balanceOf(address(this));

    _;

    uint256 balanceAfter = usdc.balanceOf(address(this));
    assertEq(balanceAfter + amount, balanceBefore, "usdc decrease");
  }
}

contract CallableBorrower is CallableActor {
  function pay(uint256 amount) external expectUsdcDecrease(amount) {
    usdc.approve(address(loan), amount);
    loan.pay(amount);
  }

  function drawdown(uint256 amount) external expectUsdcIncrease(amount) {
    loan.drawdown(amount);
  }
}

contract CallableLender is CallableActor {
  uint256 public tokenId;
  uint256 public callRequestTokenId;

  function submitCall(uint256 amount) external {
    uint256 balanceBefore = usdc.balanceOf(address(this));
    (uint256 availablePrincipal, uint256 availableInterest) = loan.availableToWithdraw(tokenId);
    (uint256 _callRequestTokenId, uint256 _tokenId) = loan.submitCall(amount, tokenId);
    assertEq(
      balanceBefore + availablePrincipal + availableInterest,
      usdc.balanceOf(address(this)),
      "usdc increase"
    );
    callRequestTokenId = _callRequestTokenId;
    tokenId = _tokenId;
  }

  function deposit(uint256 amount) external expectUsdcDecrease(amount) {
    usdc.approve(address(loan), amount);
    tokenId = loan.deposit(loan.uncalledCapitalTrancheIndex(), amount);
  }

  function withdraw(uint256 amount) external expectUsdcIncrease(amount) {
    // If there's a call request, do that. Otherwise try with the held token
    loan.withdraw(callRequestTokenId == 0 ? tokenId : callRequestTokenId, amount);
  }

  function withdraw(uint256 amount, uint256 tokenId) external expectUsdcIncrease(amount) {
    // If there's a call request, do that. Otherwise try with the held token
    loan.withdraw(tokenId, amount);
  }
}

contract CallableLoans_OneLender_OneBorrower_Test is CallableLoanBaseTest {
  CallableBorrower private borrower;
  CallableLender private lender;
  CallableLender[3] private otherLenders;
  ICallableLoan private loan;
  ICreditLine private creditLine;

  function setUp() public virtual override {
    super.setUp();

    borrower = new CallableBorrower();
    lender = new CallableLender();
    otherLenders[0] = new CallableLender();
    otherLenders[1] = new CallableLender();
    otherLenders[2] = new CallableLender();

    _startImpersonation(GF_OWNER);
    gfConfig.addToGoList(address(borrower));
    gfConfig.addToGoList(address(lender));
    gfConfig.addToGoList(address(otherLenders[0]));
    gfConfig.addToGoList(address(otherLenders[1]));
    gfConfig.addToGoList(address(otherLenders[2]));

    usdc.transfer(address(borrower), usdcVal(1_000_000_000));
    usdc.transfer(address(otherLenders[0]), usdcVal(1_000));
    usdc.transfer(address(otherLenders[1]), usdcVal(1_000));
    usdc.transfer(address(otherLenders[2]), usdcVal(1_000));
    usdc.transfer(address(lender), usdcVal(1_000_000_000));

    _stopImpersonation();

    (CallableLoan _loan, ICreditLine _creditLine) = callableLoanBuilder.build(address(borrower));

    _startImpersonation(GF_OWNER);
    _loan.unpauseDrawdowns();
    _stopImpersonation();

    lender.setLoan(_loan);
    lender.setUSDC(usdc);
    otherLenders[0].setLoan(_loan);
    otherLenders[0].setUSDC(usdc);
    otherLenders[1].setLoan(_loan);
    otherLenders[1].setUSDC(usdc);
    otherLenders[2].setLoan(_loan);
    otherLenders[2].setUSDC(usdc);
    borrower.setLoan(_loan);
    borrower.setUSDC(usdc);

    loan = _loan;
    creditLine = _creditLine;
  }

  function test_depositThenWithdraw() public {
    lender.deposit(100);

    skip(1);

    lender.withdraw(10);
  }

  function test_nothingToDrawdown() public {
    vm.expectRevert(
      abi.encodeWithSelector(ICallableLoanErrors.DrawdownAmountExceedsDeposits.selector, 5, 0)
    );
    borrower.drawdown(5);
  }

  function test_overDrawdown() public {
    lender.deposit(2);

    /* Can't drawdown more */ {
      vm.expectRevert(
        abi.encodeWithSelector(ICallableLoanErrors.DrawdownAmountExceedsDeposits.selector, 3, 2)
      );
      borrower.drawdown(3);
    }

    borrower.drawdown(2);

    /* Can't drawdown more */ {
      vm.expectRevert(
        abi.encodeWithSelector(ICallableLoanErrors.DrawdownAmountExceedsDeposits.selector, 1, 0)
      );
      borrower.drawdown(1);
    }
  }

  function test_availableToCall() public {
    lender.deposit(10e6);
    borrower.drawdown(10e6);

    /* Fast forward past drawdown period */ {
      while (loan.loanPhase() == LoanPhase.DrawdownPeriod) {
        skip(60 * 60 * 24);
      }
      assertTrue(loan.loanPhase() == LoanPhase.InProgress);
    }

    // If this is 10e6, it errors `MustSubmitCallToUncalledTranche`.
    // It should instead complain that tokenId is 0
    lender.submitCall(5e6);
    borrower.pay(2e6);

    assertEq(loan.availableToCall(lender.tokenId()), 5e6);
  }

  function test_availableToWithdraw() public {
    lender.deposit(10e6);
    borrower.drawdown(10e6);

    /* Fast forward past drawdown period */ {
      while (loan.loanPhase() == LoanPhase.DrawdownPeriod) {
        skip(60 * 60 * 24);
      }
      assertTrue(loan.loanPhase() == LoanPhase.InProgress);
    }

    uint256 interestRedeemable;
    uint256 principalRedeemable;

    (interestRedeemable, principalRedeemable) = loan.availableToWithdraw(lender.tokenId());
    assertEq(interestRedeemable, 0);
    assertEq(principalRedeemable, 0);

    /* Fast forward to payment due date */ {
      vm.warp(loan.nextDueTimeAt(block.timestamp));
    }

    borrower.pay(creditLine.interestOwed());

    // in progress ..
  }

  function test_basicFlow() public {
    /* Deposit into loan */ {
      lender.deposit(1000);
      assertTrue(loan.loanPhase() == LoanPhase.Funding);
    }

    /* Partial drawdown */ {
      skip(1);

      borrower.drawdown(950);
      assertTrue(loan.loanPhase() == LoanPhase.DrawdownPeriod);
    }

    /* Can't deposit more */ {
      vm.expectRevert();
      lender.deposit(10);
    }

    /* Drawdown the rest */ {
      skip(1);

      borrower.drawdown(50);
      assertTrue(loan.loanPhase() == LoanPhase.DrawdownPeriod);
    }

    /* Can't drawdown more */ {
      vm.expectRevert();
      borrower.drawdown(10);
    }

    /* Can't deposit more */ {
      vm.expectRevert();
      lender.deposit(100);
    }

    /* Fast forward past drawdown period */ {
      while (loan.loanPhase() == LoanPhase.DrawdownPeriod) {
        skip(60 * 60 * 24);
      }
      assertTrue(loan.loanPhase() == LoanPhase.InProgress);
    }

    /* Immediately submit a call */ {
      lender.submitCall(100);
    }

    /* Pay back call + interest */
    skip(1);
    uint256 estimatedInterest = loan.estimateOwedInterestAt(loan.nextPrincipalDueTime());
    uint256 interestOwedAt = creditLine.interestOwedAt(loan.nextPrincipalDueTime());

    assertEq(estimatedInterest, interestOwedAt);
    borrower.pay(100 + estimatedInterest);

    uint256 calledTrancheInterestPaid = ((100 * estimatedInterest) / 1000);
    uint256 calledTokenInterestAvailableToWithdraw = ((calledTrancheInterestPaid * 90) / (100));

    (uint256 interestRedeemable, uint256 principalRedeemable) = loan.availableToWithdraw(
      lender.callRequestTokenId()
    );
    assertEq(interestRedeemable, calledTokenInterestAvailableToWithdraw, "interest redeemable");
    assertZero(principalRedeemable, "principal redeemable");

    /* Fast forward to just before repayment due date */ {
      vm.warp(loan.nextDueTimeAt(block.timestamp) - 1);
    }

    /* Can't yet claim call principal, only interest paid. */ {
      vm.expectRevert();
      lender.withdraw(calledTokenInterestAvailableToWithdraw + 1);
    }

    /* Now go to repayment date */ {
      vm.warp(loan.nextDueTimeAt(block.timestamp));
    }

    (interestRedeemable, principalRedeemable) = loan.availableToWithdraw(
      lender.callRequestTokenId()
    );
    assertEq(interestRedeemable, calledTokenInterestAvailableToWithdraw, "interest redeemable");
    assertZero(principalRedeemable, "principal redeemable");

    /* Cannot claim call */ {
      vm.expectRevert();
      lender.withdraw(interestRedeemable + 1);
    }

    vm.warp(loan.nextPrincipalDueTime());
    /* Can claim interest and principal */
    // Owed interest on called token is:
    // Tranche interest paid = (tranche deposit size/total deposit size) * estimatedInterest
    // (called deposit size/tranche deposit size) * Tranche interest paid  * (100% - reserve fee percent).
    // In this case, the Tranche interest paid is 100/1000 * estimatedInterest
    // and 100% - reserve fee percent is 100% - 10% = 90 / 100
    {
      lender.withdraw(calledTokenInterestAvailableToWithdraw + 100);
    }
  }

  // Submit call, attempt to pay whole interest
  // Assert that interest is fully paid off, no dust remains.
  function test_interestDustIssue() public {
    /* Deposit into loan */ {
      lender.deposit(usdcVal(1000));
      assertTrue(loan.loanPhase() == LoanPhase.Funding);
    }

    /* Full drawdown */ {
      skip(1);

      borrower.drawdown(usdcVal(1000));
      assertTrue(loan.loanPhase() == LoanPhase.DrawdownPeriod);
    }

    /* Fast forward past drawdown period */ {
      while (loan.loanPhase() == LoanPhase.DrawdownPeriod) {
        skip(60 * 60 * 24);
      }
      assertTrue(loan.loanPhase() == LoanPhase.InProgress);
    }

    /* Immediately submit a call */ {
      lender.submitCall(usdcVal(100));
    }

    /* Pay back call + interest */
    skip(1);
    uint256 interestOwedAt = creditLine.interestOwedAt(loan.nextPrincipalDueTime());

    borrower.pay(usdcVal(100) + interestOwedAt);

    // Interest should remain 0 until next principal due time
    for (uint256 i = 0; i < 2; i++) {
      /* Fast forward to just before repayment due date */
      vm.warp(loan.nextDueTimeAt(block.timestamp) - 1);
      uint256 estimatedInterest = loan.estimateOwedInterestAt(loan.nextPrincipalDueTime());
      uint256 interestOwedAt = creditLine.interestOwedAt(loan.nextPrincipalDueTime());

      assertZero(estimatedInterest, "estimated interest after payment");
      assertZero(interestOwedAt, "estimated interest after payment");
    }
  }

  function callAndRepay(
    CallableLender _lender,
    ICallableLoan _loan,
    ICreditLine _creditLine,
    CallableBorrower _borrower,
    uint256 _totalPrincipal
  ) private {
    /* Immediately submit a call */ {
      _lender.submitCall(100);
    }

    /* Pay back call + interest */
    {
      skip(1);
      uint256 estimatedInterest = _loan.estimateOwedInterestAt(_loan.nextPrincipalDueTime());
      uint256 interestOwedAt = _creditLine.interestOwedAt(_loan.nextPrincipalDueTime());

      assertEq(estimatedInterest, interestOwedAt, "estimated interest");
      _borrower.pay(100 + estimatedInterest);

      uint256 calledTrancheInterestPaid = ((100 * estimatedInterest) / _totalPrincipal);
      uint256 calledTokenInterestAvailableToWithdraw = ((calledTrancheInterestPaid * 90) / (100));

      (uint256 interestRedeemable, uint256 principalRedeemable) = _loan.availableToWithdraw(
        _lender.callRequestTokenId()
      );
      assertApproxEqAbs(
        interestRedeemable,
        calledTokenInterestAvailableToWithdraw,
        1,
        "interest redeemable"
      );
      assertZero(principalRedeemable, "principal redeemable");

      /* Fast forward to just before repayment due date */ {
        vm.warp(_loan.nextDueTimeAt(block.timestamp) - 1);
      }

      {
        vm.expectRevert();
        _lender.withdraw(interestRedeemable + 1);
      }

      /* Now go to repayment date */ {
        vm.warp(_loan.nextDueTimeAt(block.timestamp));
      }

      (interestRedeemable, principalRedeemable) = _loan.availableToWithdraw(
        _lender.callRequestTokenId()
      );
      assertApproxEqAbs(
        interestRedeemable,
        calledTokenInterestAvailableToWithdraw,
        1,
        "interest redeemable"
      );
      assertZero(principalRedeemable, "principal redeemable");

      {
        vm.expectRevert();
        _lender.withdraw(interestRedeemable + 1);
      }

      vm.warp(_loan.nextPrincipalDueTime());
      /* Can claim interest and principal */
      // Owed interest on called token is:
      // Tranche interest paid = (tranche deposit size/total deposit size) * estimatedInterest
      // (called deposit size/tranche deposit size) * Tranche interest paid  * (100% - reserve fee percent).
      // In this case, the Tranche interest paid is 100/1000 * estimatedInterest
      // and 100% - reserve fee percent is 100% - 10% = 90 / 100
      {
        _lender.withdraw(calledTokenInterestAvailableToWithdraw + 100);
      }
    }
  }

  function test_callsAndPaymentsEveryCallRequestPeriod() public {
    /* Deposit into loan */ {
      lender.deposit(1000);
      otherLenders[0].deposit(1000);
      otherLenders[1].deposit(1000);
      otherLenders[2].deposit(1000);
      assertTrue(loan.loanPhase() == LoanPhase.Funding);
    }

    skip(1);
    uint256 drawdownTime = block.timestamp;
    /* Full drawdown */ {
      borrower.drawdown(4000);
      assertTrue(loan.loanPhase() == LoanPhase.DrawdownPeriod);
    }

    /* Fast forward past drawdown period */ {
      while (loan.loanPhase() == LoanPhase.DrawdownPeriod) {
        skip(60 * 60 * 24);
      }
      assertTrue(loan.loanPhase() == LoanPhase.InProgress);
    }

    callAndRepay(lender, loan, creditLine, borrower, 4000);
    callAndRepay(otherLenders[0], loan, creditLine, borrower, 4000);
    callAndRepay(otherLenders[1], loan, creditLine, borrower, 4000);

    /* Pay back remaining uncalled capital + interest */
    {
      skip(1);
      uint256 estimatedInterest = loan.estimateOwedInterestAt(loan.nextPrincipalDueTime());

      uint256 elapsedTime = loan.nextPrincipalDueTime() - drawdownTime;
      assertEq(
        estimatedInterest,
        creditLine.interestOwedAt(loan.nextPrincipalDueTime()),
        "estimated interest"
      );
      borrower.pay(3700 + estimatedInterest);

      uint256 uncalledTrancheInterestPaid = estimatedInterest;

      uint256 uncalledTokenInterestAvailableToWithdraw = ((elapsedTime *
        creditLine.interestApr() *
        1000 *
        90) / (100 * TestConstants.INTEREST_DECIMALS * TestConstants.SECONDS_PER_YEAR));

      (uint256 interestRedeemable, uint256 principalRedeemable) = loan.availableToWithdraw(
        otherLenders[2].tokenId()
      );
      assertApproxEqAbs(
        interestRedeemable,
        uncalledTokenInterestAvailableToWithdraw,
        1,
        "interest redeemable"
      );
      assertZero(principalRedeemable, "principal redeemable");

      /* Fast forward to just before repayment due date */ {
        vm.warp(loan.nextDueTimeAt(block.timestamp) - 1);
      }

      {
        vm.expectRevert();
        otherLenders[2].withdraw(interestRedeemable + 1);
      }

      /* Now go to repayment date */ {
        vm.warp(loan.nextDueTimeAt(block.timestamp));
      }

      (interestRedeemable, principalRedeemable) = loan.availableToWithdraw(
        otherLenders[2].tokenId()
      );
      assertApproxEqAbs(
        interestRedeemable,
        uncalledTokenInterestAvailableToWithdraw,
        1,
        "interest redeemable"
      );
      assertZero(principalRedeemable, "principal redeemable");

      {
        vm.expectRevert();
        otherLenders[2].withdraw(interestRedeemable + 1);
      }

      vm.warp(loan.nextPrincipalDueTime());
      /* Can claim interest and principal */
      // Owed interest on called token is:
      // Tranche interest paid = (tranche deposit size/total deposit size) * estimatedInterest
      // (called deposit size/tranche deposit size) * Tranche interest paid  * (100% - reserve fee percent).
      // In this case, the Tranche interest paid is 100/1000 * estimatedInterest
      // and 100% - reserve fee percent is 100% - 10% = 90 / 100
      {
        otherLenders[2].withdraw(uncalledTokenInterestAvailableToWithdraw + 100);
      }
    }
  }

  function test_callsEveryCallRequestPeriodAndVeryLatePayment() public {
    /* Deposit into loan */ {
      lender.deposit(1000);
      otherLenders[0].deposit(1000);
      otherLenders[1].deposit(1000);
      otherLenders[2].deposit(1000);
      assertTrue(loan.loanPhase() == LoanPhase.Funding);
    }

    skip(1);
    uint256 drawdownTime = block.timestamp;
    /* Full drawdown */ {
      borrower.drawdown(4000);
      assertTrue(loan.loanPhase() == LoanPhase.DrawdownPeriod);
    }

    /* Fast forward past drawdown period */ {
      while (loan.loanPhase() == LoanPhase.DrawdownPeriod) {
        skip(60 * 60 * 24);
      }
      assertTrue(loan.loanPhase() == LoanPhase.InProgress);
    }

    lender.submitCall(100);
    vm.warp(loan.nextPrincipalDueTime());
    otherLenders[0].submitCall(100);
    vm.warp(loan.nextPrincipalDueTime());
    otherLenders[1].submitCall(100);
    vm.warp(loan.nextPrincipalDueTime());

    /* Pay back remaining uncalled capital + interest */
    {
      uint256 estimatedInterest = loan.estimateOwedInterestAt(loan.nextPrincipalDueTime());

      uint256 elapsedTime = loan.nextPrincipalDueTime() - drawdownTime;
      assertEq(
        estimatedInterest,
        creditLine.interestOwedAt(loan.nextPrincipalDueTime()),
        "estimated interest"
      );
      uint256 pastDueInterest = creditLine.interestOwed();
      uint256 guaranteedFutureInterest = CallableLoanAccountant.calculateInterest(
        block.timestamp,
        loan.nextPrincipalDueTime(),
        block.timestamp,
        block.timestamp,
        3700,
        creditLine.interestApr(),
        0
      );
      borrower.pay(pastDueInterest + guaranteedFutureInterest + 4000);

      uint256 uncalledTrancheInterestPaid = estimatedInterest;

      uint256 uncalledTokenInterestAvailableToWithdraw = ((pastDueInterest * 1000 * 90) /
        (100 * 4000)) + (guaranteedFutureInterest * 1000 * 90) / (100 * 3700);

      (uint256 interestRedeemable, uint256 principalRedeemable) = loan.availableToWithdraw(
        otherLenders[2].tokenId()
      );
      assertApproxEqAbs(
        interestRedeemable,
        uncalledTokenInterestAvailableToWithdraw,
        1,
        "interest redeemable"
      );
      assertZero(principalRedeemable, "principal redeemable");

      /* Fast forward to just before repayment due date */ {
        vm.warp(loan.nextDueTimeAt(block.timestamp) - 1);
      }

      {
        vm.expectRevert();
        otherLenders[2].withdraw(interestRedeemable + 1);
      }

      /* Now go to repayment date */ {
        vm.warp(loan.nextDueTimeAt(block.timestamp));
      }

      (interestRedeemable, principalRedeemable) = loan.availableToWithdraw(
        otherLenders[2].tokenId()
      );
      assertApproxEqAbs(
        interestRedeemable,
        uncalledTokenInterestAvailableToWithdraw,
        1,
        "interest redeemable"
      );
      assertZero(principalRedeemable, "principal redeemable");

      {
        vm.expectRevert();
        otherLenders[2].withdraw(interestRedeemable + 1);
      }

      vm.warp(loan.nextPrincipalDueTime());
      /* Can claim interest and principal */
      // Owed interest on called token is:
      // Tranche interest paid = (tranche deposit size/total deposit size) * estimatedInterest
      // (called deposit size/tranche deposit size) * Tranche interest paid  * (100% - reserve fee percent).
      // In this case, the Tranche interest paid is 100/1000 * estimatedInterest
      // and 100% - reserve fee percent is 100% - 10% = 90 / 100
      {
        otherLenders[2].withdraw(uncalledTokenInterestAvailableToWithdraw + 100);
      }
    }
  }
}
