// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {ImplementationRepository as Repo} from "../../../protocol/core/proxy/ImplementationRepository.sol";
import {UcuProxy} from "../../../protocol/core/proxy/UcuProxy.sol";
import {Test} from "forge-std/Test.sol";
import {console2 as console} from "forge-std/console2.sol";

contract TestImplementationRepository is Test {
  address internal constant repoOwner = 0x483e2BaF7F4e0Ac7D90c2C3Efc13c3AF5050F3c2;
  address internal constant proxyOwner = 0x8b0dD65C31EBDC4586AE55855577de020601E36d;

  // impls
  BaseImpl internal addingImpl = new AddingImplementation();
  BaseImpl internal subtractingImpl = new SubtractingImplementation();
  BaseImpl internal failingImpl = new FailingImplementation();
  BaseImpl internal initialImpl = addingImpl;

  Repo internal repo = new Repo();
  UcuProxy internal proxy;
  BaseImpl internal proxyAsImpl;

  function setUp() public {
    repo.initialize(repoOwner, address(initialImpl));
    proxy = new UcuProxy(repo, proxyOwner);
    proxyAsImpl = BaseImpl(address(proxy));
    vm.label(address(proxy), "proxy");
    vm.label(repoOwner, "repoOwner");
    vm.label(proxyOwner, "proxyOwner");
    assertTrue(repoOwner != proxyOwner);
  }

  function testProxyFailsToUpgradeConstructAndUpgradeWhenRepoIsPaused()
    public
    impersonating(repoOwner)
  {
    // there should be an upgrade available
    repo.append(address(subtractingImpl));
    assertEq(repo.nextImplementationOf(address(initialImpl)), address(subtractingImpl));

    repo.pause();

    vm.stopPrank();
    vm.startPrank(proxyOwner);
    vm.expectRevert("Pausable: paused");
    new UcuProxy(repo, repoOwner);

    vm.expectRevert("Pausable: paused");
    proxy.upgradeImplementation();
  }

  function testProxyContructorRevertsIfRepoIsNotAContract(
    Repo _repo
  ) public notContract(address(_repo)) {
    vm.expectRevert("bad repo");
    new UcuProxy(_repo, proxyOwner);
  }

  function testProxyConstructorRevertsIfOwnerIsNull() public {
    vm.expectRevert(bytes("bad owner"));
    new UcuProxy(repo, address(0));
  }

  function testProxyDoesntSwallowErrorsOnImplementationRevert() public impersonating(repoOwner) {
    repo.append(address(failingImpl));
    vm.stopPrank();

    vm.startPrank(proxyOwner);
    proxy.upgradeImplementation();
    vm.expectRevert("failed in proxied call");
    proxyAsImpl.fn();
  }

  function testProxyWillNotUpgradeAccrossLineages() public {
    uint256 startingSetId = repo.currentLineageId();
    proxyAsImpl.initialize(25);
    assertEq(proxyAsImpl.value(), 25);
    proxyAsImpl.fn();
    assertEq(proxyAsImpl.value(), 26);

    vm.startPrank(repoOwner);
    {
      repo.createLineage(address(subtractingImpl));
      assertEq(repo.currentImplementation(), address(subtractingImpl));
    }
    vm.stopPrank();

    vm.startPrank(proxyOwner);
    {
      assertEq(proxyAsImpl.value(), 26);
      proxyAsImpl.fn();
      assertEq(proxyAsImpl.value(), 27);

      vm.expectRevert("no upgrade");
      proxy.upgradeImplementation();

      proxyAsImpl.fn();
      assertEq(proxyAsImpl.value(), 28);
    }
    vm.stopPrank();

    address newImpl = address(new SubtractingImplementation());
    vm.startPrank(repoOwner);
    {
      repo.append(newImpl, startingSetId);
      assertEq(repo.currentImplementation(), address(subtractingImpl));
      assertEq(repo.currentImplementation(startingSetId), newImpl);
    }
    vm.stopPrank();

    vm.startPrank(proxyOwner);
    {
      vm.expectEmit(true, false, false, false);
      emit Upgraded(newImpl);
      proxy.upgradeImplementation();

      proxyAsImpl.fn();
      assertEq(proxyAsImpl.value(), 27);
    }
  }

  function testProxyDoesNotDelegateCallWithUpgradeDataWhenCreated()
    public
    impersonating(repoOwner)
  {
    repo.append(address(failingImpl));
    repo.setUpgradeDataFor(
      address(failingImpl),
      abi.encodeWithSelector(failingImpl.fn.selector, "")
    );

    // if the proxy were delegate calling on creation it would fail here because
    // the data we passed to delegate call unconditionally reverts
    new UcuProxy(repo, proxyOwner);
  }

  function testProxyUpgradeRevertsWhenUpgradeDataDelegateCallFails()
    public
    impersonating(repoOwner)
  {
    UcuProxy newProxy = new UcuProxy(repo, proxyOwner);

    repo.append(address(failingImpl));
    repo.setUpgradeDataFor(
      address(failingImpl),
      abi.encodeWithSelector(failingImpl.fn.selector, "")
    );

    vm.stopPrank();
    vm.startPrank(proxyOwner);
    vm.expectRevert("failed in proxied call");
    newProxy.upgradeImplementation();
  }

  function testProxyDelegateCallsWithUpgradeDataWhenUpgrading() public impersonating(repoOwner) {
    repo.append(address(subtractingImpl));
    repo.setUpgradeDataFor(
      address(subtractingImpl),
      abi.encodeWithSelector(subtractingImpl.fn.selector, "")
    );
    vm.stopPrank();

    vm.startPrank(proxyOwner);
    uint256 valueBefore = proxyAsImpl.value();
    proxy.upgradeImplementation();
    // subtract should have been called while migrating
    assertEq(proxyAsImpl.value(), valueBefore - 1);
  }

  function testProxyWillUseCurrentImplementationFromCurrentSet() public {
    vm.startPrank(repoOwner);
    uint256 newSetId = repo.createLineage(address(subtractingImpl));
    assertEq(repo.currentImplementation(), address(subtractingImpl));

    // the head of the latest lineage is the subtracting impl, so fn should
    // decrement value
    UcuProxy subberProxy = new UcuProxy(repo, proxyOwner);
    BaseImpl subber = BaseImpl(address(subberProxy));
    subber.initialize(25);
    assertEq(subber.value(), 25);
    subber.fn();
    assertEq(subber.value(), 24);

    address newImpl = address(new AddingImplementation());
    repo.append(newImpl, newSetId);
    assertEq(repo.currentImplementation(), newImpl);

    // subber should behave normally because we haven't upgrade it
    assertEq(subber.value(), 24);
    subber.fn();
    assertEq(subber.value(), 23);

    // the latest impl is adding, so a new proxy should add
    UcuProxy adderProxy = new UcuProxy(repo, proxyOwner);
    BaseImpl adder = BaseImpl(address(adderProxy));
    adder.initialize(25);
    assertEq(adder.value(), 25);
    adder.fn();
    assertEq(adder.value(), 26);
    vm.stopPrank();

    vm.startPrank(proxyOwner);
    subberProxy.upgradeImplementation(); // subber to adder
    assertEq(subber.value(), 23);
    subber.fn();
    assertEq(subber.value(), 24);

    vm.expectRevert("no upgrade");
    adderProxy.upgradeImplementation();
  }

  function testProxyUsesCurrentImplementationWhenCreated() public {
    proxyAsImpl.initialize(25);
    assertEq(proxyAsImpl.value(), 25);
    proxyAsImpl.fn();
    assertEq(proxyAsImpl.value(), 26);

    vm.startPrank(repoOwner);
    repo.append(address(subtractingImpl));
    vm.stopPrank();
    assertEq(address(repo.currentImplementation()), address(subtractingImpl));

    vm.startPrank(proxyOwner);
    vm.expectEmit(true, false, false, false);
    emit Upgraded(address(subtractingImpl));
    proxy.upgradeImplementation();
    vm.stopPrank();

    // value persists
    assertEq(proxyAsImpl.value(), 26);
    proxyAsImpl.fn();
    assertEq(proxyAsImpl.value(), 25);

    vm.startPrank(proxyOwner);
    vm.expectRevert("no upgrade");
    proxy.upgradeImplementation();
  }

  function testTransferOwnershipWorksAsOwner(address newOwner) public impersonating(proxyOwner) {
    vm.expectEmit(true, true, false, false);
    emit OwnershipTransferred(proxy.owner(), newOwner);
    proxy.transferOwnership(newOwner);
    assertEq(newOwner, proxy.owner());
  }

  function testTransferOwnershipFailsWhenNotOwner(
    address caller,
    address newOwner
  ) public impersonating(caller) {
    vm.assume(caller != proxy.owner());
    vm.expectRevert(bytes("NA"));
    proxy.transferOwnership(newOwner);
  }

  function testProxyUpgradeImplementationRevertsIfNotOwner(
    address caller
  ) public impersonating(caller) {
    vm.assume(caller != proxy.owner());
    vm.expectRevert(bytes("NA"));
    proxy.upgradeImplementation();
  }

  function testProxyUpgradeImplementationFailsIfNextImplIsNotRegistered()
    public
    impersonating(proxyOwner)
  {
    address currentImpl = repo.currentImplementation();
    assertFalse(repo.hasNext(address(currentImpl)));

    vm.expectRevert("no upgrade");
    proxy.upgradeImplementation();
  }

  modifier impersonating(address who) {
    vm.startPrank(who);
    _;
  }

  function _asFakeContract(address x) internal {
    vm.etch(x, bytes("FAKE CODEFASDFASDFASDFADSFASDFDSAF"));
  }

  modifier asFakeContract(address x) {
    vm.assume(x != address(0));
    _asFakeContract(x);
    _;
  }

  modifier notContract(address x) {
    uint32 nBytes;
    assembly {
      nBytes := extcodesize(x)
    }

    vm.assume(nBytes == 0);
    _;
  }

  event Upgraded(address indexed implementation);
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
}

abstract contract BaseImpl {
  uint256 public value;

  function initialize(uint256 _value) external {
    value = _value;
  }

  function fn() external virtual;
}

contract SubtractingImplementation is BaseImpl {
  function fn() external override {
    value -= 1;
  }
}

contract AddingImplementation is BaseImpl {
  function fn() external override {
    value += 1;
  }
}

contract FailingImplementation is BaseImpl {
  function fn() external override {
    revert("failed in proxied call");
  }
}
