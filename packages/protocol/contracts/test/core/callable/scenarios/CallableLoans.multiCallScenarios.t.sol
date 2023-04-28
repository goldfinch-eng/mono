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
import {console2 as console} from "forge-std/console2.sol";

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
  uint256[] public tokenIds;

  function submitCall(uint256 amount, uint256 tokenId) external {
    uint256 balanceBefore = usdc.balanceOf(address(this));
    (uint256 availablePrincipal, uint256 availableInterest) = loan.availableToWithdraw(tokenId);
    (uint256 _callRequestTokenId, uint256 _tokenId) = loan.submitCall(amount, tokenId);
    assertEq(
      balanceBefore + availablePrincipal + availableInterest,
      usdc.balanceOf(address(this)),
      "usdc increase"
    );
    tokenIds.push(_callRequestTokenId);
    tokenIds.push(_tokenId);
  }

  function deposit(uint256 amount) external expectUsdcDecrease(amount) {
    usdc.approve(address(loan), amount);
    tokenIds.push(loan.deposit(loan.uncalledCapitalTrancheIndex(), amount));
  }

  function withdraw(uint256 amount, uint256 tokenId) external expectUsdcIncrease(amount) {
    // If there's a call request, do that. Otherwise try with the held token
    loan.withdraw(tokenId, amount);
  }

  function withdrawMax(uint256 tokenId) external {
    // If there's a call request, do that. Otherwise try with the held token
    loan.withdrawMax(tokenId);
  }
}

