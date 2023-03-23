// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {InvariantTest} from "forge-std/InvariantTest.sol";
import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {IERC20} from "../../../../interfaces/IERC20.sol";
import {ITestUniqueIdentity0612} from "../../../ITestUniqueIdentity0612.t.sol";

struct AddressSet {
  address[] addresses;
  mapping(address => bool) saved;
  mapping(address => uint256[]) poolTokensByActor;
}

library LibAddressSet {
  function add(AddressSet storage s, address addr) internal {
    if (!s.saved[addr]) s.addresses.push(addr);
  }

  function contains(AddressSet storage s, address addr) internal view returns (bool) {
    return s.saved[addr];
  }

  function forEach(
    AddressSet storage s,
    function(address,uint256[] memory) external func
  ) internal {
    for (uint i = 0; i < s.addresses.length; ++i) {
      func(s.addresses[i], s.poolTokensByActor[s.addresses[i]]);
    }
  }

  function reduce(
    AddressSet storage s,
    uint256 acc,
    function(uint256,address,uint256[] memory) external returns (uint256) reducer
  ) internal returns (uint256) {
    for (uint i = 0; i < s.addresses.length; ++i) {
      acc = reducer(acc, s.addresses[i], s.poolTokensByActor[s.addresses[i]]);
    }
    return acc;
  }
}

using LibAddressSet for AddressSet global;

contract CallableLoanHandler is Test {
  CallableLoan public loan;
  uint256 public sumDeposited;
  uint256 public sumWithdrawn;

  IERC20 private usdc;
  ITestUniqueIdentity0612 private uid;
  AddressSet private actors;
  address private currentActor;

  constructor(CallableLoan _loan, IERC20 _usdc, ITestUniqueIdentity0612 _uid) {
    loan = _loan;
    usdc = _usdc;
    uid = _uid;
  }

  function warp() public {
    skip(1 days);
  }

  function deposit(uint256 amount) public createActor {
    uint256 totalPrincipalDeposited = sumDeposited - sumWithdrawn;
    uint256 maxDepositAmount = loan.limit() - totalPrincipalDeposited;

    if (maxDepositAmount == 0) {
      return;
    }

    amount = bound(amount, 1, maxDepositAmount);

    vm.startPrank(currentActor);

    uint256 tokenId = loan.deposit(loan.uncalledCapitalTrancheIndex(), amount);

    sumDeposited += amount;
    actors.poolTokensByActor[currentActor].push(tokenId);
  }

  function withdraw(
    uint256 amount,
    uint256 randActorIndex,
    uint256 poolTokenIndex
  ) public createActor {
    if (actors.addresses.length == 0) return;

    // Select a random actor that has already deposited to perform the withdraw
    randActorIndex = bound(randActorIndex, 0, actors.addresses.length - 1);
    address actor = actors.addresses[randActorIndex];

    uint256 poolTokenIndex = bound(
      poolTokenIndex,
      0,
      actors.poolTokensByActor[actor].length - 1
    );
    uint256 tokenId = actors.poolTokensByActor[actor][poolTokenIndex];

    (, uint256 principalRedeemable) = loan.availableToWithdraw(tokenId);
    if (principalRedeemable == 0) return;

    amount = bound(amount, 1, principalRedeemable);

    vm.startPrank(currentActor);

    loan.withdraw(tokenId, amount);
    sumWithdrawn += amount;
  }

  function reduceActors(
    uint256 acc,
    function(uint256 acc, address actor, uint256[] memory poolTokens) external returns (uint256) func
  ) public returns (uint256) {
    return actors.reduce(acc, func);
  }

  function forEachActor(
    function(address,uint256[] memory) external fn
  ) public {
    return actors.forEach(fn);
  }

  modifier createActor() {
    if (!actors.contains(msg.sender)) {
      uid._mintForTest(msg.sender, 1, 1, "");
      usdc.transfer(msg.sender, loan.limit());
      vm.prank(msg.sender);
      usdc.approve(address(loan), type(uint256).max);
      actors.add(msg.sender);
    }
    currentActor = msg.sender;
    _;
  }
}

