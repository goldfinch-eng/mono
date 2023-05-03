// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {IBackerRewards} from "../../../interfaces/IBackerRewards.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {IGoldfinchFactory} from "../../../interfaces/IGoldfinchFactory.sol";
import {IGoldfinchConfig} from "../../../interfaces/IGoldfinchConfig.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {IGo} from "../../../interfaces/IGo.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";
import {CallableLoanConfigHelper} from "../../../protocol/core/callable/CallableLoanConfigHelper.sol";

// solhint-disable-next-line max-line-length
import {IImplementationRepository} from "../../../interfaces/IImplementationRepository.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {IMonthlyScheduleRepo} from "../../../interfaces/IMonthlyScheduleRepo.sol";
import {IERC20UpgradeableWithDec} from "../../../interfaces/IERC20UpgradeableWithDec.sol";
import {CallableLoanAccountant} from "../../../protocol/core/callable/CallableLoanAccountant.sol";

import {CallableLoanBuilder} from "../../helpers/CallableLoanBuilder.t.sol";
import {BaseTest} from "../BaseTest.t.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {ITestUniqueIdentity0612} from "../../ITestUniqueIdentity0612.t.sol";
import {ITestUSDC} from "../../ITestUSDC.t.sol";
import {console2 as console} from "forge-std/console2.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

