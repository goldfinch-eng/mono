// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

// solhint-disable-next-line max-line-length
import {ImplementationRepository} from "../../../protocol/core/proxy/ImplementationRepository.sol";
import {BaseTest} from "../BaseTest.t.sol";

contract ImplementationRepositoryTest is BaseTest {
  address internal constant owner = 0x483e2BaF7F4e0Ac7D90c2C3Efc13c3AF5050F3c2;

  ImplementationRepository internal repo;
  address internal initialImpl = address(new Dummy());

  function setUp() public override {
    super.setUp();
    repo = new ImplementationRepository();
    vm.label(owner, "owner");

    fuzzHelper.exclude(owner);
    fuzzHelper.exclude(address(repo));
    fuzzHelper.exclude(initialImpl);
  }

  function testCannotCallInitializeTwiceAsAnyone(
    address caller,
    address impl,
    address otherImpl
  )
    public
    impersonating(caller)
    withFakeContract(caller)
    withFakeContract(impl)
    withFakeContract(otherImpl)
  {
    // first call should succeed
    repo.initialize(caller, impl);

    // second should fail
    vm.expectRevert("Contract instance has already been initialized");
    repo.initialize(caller, otherImpl);
  }

  function testAppendingAnEOAReverts() public afterInitializingRepository impersonating(owner) {
    vm.expectRevert("not a contract");
    repo.append(owner);
  }

  function testCreatingLineageWithEoaReverts()
    public
    afterInitializingRepository
    impersonating(owner)
  {
    vm.expectRevert("not a contract");
    repo.createLineage(owner);
  }

  function testInitializeSetsCorrectState(
    address _owner,
    address impl
  ) public notNull(_owner) withFakeContract(impl) {
    repo.initialize(_owner, impl);
    assertTrue(repo.hasRole(repo.OWNER_ROLE(), _owner));
    assertTrue(repo.hasRole(repo.PAUSER_ROLE(), _owner));
    assertEq(repo.currentImplementation(), impl);
    assertFalse(repo.hasNext(repo.currentImplementation()));
  }

  function testInitializeFailsWhenOwnerIsNull(address impl) external withFakeContract(impl) {
    vm.expectRevert("Owner cannot be the zero address");
    repo.initialize(address(0), impl);
  }

  function testCreateSetSucceedsWhenOwnerCalls(
    address impl
  ) external impersonating(owner) afterInitializingRepository withFakeContract(impl) {
    uint256 previousLineageId = repo.currentLineageId();
    uint256 expectedLineageId = previousLineageId + 1;
    // should be the next lineage id
    vm.expectEmit(true, true, true, false);
    emit Added(expectedLineageId, impl, address(0));
    assertEq(repo.createLineage(impl), expectedLineageId);
    assertEq(repo.currentLineageId(), expectedLineageId);
    assertEq(repo.currentImplementation(), impl);
    assertEq(repo.currentImplementation(expectedLineageId), impl);
  }

  function testCreateSetFailsWhenNonOwnerCalls(
    address impl,
    address caller
  ) external impersonating(caller) withFakeContract(impl) onlyAllowListed(caller) {
    vm.expectRevert(bytes("Must have admin role to perform this action"));
    repo.createLineage(impl);
  }

  function testRemoveRemovesAndStitchesTheChainBackTogether(
    address a,
    address b,
    address c
  )
    external
    impersonating(owner)
    afterInitializingRepository
    withFakeContract(a)
    withFakeContract(b)
    withFakeContract(c)
    // none of these should be equal eachother
    assume(a != b && b != c && c != a)
    // none of them should be the initial impl
    onlyAllowListed(a)
    onlyAllowListed(b)
    onlyAllowListed(c)
  {
    vm.label(a, "a");
    vm.label(b, "b");
    vm.label(c, "c");

    repo.append(a);
    repo.append(b);
    repo.append(c);

    // C is the last impl we added
    assertEq(address(repo.currentImplementation()), address(c));
    assertEq(address(repo.nextImplementationOf(a)), address(b));

    // chain before removal: A -> B -> C

    vm.expectEmit(true, true, false, false);
    emit Removed(repo.currentLineageId(), b);

    // try to remove one that isn't the previous impl
    assertTrue(repo.nextImplementationOf(c) != b);
    vm.expectRevert("Not prev");
    repo.remove(b, c);

    repo.remove(b, a);
    // chain after removal: A -> C

    assertEq(address(repo.nextImplementationOf(a)), address(c));
    // C should still be the head
    assertEq(address(repo.currentImplementation()), address(c));

    // B should be removed
    assertFalse(repo.has(b));

    // we should be able to re-add it
    vm.expectEmit(true, true, true, false);
    emit Added(repo.currentLineageId(), b, c);
    repo.append(b);
    assertTrue(repo.has(b));
    assertEq(address(repo.currentImplementation()), address(b));
    assertEq(address(repo.nextImplementationOf(c)), address(b));
  }

  function testSetUpgradeDataForSucceedsWhenOwnerWithRegisteredContract(
    address impl,
    bytes calldata data
  )
    public
    afterInitializingRepository
    impersonating(owner)
    assume(impl != owner)
    assume(impl != address(repo))
    assume(impl != initialImpl)
    withFakeContract(impl)
  {
    repo.append(impl);
    vm.expectEmit(true, true, false, false);
    emit UpgradeDataSet(impl, data);
    repo.setUpgradeDataFor(impl, data);
    assertEq(repo.upgradeDataFor(impl), data);
  }

  function testCurrentFailsWhenPaused() public impersonating(owner) afterInitializingRepository {
    repo.pause();
    vm.expectRevert("Pausable: paused");
    repo.currentImplementation();

    uint256 lineageId = repo.currentLineageId();
    vm.expectRevert("Pausable: paused");
    repo.currentImplementation(lineageId);
  }

  function testGetNextImplementationOfRevertsWhenPaused()
    public
    impersonating(owner)
    afterInitializingRepository
  {
    repo.pause();
    vm.expectRevert("Pausable: paused");
    repo.nextImplementationOf(address(initialImpl));
  }

  function testSetUpgradeDataForFailsWhenPaused(
    address implementation,
    bytes calldata data
  ) public afterInitializingRepository impersonating(owner) {
    repo.pause();
    vm.expectRevert("Pausable: paused");
    repo.setUpgradeDataFor(implementation, data);
  }

  function testSetUpgradeDataForFailsWhenNotOwner(
    address caller,
    address implementation,
    bytes calldata data
  )
    public
    afterInitializingRepository
    assume(caller != owner && caller != address(0))
    impersonating(caller)
  {
    vm.expectRevert("Must have admin role to perform this action");
    repo.setUpgradeDataFor(implementation, data);
  }

  function testInitializeFailsWhenImplementationIsNull(address _owner) public notNull(_owner) {
    vm.expectRevert(bytes("not a contract"));
    repo.initialize(_owner, address(0));
  }

  function testThatItIsImpossibleToCreateOrphanImplementationsByAppending(
    address[5] calldata impls
  ) external impersonating(owner) afterInitializingRepository {
    for (uint256 i = 0; i < impls.length - 1; i++) {
      _withFakeContract(impls[i]);
      vm.assume(impls[i] != address(0) && impls[i] != initialImpl);
      // no impls should be equal to another impl
      for (uint256 j = i + 1; j < impls.length; j++) {
        vm.assume(impls[i] != impls[j]);
      }

      repo.append(impls[i]);
      assertEq(repo.currentImplementation(), impls[i]);
      assertFalse(repo.hasNext(impls[i]));

      // the last impl should be pointing at this impl
      if (i > 0) {
        assertTrue(repo.hasNext(impls[i - 1]));
        assertEq(repo.nextImplementationOf(impls[i - 1]), impls[i]);
      }
    }

    // start at the first version and navigate to the end of the implementation
    // mappings if there is no discontinuit we expect that the implementation we
    // end up will be the current impl
    address cursor = initialImpl;
    while (repo.hasNext(cursor)) {
      cursor = repo.nextImplementationOf(cursor);
    }

    address current = repo.currentImplementation();
    vm.label(current, "head impl");
    assertEq(cursor, current);
  }

  function testLineagesWorkAsExpected(
    address a,
    address b
  )
    public
    impersonating(owner)
    afterInitializingRepository
    withFakeContract(a)
    withFakeContract(b)
    // none of these should be equal eachother
    assume(a != b)
    onlyAllowListed(a)
    onlyAllowListed(b)
  {
    vm.label(a, "a");
    vm.label(b, "b");
    uint256 startingLineageId = repo.currentLineageId();
    uint256 aLineageId = startingLineageId + 1;
    assertEq(repo.createLineage(a), aLineageId);
    assertEq(repo.currentLineageId(), aLineageId);
    assertEq(repo.currentImplementation(aLineageId), a);
    assertEq(repo.currentImplementation(), a);

    /*
      1: initial
      2: a
    */
    repo.append(b, startingLineageId);
    /*
      1: initial -> b
      2: a
    */
    assertEq(repo.currentImplementation(), a);
    assertEq(repo.currentImplementation(startingLineageId), b);
  }

  function testAppendRevertsWhenPassedAnInvalidLineageId(
    address impl
  )
    public
    impersonating(owner)
    withFakeContract(impl)
    assume(impl != address(repo))
    afterInitializingRepository
    assume(!repo.has(impl))
  {
    vm.expectRevert("invalid lineageId");
    repo.append(impl, 0);
  }

  function testAppendFailsWhenPaused(
    address impl
  )
    public
    afterInitializingRepository
    impersonating(owner)
    withFakeContract(impl)
    assume(!repo.has(impl))
  {
    repo.pause();
    assertTrue(repo.paused());
    vm.expectRevert("Pausable: paused");
    repo.append(impl);
  }

  function testAppendSetsCurrent(
    address first,
    address second
  )
    public
    impersonating(owner)
    afterInitializingRepository
    withFakeContract(first)
    withFakeContract(second)
    assume(first != second)
    assume(!repo.has(first) && !repo.has(second))
  {
    address initial = repo.currentImplementation();
    repo.append(first);
    assertTrue(repo.hasNext(initial));
    assertEq(address(repo.nextImplementationOf(initial)), address(first));
    assertFalse(repo.hasNext(first));
    assertEq(address(repo.currentImplementation()), address(first));

    repo.append(second);
    assertTrue(repo.hasNext(initial));
    assertEq(address(repo.nextImplementationOf(initial)), address(first));
    assertTrue(repo.hasNext(first));
    assertEq(address(repo.nextImplementationOf(first)), address(second));
    assertFalse(repo.hasNext(second));
    assertEq(address(repo.currentImplementation()), address(second));
  }

  function testOnlyOwnerCanAppend(
    address caller,
    address impl
  ) public impersonating(caller) afterInitializingRepository assume(caller != owner) {
    vm.expectRevert("Must have admin role to perform this action");
    repo.append(impl);
  }

  function testAppendFailsWhenImplementationIsAlreadyRegistered(
    address impl
  )
    public
    impersonating(owner)
    afterInitializingRepository
    withFakeContract(impl)
    assume(impl != initialImpl)
  {
    repo.append(impl);

    vm.expectRevert("exists");
    repo.append(impl);
  }

  function _withFakeContract(address x) internal {
    uint32 nBytes;
    assembly {
      nBytes := extcodesize(x)
    }

    bool isAlreadyAContract = nBytes > 0;
    if (isAlreadyAContract) return;

    vm.assume(x != address(0));
    vm.etch(x, bytes("SUPER SECRET CODE"));
  }

  modifier withFakeContract(address x) {
    vm.assume(x != address(0));
    _withFakeContract(x);
    _;
  }

  modifier afterInitializingRepository() {
    repo.initialize(owner, initialImpl);
    _;
  }

  modifier notNull(address x) {
    vm.assume(x != address(0));
    _;
  }

  event Added(
    uint256 indexed lineageId,
    address indexed newImplementation,
    address indexed oldImplementation
  );
  event Removed(uint256 indexed lineageId, address indexed implementation);
  event UpgradeDataSet(address indexed implementation, bytes data);
}

contract Dummy {}