contract CallableLoanFundingMultiUserInvariantTest is CallableLoanBaseTest, InvariantTest {
  CallableLoanHandler private handler;

  function setUp() public override {
    super.setUp();

    (CallableLoan loan, ) = defaultCallableLoan();
    handler = new CallableLoanHandler(loan, usdc, uid);
    // Add enough USDC to the handler that it can fund each depositor up to the loan limit
    fundAddress(address(handler), loan.limit() * 1e18);

    targetContract(address(handler));
    bytes4[] memory selectors = new bytes4[](3);
    selectors[0] = handler.deposit.selector;
    selectors[1] = handler.withdraw.selector;
    selectors[2] = handler.warp.selector;
    targetSelector(FuzzSelector(address(handler), selectors));
  }

  // PoolTokens TokenInfo invariants

  function invariant_totalPrincipalWithdrawableIsTotalPoolTokenPrincipalAmounts() public {
    uint256 totalPrincipalWithdrawable = handler.reduceActors(0, this.principalWithdrawableReducer);
    uint256 totalPoolTokenInfoPrincipalAmounts = handler.reduceActors(0, this.poolTokenPrincipalAmountReducer);
    assertEq(totalPrincipalWithdrawable, totalPoolTokenInfoPrincipalAmounts);
  }

  function invariant_PoolTokenPrincipalAndInterestRedeemedIsZero() public {
    handler.forEachActor(this.assertPoolTokenInfoPrincipalAndInterestRedeemedIsZero);
  }

  function invariant_PoolTokenPoolIsCallableLoan() public {
    handler.forEachActor(this.assertPoolTokenInfoPoolIsCallableLoan);
  }

  function invariant_PoolTokenTrancheIsUncalledCapitalTranche() public {
    handler.forEachActor(this.assertPoolTokenInfoTrancheIsUncalledCapitalTranche);
  }

  function assertPoolTokenInfoPrincipalAndInterestRedeemedIsZero(address actor, uint256[] memory actorPoolTokens) external {
    for (uint i = 0; i < actorPoolTokens.length; ++i)  {
      assertZero(poolTokens.getTokenInfo(actorPoolTokens[i]).principalRedeemed);
      assertZero(poolTokens.getTokenInfo(actorPoolTokens[i]).interestRedeemed);
    }
  }

  function assertPoolTokenInfoPoolIsCallableLoan(address actor, uint256[] memory actorPoolTokens) external {
    for (uint i = 0; i < actorPoolTokens.length; ++i)  {
      assertEq(poolTokens.getTokenInfo(actorPoolTokens[i]).pool, address(handler.loan()));
    }
  }

  function assertPoolTokenInfoTrancheIsUncalledCapitalTranche(address actor, uint256[] memory actorPoolTokens) external {
    for (uint i = 0; i < actorPoolTokens.length; ++i)  {
      assertEq(poolTokens.getTokenInfo(actorPoolTokens[i]).tranche, handler.loan().uncalledCapitalTrancheIndex());
    }
  }

  // PoolTokens PoolInfo invariants

  function invariant_PoolTokensPoolInfoTotalMintedIsSumOfPrincipalWithdrawable() public {
    assertEq(
      poolTokens.getPoolInfo(address(handler.loan())).totalMinted,
      handler.reduceActors(0, this.poolTokenPrincipalAmountReducer)
    );
  }

  function invariant_PoolTokensPoolInfoTotalPrincipalRedeemedIsZero() public {
    assertZero(poolTokens.getPoolInfo(address(handler.loan())).totalPrincipalRedeemed);
  }

  // UncalledCapitalInfo invariants

  function invariant_UncalledCapitalInfoPrincipalDepositedIsSumOfPrincipalWithdrawable() public {
    uint256 totalPrincipalWithdrawable = handler.reduceActors(0, this.principalWithdrawableReducer);
    assertEq(
      handler.loan().getUncalledCapitalInfo().principalDeposited,
      totalPrincipalWithdrawable
    );
  }

  function invariant_UncalledCapitalInfoPrincipalPaidIsSumOfPrincipalWithdrawable() public {
    uint256 totalPrincipalWithdrawable = handler.reduceActors(0, this.principalWithdrawableReducer);
    assertEq(
      handler.loan().getUncalledCapitalInfo().principalPaid,
      totalPrincipalWithdrawable
    );
  }

  function invariant_UncalledCapitalInfoPrincipalReservedIsZero() public {
    assertZero(handler.loan().getUncalledCapitalInfo().principalReserved);
  }

  function invariant_UncalledCapitalInfoInterestPaidIsZero() public {
    assertZero(handler.loan().getUncalledCapitalInfo().interestPaid);
  }

  function principalWithdrawableReducer(
    uint256 principalWithdrawableAcc,
    address actor,
    uint256[] memory actorPoolTokens
  ) external view returns (uint256) {
    for (uint i = 0; i < actorPoolTokens.length; ++i) {
      (, uint256 principalRedeemable) = handler.loan().availableToWithdraw(actorPoolTokens[i]);
      principalWithdrawableAcc += principalRedeemable;
    }
    return principalWithdrawableAcc;
  }

  function poolTokenPrincipalAmountReducer(
    uint256 principalAmountAcc,
    address actor,
    uint256[] memory actorPoolTokens
  ) external view returns (uint256) {
    for (uint i = 0; i < actorPoolTokens.length; ++i) {
      principalAmountAcc += poolTokens.getTokenInfo(actorPoolTokens[i]).principalAmount;
    }
    return principalAmountAcc; 
  }
}