contract CallableLoanBaseTest is BaseTest {
  using CallableLoanConfigHelper for IGoldfinchConfig;
  address public constant BORROWER = 0x228994aE78d75939A5aB9260a83bEEacBE77Ddd0; // random address
  address public constant DEPOSITOR = 0x89b8CbAeBd6C623a69a4DEBe9EE03131b5F4Ff96; // random address

  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

  uint256 internal constant DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS = 7 days;
  uint256 internal constant HALF_CENT = 1e6 / 200;
  uint256 internal constant HUNDREDTH_CENT = 1e6 / 10000;
  uint256 internal constant DEFAULT_RESERVE_FEE_DENOMINATOR = 10;

  IGoldfinchConfig internal gfConfig;
  IGoldfinchFactory internal gfFactory;
  ITestUSDC internal usdc;
  ITestUniqueIdentity0612 internal uid;
  CallableLoanBuilder internal callableLoanBuilder;
  IPoolTokens internal poolTokens;
  IGo internal go;

  function setUp() public virtual override {
    super.setUp();

    _startImpersonation(GF_OWNER);

    // GoldfinchConfig setup
    gfConfig = IGoldfinchConfig(address(protocol.gfConfig()));

    // Setup gfFactory
    gfFactory = IGoldfinchFactory(address(protocol.gfFactory()));

    // USDC setup
    usdc = ITestUSDC(address(protocol.usdc()));

    // UniqueIdentity setup
    uid = ITestUniqueIdentity0612(deployCode("TestUniqueIdentity.sol"));
    uid.initialize(GF_OWNER, "UNIQUE-IDENTITY");
    uint256[] memory supportedUids = new uint256[](5);
    bool[] memory supportedUidValues = new bool[](5);
    for (uint256 i = 0; i < 5; ++i) {
      supportedUids[i] = i;
      supportedUidValues[i] = true;
    }
    uid.setSupportedUIDTypes(supportedUids, supportedUidValues);
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    fuzzHelper.exclude(address(uid));

    // PoolTokens setup
    poolTokens = IPoolTokens(deployCode("PoolTokens.sol"));
    (bool poolTokenInitializeSuccess, ) = address(poolTokens).call(
      abi.encodeWithSignature("__initialize__(address,address)", GF_OWNER, address(gfConfig))
    );
    require(poolTokenInitializeSuccess, "PoolTokens failed to initialize");
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.PoolTokens), address(poolTokens));
    fuzzHelper.exclude(address(poolTokens));

    // Go setup
    go = IGo(deployCode("Go.sol"));
    (bool goInitializeSuccess, ) = address(go).call(
      abi.encodeWithSignature(
        "initialize(address,address,address)",
        GF_OWNER,
        address(gfConfig),
        address(uid)
      )
    );

    require(goInitializeSuccess, "Go failed to initialize");

    gfConfig.setAddress(uint256(ConfigOptions.Addresses.Go), address(go));
    fuzzHelper.exclude(address(go));

    // CallableLoan setup
    CallableLoan callableLoanImpl = new CallableLoan();
    IImplementationRepository callableLoanRepo = IImplementationRepository(
      deployCode("CallableLoanImplementationRepository.sol")
    );
    (bool callableLoanRepoInitializeSuccess, ) = address(callableLoanRepo).call(
      abi.encodeWithSignature("initialize(address,address)", GF_OWNER, address(callableLoanImpl))
    );
    require(callableLoanRepoInitializeSuccess, "CallableLoanRepo failed to initialize");
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.CallableLoanImplementationRepository),
      address(callableLoanRepo)
    );
    fuzzHelper.exclude(address(callableLoanImpl));
    fuzzHelper.exclude(address(callableLoanRepo));

    // MonthlyScheduleRepository setup
    IMonthlyScheduleRepo monthlyScheduleRepo = IMonthlyScheduleRepo(
      deployCode("MonthlyScheduleRepo.sol")
    );
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.MonthlyScheduleRepo),
      address(monthlyScheduleRepo)
    );
    fuzzHelper.exclude(address(monthlyScheduleRepo));
    fuzzHelper.exclude(address(monthlyScheduleRepo.periodMapper()));

    callableLoanBuilder = new CallableLoanBuilder(gfFactory, monthlyScheduleRepo);
    fuzzHelper.exclude(address(callableLoanBuilder));
    // Allow the builder to create pools
    (bool grantRoleSuccess, ) = address(gfFactory).call(
      abi.encodeWithSignature(
        "grantRole(bytes32,address)",
        OWNER_ROLE,
        address(callableLoanBuilder)
      )
    );
    require(grantRoleSuccess, "Failed to grant role to callableLoanBuilder");

    // Other config numbers
    gfConfig.setNumber(
      uint256(ConfigOptions.Numbers.ReserveDenominator),
      DEFAULT_RESERVE_FEE_DENOMINATOR
    ); // 10%
    gfConfig.setNumber(
      uint256(ConfigOptions.Numbers.DrawdownPeriodInSeconds),
      DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS
    );

    // Other stuff
    addToGoList(GF_OWNER);

    fuzzHelper.exclude(BORROWER);
    fuzzHelper.exclude(DEPOSITOR);
    fuzzHelper.exclude(address(this));

    // Fund the depositor
    usdc.transfer(DEPOSITOR, usdcVal(1_000_000_000));

    _stopImpersonation();
  }

  function defaultCallableLoan()
    internal
    impersonating(GF_OWNER)
    returns (CallableLoan, ICreditLine)
  {
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanBuilder.build(BORROWER);
    _startImpersonation(GF_OWNER);
    callableLoan.unpauseDrawdowns();
    _stopImpersonation();
    fuzzHelper.exclude(address(callableLoan));
    fuzzHelper.exclude(address(cl));
    ISchedule schedule = callableLoan.schedule();
    fuzzHelper.exclude(address(schedule));
    return (callableLoan, cl);
  }

  function callableLoanWithLateFees(
    uint256 lateFeeApr,
    uint256 lateFeeGracePeriodInDays
  ) public impersonating(GF_OWNER) returns (CallableLoan, ICreditLine) {
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanBuilder
      .withLateFeeApr(lateFeeApr)
      .build(BORROWER);
    _startImpersonation(GF_OWNER);
    callableLoan.unpauseDrawdowns();
    _stopImpersonation();
    fuzzHelper.exclude(address(callableLoan));
    fuzzHelper.exclude(address(cl));
    ISchedule schedule = callableLoan.schedule();
    fuzzHelper.exclude(address(schedule));
    gfConfig.setNumber(
      uint256(ConfigOptions.Numbers.LatenessGracePeriodInDays),
      lateFeeGracePeriodInDays
    );
    return (callableLoan, cl);
  }

  function callableLoanWithLimit(uint256 amount) internal returns (CallableLoan, ICreditLine) {
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanBuilder.withLimit(amount).build(
      BORROWER
    );
    _startImpersonation(GF_OWNER);
    callableLoan.unpauseDrawdowns();
    _stopImpersonation();
    fuzzHelper.exclude(address(callableLoan));
    fuzzHelper.exclude(address(cl));
    ISchedule schedule = callableLoan.schedule();
    fuzzHelper.exclude(address(schedule));
    return (callableLoan, cl);
  }

  function submitCall(
    CallableLoan callableLoan,
    uint256 amount,
    uint256 poolTokenId,
    address caller
  ) internal impersonating(caller) returns (uint256, uint256) {
    return callableLoan.submitCall(amount, poolTokenId);
  }

  function deposit(
    CallableLoan callableLoan,
    uint256 tranche,
    uint256 depositAmount,
    address depositor
  ) internal impersonating(depositor) returns (uint256) {
    uint256 balance = usdc.balanceOf(depositor);
    if (balance < depositAmount) {
      fundAddress(depositor, depositAmount - balance);
    }
    usdc.approve(address(callableLoan), depositAmount);
    return callableLoan.deposit(tranche, depositAmount);
  }

  function deposit(
    CallableLoan callableLoan,
    uint256 depositAmount,
    address depositor
  ) internal returns (uint256) {
    return
      deposit(callableLoan, callableLoan.uncalledCapitalTrancheIndex(), depositAmount, depositor);
  }

  function pay(
    CallableLoan callableLoan,
    uint256 amount
  ) internal impersonating(callableLoan.creditLine().borrower()) {
    usdc.approve(address(callableLoan), amount);
    uint256 balance = usdc.balanceOf(callableLoan.creditLine().borrower());
    if (balance < amount) {
      fundAddress(callableLoan.creditLine().borrower(), amount - balance);
    }
    callableLoan.pay(amount);
  }

  function pay(
    CallableLoan callableLoan,
    uint256 principal,
    uint256 interest
  ) internal impersonating(callableLoan.creditLine().borrower()) {
    uint256 amount = interest + principal;
    usdc.approve(address(callableLoan), amount);
    uint256 balance = usdc.balanceOf(callableLoan.creditLine().borrower());
    if (balance < amount) {
      fundAddress(callableLoan.creditLine().borrower(), amount - balance);
    }
    callableLoan.pay(principal, interest);
  }

  function withdraw(
    CallableLoan callableLoan,
    uint256 token,
    uint256 amount,
    address withdrawer
  ) internal impersonating(withdrawer) returns (uint256, uint256) {
    return callableLoan.withdraw(token, amount);
  }

  function withdrawMax(
    CallableLoan callableLoan,
    uint256 token,
    address withdrawer
  ) internal impersonating(withdrawer) returns (uint256, uint256) {
    return callableLoan.withdrawMax(token);
  }

  function withdrawMultiple(
    CallableLoan callableLoan,
    uint256[] memory tokens,
    uint256[] memory amounts,
    address withdrawer
  ) internal impersonating(withdrawer) {
    callableLoan.withdrawMultiple(tokens, amounts);
  }

  function drawdown(
    CallableLoan callableLoan,
    uint256 amount
  ) internal impersonating(callableLoan.creditLine().borrower()) {
    callableLoan.drawdown(amount);
  }

  function pause(CallableLoan callableLoan) internal impersonating(GF_OWNER) {
    callableLoan.pause();
  }

  function unpause(CallableLoan callableLoan) internal impersonating(GF_OWNER) {
    callableLoan.unpause();
  }

  function depositWithPermit(
    CallableLoan callableLoan,
    uint256 tranche,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s,
    address user
  ) internal impersonating(user) returns (uint256) {
    uint256 balance = usdc.balanceOf(user);
    if (balance < amount) {
      fundAddress(user, amount - balance);
    }
    return callableLoan.depositWithPermit(tranche, amount, deadline, v, r, s);
  }

  function depositAndDrawdown(
    CallableLoan callableLoan,
    uint256 depositAmount
  ) internal returns (uint256 tokenId) {
    return depositAndDrawdown(callableLoan, depositAmount, DEPOSITOR);
  }

  function depositAndDrawdown(
    CallableLoan callableLoan,
    uint256 depositAmount,
    address investor
  ) internal impersonating(callableLoan.creditLine().borrower()) returns (uint256 tokenId) {
    tokenId = deposit(callableLoan, 3, depositAmount, investor);
    callableLoan.drawdown(depositAmount);
  }

  function getInterestAccrued(
    uint256 start,
    uint256 end,
    uint256 balance,
    uint256 apr
  ) internal pure returns (uint256) {
    uint256 secondsElapsed = end - start;
    uint256 totalInterestPerYear = (balance * apr) / (1e18);
    uint256 interest = (totalInterestPerYear * secondsElapsed) / (365 days);
    return interest;
  }

  function addToGoList(address user) internal impersonating(GF_OWNER) {
    gfConfig.addToGoList(user);
  }

  function maxPayableInterest(CallableLoan callableLoan) internal view returns (uint256) {
    uint256 latestPaymentSettlementDate = Math.max(
      block.timestamp,
      callableLoan.nextPrincipalDueTime()
    );

    uint256 owedAndAccruedInterest = callableLoan.interestOwed() + callableLoan.interestAccrued();

    uint256 timeToSettlement = latestPaymentSettlementDate - block.timestamp;
    uint256 futureInterestPayable = CallableLoanAccountant.calculateInterest(
      timeToSettlement,
      callableLoan.balance() - callableLoan.principalOwed(),
      callableLoan.interestApr()
    );
    return owedAndAccruedInterest + futureInterestPayable;
  }

  function warpToAfterDrawdownPeriod(CallableLoan callableLoan) internal {
    vm.warp(callableLoan.termStartTime() + gfConfig.getDrawdownPeriodInSeconds() + 1);
  }
}
