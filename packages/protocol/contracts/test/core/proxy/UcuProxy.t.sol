// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {ImplementationRepository as Repo} from "../../../protocol/core/proxy/ImplementationRepository.sol";
import {UcuProxy} from "../../../protocol/core/proxy/UcuProxy.sol";
import {Test} from "forge-std/Test.sol";
import {console2 as console} from "forge-std/console2.sol";

contract TestImplementationRepository is Test {
  address internal constant REPO_OWNER = 0x483e2BaF7F4e0Ac7D90c2C3Efc13c3AF5050F3c2;
  address internal constant PROXY_OWNER = 0x8b0dD65C31EBDC4586AE55855577de020601E36d;

  // impls
  BaseImpl internal addingImpl = new AddingImplementation();
  BaseImpl internal subtractingImpl = new SubtractingImplementation();
  BaseImpl internal doublingImpl = new DoublingImpl();
  BaseImpl internal failingImpl = new FailingImplementation();
  BaseImpl internal initialImpl = addingImpl;

  Repo internal repo = new Repo();
  UcuProxy internal proxy;
  BaseImpl internal proxyAsImpl;

  function setUp() public {
    repo.initialize(REPO_OWNER, address(initialImpl));
    proxy = new UcuProxy(repo, PROXY_OWNER, repo.currentLineageId());
    proxyAsImpl = BaseImpl(address(proxy));
    vm.label(address(proxy), "proxy");
    vm.label(REPO_OWNER, "REPO_OWNER");
    vm.label(PROXY_OWNER, "PROXY_OWNER");
    assertTrue(REPO_OWNER != PROXY_OWNER);
  }

  function testProxyFailsToUpgradeConstructAndUpgradeWhenRepoIsPaused()
    public
    impersonating(REPO_OWNER)
  {
    // there should be an upgrade available
    repo.append(address(subtractingImpl));
    assertEq(repo.nextImplementationOf(address(initialImpl)), address(subtractingImpl));

    repo.pause();

    vm.stopPrank();
    vm.startPrank(PROXY_OWNER);
    uint256 lineageId = repo.currentLineageId();
    vm.expectRevert("Pausable: paused");
    new UcuProxy(repo, REPO_OWNER, lineageId);

    vm.expectRevert("Pausable: paused");
    proxy.upgradeImplementation();
  }

  function testProxyContructorRevertsIfRepoIsNotAContract(
    Repo _repo
  ) public notContract(address(_repo)) {
    uint256 lineageId = repo.currentLineageId();
    vm.expectRevert("bad repo");
    new UcuProxy(_repo, PROXY_OWNER, lineageId);
  }

  function testProxyConstructorRevertsIfOwnerIsNull() public {
    uint256 lineageId = repo.currentLineageId();
    vm.expectRevert(bytes("bad owner"));
    new UcuProxy(repo, address(0), lineageId);
  }

  function testProxyDoesntSwallowErrorsOnImplementationRevert() public impersonating(REPO_OWNER) {
    repo.append(address(failingImpl));
    vm.stopPrank();

    vm.startPrank(PROXY_OWNER);
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

    vm.startPrank(REPO_OWNER);
    {
      repo.createLineage(address(subtractingImpl));
      assertEq(repo.currentImplementation(), address(subtractingImpl));
    }
    vm.stopPrank();

    vm.startPrank(PROXY_OWNER);
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
    vm.startPrank(REPO_OWNER);
    {
      repo.append(newImpl, startingSetId);
      assertEq(repo.currentImplementation(), address(subtractingImpl));
      assertEq(repo.currentImplementation(startingSetId), newImpl);
    }
    vm.stopPrank();

    vm.startPrank(PROXY_OWNER);
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
    impersonating(REPO_OWNER)
  {
    repo.append(address(failingImpl));
    repo.setUpgradeDataFor(
      address(failingImpl),
      abi.encodeWithSelector(failingImpl.fn.selector, "")
    );

    // if the proxy were delegate calling on creation it would fail here because
    // the data we passed to delegate call unconditionally reverts
    new UcuProxy(repo, PROXY_OWNER, repo.currentLineageId());
  }

  function testProxyUpgradeRevertsWhenUpgradeDataDelegateCallFails()
    public
    impersonating(REPO_OWNER)
  {
    UcuProxy newProxy = new UcuProxy(repo, PROXY_OWNER, repo.currentLineageId());

    repo.append(address(failingImpl));
    repo.setUpgradeDataFor(
      address(failingImpl),
      abi.encodeWithSelector(failingImpl.fn.selector, "")
    );

    vm.stopPrank();
    vm.startPrank(PROXY_OWNER);
    vm.expectRevert("failed in proxied call");
    newProxy.upgradeImplementation();
  }

  function testProxyDelegateCallsWithUpgradeDataWhenUpgrading() public impersonating(REPO_OWNER) {
    repo.append(address(subtractingImpl));
    repo.setUpgradeDataFor(
      address(subtractingImpl),
      abi.encodeWithSelector(subtractingImpl.fn.selector, "")
    );
    vm.stopPrank();

    vm.startPrank(PROXY_OWNER);
    uint256 valueBefore = proxyAsImpl.value();
    proxy.upgradeImplementation();
    // subtract should have been called while migrating
    assertEq(proxyAsImpl.value(), valueBefore - 1);
  }

  function testCanCreateProxiesForValidLineages() public {
    vm.startPrank(REPO_OWNER);

    // Setup three lineages
    uint256 lineageId1 = repo.currentLineageId();
    repo.createLineage(address(subtractingImpl));
    uint256 lineageId2 = repo.currentLineageId();
    repo.createLineage(address(doublingImpl));
    uint256 lineageId3 = repo.currentLineageId();

    // Proxy for adder impl should return 5 + 1 = 6
    UcuProxy adderProxy = new UcuProxy(repo, PROXY_OWNER, lineageId1);
    BaseImpl adder = BaseImpl(address(adderProxy));
    adder.initialize(5);
    assertEq(adder.fn(), 6);

    // Proxy for subber impl should return 5 - 1 = 4
    UcuProxy subberProxy = new UcuProxy(repo, PROXY_OWNER, lineageId2);
    BaseImpl subber = BaseImpl(address(subberProxy));
    subber.initialize(5);
    assertEq(subber.fn(), 4);

    // Proxy for doubler impl should return 5 * 2 = 10
    UcuProxy doublerProxy = new UcuProxy(repo, PROXY_OWNER, lineageId3);
    BaseImpl doubler = BaseImpl(address(doublerProxy));
    doubler.initialize(5);
    assertEq(doubler.fn(), 10);
  }

  function testProxyWillUseCurrentImplementationFromCurrentSet() public {
    vm.startPrank(REPO_OWNER);
    uint256 newSetId = repo.createLineage(address(subtractingImpl));
    assertEq(repo.currentImplementation(), address(subtractingImpl));

    // the head of the latest lineage is the subtracting impl, so fn should
    // decrement value
    UcuProxy subberProxy = new UcuProxy(repo, PROXY_OWNER, repo.currentLineageId());
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
    UcuProxy adderProxy = new UcuProxy(repo, PROXY_OWNER, repo.currentLineageId());
    BaseImpl adder = BaseImpl(address(adderProxy));
    adder.initialize(25);
    assertEq(adder.value(), 25);
    adder.fn();
    assertEq(adder.value(), 26);
    vm.stopPrank();

    vm.startPrank(PROXY_OWNER);
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

    vm.startPrank(REPO_OWNER);
    repo.append(address(subtractingImpl));
    vm.stopPrank();
    assertEq(address(repo.currentImplementation()), address(subtractingImpl));

    vm.startPrank(PROXY_OWNER);
    vm.expectEmit(true, false, false, false);
    emit Upgraded(address(subtractingImpl));
    proxy.upgradeImplementation();
    vm.stopPrank();

    // value persists
    assertEq(proxyAsImpl.value(), 26);
    proxyAsImpl.fn();
    assertEq(proxyAsImpl.value(), 25);

    vm.startPrank(PROXY_OWNER);
    vm.expectRevert("no upgrade");
    proxy.upgradeImplementation();
  }

  function testTransferOwnershipWorksAsOwner(address newOwner) public impersonating(PROXY_OWNER) {
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
    impersonating(PROXY_OWNER)
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
    // solhint-disable-next-line no-inline-assembly
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

  function fn() external virtual returns (uint256);
}

contract SubtractingImplementation is BaseImpl {
  function fn() external override returns (uint256) {
    value -= 1;
    return value;
  }
}

contract AddingImplementation is BaseImpl {
  function fn() external override returns (uint256) {
    value += 1;
    return value;
  }
}

contract DoublingImpl is BaseImpl {
  function fn() external override returns (uint256) {
    value *= 2;
    return value;
  }
}

contract FailingImplementation is BaseImpl {
  function fn() external override returns (uint256) {
    revert("failed in proxied call");
  }
}
