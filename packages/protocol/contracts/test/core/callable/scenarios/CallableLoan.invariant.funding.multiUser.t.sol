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
}

using LibAddressSet for AddressSet global;

contract CallableLoanHandler is Test {
  CallableLoan public loan;
  uint256 public sumDeposited;
  uint256 public sumWithdrawn;

  IERC20 private usdc;
  ITestUniqueIdentity0612 private uid;
  AddressSet private addressSet;
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
    addressSet.poolTokensByActor[currentActor].push(tokenId);
  }

  function withdraw(
    uint256 amount,
    uint256 randActorIndex,
    uint256 poolTokenIndex
  ) public createActor {
    if (addressSet.addresses.length == 0) return;

    // Select a random actor that has already deposited to perform the withdraw
    randActorIndex = bound(randActorIndex, 0, addressSet.addresses.length - 1);
    address actor = addressSet.addresses[randActorIndex];

    uint256 poolTokenIndex = bound(
      poolTokenIndex,
      0,
      addressSet.poolTokensByActor[actor].length - 1
    );
    uint256 tokenId = addressSet.poolTokensByActor[actor][poolTokenIndex];

    (, uint256 principalRedeemable) = loan.availableToWithdraw(tokenId);
    if (principalRedeemable == 0) return;

    amount = bound(amount, 1, principalRedeemable);

    vm.startPrank(currentActor);

    loan.withdraw(tokenId, amount);
    sumWithdrawn += amount;
  }

  modifier createActor() {
    if (!addressSet.contains(msg.sender)) {
      uid._mintForTest(msg.sender, 1, 1, "");
      usdc.transfer(msg.sender, loan.limit());
      vm.prank(msg.sender);
      usdc.approve(address(loan), type(uint256).max);
      addressSet.add(msg.sender);
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
    fundAddress(address(handler), loan.limit() * 1000);

    targetContract(address(handler));
    bytes4[] memory selectors = new bytes4[](3);
    selectors[0] = handler.deposit.selector;
    selectors[1] = handler.withdraw.selector;
    selectors[2] = handler.warp.selector;
    targetSelector(FuzzSelector(address(handler), selectors));
  }
}