contract CallableLoans_MulticallScenarios_Test is CallableLoanBaseTest {
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
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.DrawdownPeriodInSeconds), 300);

    usdc.transfer(address(borrower), usdcVal(1_000_000_000));
    usdc.transfer(address(otherLenders[0]), usdcVal(1_000_000_000));
    usdc.transfer(address(otherLenders[1]), usdcVal(1_000_000_000));
    usdc.transfer(address(otherLenders[2]), usdcVal(1_000_000_000));
    usdc.transfer(address(lender), usdcVal(1_000_000_000));

    _stopImpersonation();

    (CallableLoan _loan, ICreditLine _creditLine) = callableLoanBuilder
      .withLimit(usdcVal(2_000_000))
      .withApr(145 * 1e15)
      .build(address(borrower));

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

  /**
   * @notice Checking that October interest owed and interest bearing balance match expectations.
   */
  function octoberInterestChecks(string memory assertionTag) public {
    assertApproxEqAbs(
      loan.interestBearingBalance(),
      usdcVal(1_850_000),
      DOLLAR,
      string.concat(assertionTag, "Interest bearing balance")
    );
    assertApproxEqAbs(
      creditLine.interestOwedAt(loan.nextDueTimeAt(block.timestamp)),
      22782876698,
      DOLLAR,
      string.concat(assertionTag, "October interest matches expectation")
    );
  }

  function test_interestAccountingScenario() public {
    // 0x6294...7820	Supply	+$1,000,000.00 USDC	1688077078	Tx
    // 0xbc62...bd67	Supply	+$450,000.00 USDC	1688076974	Tx
    // 0x4bc5...93fd	Supply	+$500,000.00 USDC	1688076901	Tx
    // 0x21f9...4029	Supply	+$50,000.00 USDC	1688076810	Tx
    /* Deposit into loan */ {
      vm.warp(1688076810);
      lender.deposit(usdcVal(50_000));
      vm.warp(1688076901);
      otherLenders[0].deposit(usdcVal(500_000));
      vm.warp(1688076974);
      otherLenders[1].deposit(usdcVal(450_000));
      vm.warp(1688077078);
      otherLenders[2].deposit(usdcVal(1_000_000));
      assertTrue(loan.loanPhase() == LoanPhase.Funding);
    }

    // Pizza Loans	Drawdown	-$2,000,000.00 USDC	1688077129	Tx

    /* Full drawdown */ {
      vm.warp(1688077129);
      borrower.drawdown(usdcVal(2_000_000));
      assertTrue(loan.loanPhase() == LoanPhase.DrawdownPeriod);
    }

    console.log("After drawdown");

    // 0xbc62...bd67	Capital Called	-$50,000.00 USDC	1688768667	Tx
    // 0x4bc5...93fd	Capital Called	-$100,000.00 USDC	1688768633	Tx
    /* Submit calls */ {
      vm.warp(1688768633);
      console.log("block.timestamp", block.timestamp);
      assertTrue(loan.loanPhase() == LoanPhase.InProgress);
      otherLenders[0].submitCall(usdcVal(100_000), otherLenders[0].tokenIds(0));
      vm.warp(1688768667);
      otherLenders[1].submitCall(usdcVal(50_000), otherLenders[1].tokenIds(0));
    }

    console.log("After call submission");

    // Pizza Loans	Repayment	+$173,835.61 USDC	1693952813	Tx
    // Pizza Loans	Repayment	+$24,630.14 USDC	1691360788	Tx
    // Pizza Loans	Repayment	+$25,480.49 USDC	1688768744	Tx

    // Friday, July 7, 2023 10:25:44 PM
    vm.warp(1688768744);
    assertApproxEqAbs(
      loan.interestBearingBalance(),
      usdcVal(2_000_000),
      DOLLAR,
      "Interest bearing balance - July"
    );
    assertApproxEqAbs(
      creditLine.interestOwedAt(loan.nextDueTimeAt(block.timestamp)),
      25_480_490_000,
      DOLLAR,
      "July interest"
    );
    borrower.pay(25_480_490_000);

    // Sunday, August 6, 2023 10:26:28 PM
    vm.warp(1691360788);
    assertApproxEqAbs(
      loan.interestBearingBalance(),
      usdcVal(2_000_000),
      DOLLAR,
      "Interest bearing balance - August"
    );
    assertApproxEqAbs(
      creditLine.interestOwedAt(loan.nextDueTimeAt(block.timestamp)),
      24_630_140_000,
      DOLLAR,
      "August interest"
    );
    borrower.pay(24_630_140_000);

    // Tuesday, September 5, 2023 10:26:53 PM
    vm.warp(1693952813);
    assertApproxEqAbs(
      loan.interestBearingBalance(),
      usdcVal(2_000_000),
      DOLLAR,
      "Interest bearing balance - September"
    );
    assertApproxEqAbs(
      creditLine.interestOwedAt(loan.nextDueTimeAt(block.timestamp)) +
        creditLine.principalOwedAt(loan.nextDueTimeAt(block.timestamp)),
      173_835_610_000,
      DOLLAR,
      "September interest + principal"
    );
    // Sunday, October 1, 2023 12:00:00 AM
    assertEq(loan.nextDueTimeAt(block.timestamp), 1696118400);
    assertEq(loan.nextPrincipalDueTime(), 1696118400);

    borrower.pay(173_835_610_000);

    // Sunday, October 1, 2023 12:00:00 AM
    vm.warp(1696118400);
    octoberInterestChecks({assertionTag: "Start of October: "});

    // 0x6294...7820	Withdrawal	-$33,275.81 USDC	1696545568	Tx
    // 0xbc62...bd67	Withdrawal	-$13,310.32 USDC	1696545551	Tx
    // 0xbc62...bd67	Withdrawal	-$51,663.79 USDC	1696545551	Tx
    // 0x4bc5...93fd	Withdrawal	-$13,310.32 USDC	1696545533	Tx
    // 0x4bc5...93fd	Withdrawal	-$103,327.58 USDC	1696545533	Tx
    // 0x21f9...4029	Withdrawal	-$1,663.79 USDC	1696545516	Tx

    /* Withdraw max for each depositor */
    {
      // Thursday, October 5, 2023 10:38:36 PM
      vm.warp(1696545516);
      octoberInterestChecks({assertionTag: "October 5th: "});
      lender.withdrawMax(lender.tokenIds(0));
      octoberInterestChecks({assertionTag: "After withdraw: "});

      // Thursday, October 5, 2023 10:40:18 PM
      vm.warp(1696545533);
      otherLenders[0].withdrawMax(otherLenders[0].tokenIds(1));
      otherLenders[0].withdrawMax(otherLenders[0].tokenIds(2));
      vm.warp(1696545551);
      otherLenders[1].withdrawMax(otherLenders[1].tokenIds(1));
      otherLenders[1].withdrawMax(otherLenders[1].tokenIds(2));
      vm.warp(1696545568);
      otherLenders[2].withdrawMax(otherLenders[2].tokenIds(0));
    }

    // 0xbc62...bd67	Capital Called	-$200,000.00 USDC	1696545883	Tx
    // 0x4bc5...93fd	Capital Called	-$100,000.00 USDC	1696545733	Tx
    // 0x21f9...4029	Capital Called	-$24,500.00 USDC	1696545618	Tx
    lender.submitCall(usdcVal(24_500), lender.tokenIds(0));
    vm.warp(1696545733);
    otherLenders[0].submitCall(usdcVal(100_000), otherLenders[0].tokenIds(2));
    vm.warp(1696545883);
    otherLenders[1].submitCall(usdcVal(200_000), otherLenders[1].tokenIds(2));

    // Pizza Loans	Repayment	+$162,250.00 USDC	1701730179	Tx
    // Pizza Loans	Repayment	+$22,782.87 USDC	1701730125	Tx
    // Pizza Loans	Repayment	+$22,047.95 USDC	1699137968	Tx
    // Pizza Loans	Repayment	+$21,289.30 USDC	1696545947	Tx
  }
}
