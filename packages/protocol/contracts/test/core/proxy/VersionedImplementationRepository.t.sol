// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

// solhint-disable-next-line max-line-length
import {VersionedImplementationRepository as Repo} from "../../../protocol/core/proxy/VersionedImplementationRepository.sol";
import {BaseTest} from "../BaseTest.t.sol";
import {Test} from "forge-std/Test.sol";
import {IVersioned} from "../../../interfaces/IVersioned.sol";

contract VersionedImplementationRepositoryTest is BaseTest {
  address internal constant owner = 0x8b0dD65C31EBDC4586AE55855577de020601E36d;
  Repo internal repo = new Repo();
  IVersioned internal initialImpl = new InitialImpl();
  IVersioned internal duplicateTagImpl = new DuplicateTagImpl();
  IVersioned internal secondImpl = new Impl1();
  IVersioned internal invalidImpl = IVersioned(address(new InvalidImpl()));

  function setUp() public override {
    super.setUp();
    vm.label(owner, "owner");
    vm.label(address(repo), "repo");
    vm.label(address(initialImpl), "initial impl");
    vm.label(address(duplicateTagImpl), "duplicate tag impl");
    vm.label(address(invalidImpl), "invalid impl");
    vm.label(address(secondImpl), "second impl");
  }

  function testTagIsAssociatedWithInitializingImplementation() public {
    repo.initialize(owner, address(initialImpl));

    assertTrue(repo.hasVersion(initialImpl.getVersion()));
    assertEq(address(repo.getByVersion(initialImpl.getVersion())), address(initialImpl));
  }

  function testGetByTagWorksForAppendedImpl() public afterInit impersonating(owner) {
    assertEq(address(repo.getByVersion(secondImpl.getVersion())), address(0));

    vm.expectEmit(true, true, false, false);
    emit VersionAdded(secondImpl.getVersion(), address(secondImpl));
    repo.append(address(secondImpl));
    assertEq(address(repo.getByVersion(secondImpl.getVersion())), address(secondImpl));
  }

  function testImplementationWithoutGetVersionFunctionReverts()
    public
    afterInit
    impersonating(owner)
  {
    vm.expectRevert();
    repo.append(address(invalidImpl));

    vm.expectRevert();
    repo.createLineage(address(invalidImpl));
  }

  function testRemoveRemovesTheAssociatedVersion() public afterInit impersonating(owner) {
    repo.append(address(secondImpl));
    assertTrue(repo.hasVersion(secondImpl.getVersion()));
    assertEq(address(repo.getByVersion(secondImpl.getVersion())), address(secondImpl));

    vm.expectEmit(true, true, false, false);
    emit VersionRemoved(secondImpl.getVersion(), address(secondImpl));

    repo.remove(address(secondImpl), address(initialImpl));
    assertFalse(repo.hasVersion(secondImpl.getVersion()));
  }

  function testAppendingTheSameTagReverts() public afterInit impersonating(owner) {
    assertVersionEq(initialImpl.getVersion(), duplicateTagImpl.getVersion());
    assertTrue(repo.has(address(initialImpl)));
    assertFalse(repo.has(address(duplicateTagImpl)));

    // both impls share the same tag
    assertTrue(repo.hasVersion(initialImpl.getVersion()));
    assertTrue(repo.hasVersion(duplicateTagImpl.getVersion()));

    // need to hash the bytes to assert equality
    assertVersionEq(initialImpl.getVersion(), duplicateTagImpl.getVersion());
    assertFalse(address(initialImpl) == address(duplicateTagImpl));

    vm.expectRevert("exists");
    repo.append(address(duplicateTagImpl));
  }

  function testTagIsAssociatedWithAppendedImplementation() public afterInit impersonating(owner) {
    repo.append(address(secondImpl));
    assertEq(address(repo.getByVersion(secondImpl.getVersion())), address(secondImpl));
  }

  function assertVersionEq(uint8[3] memory a, uint8[3] memory b) internal pure returns (bool) {
    return a[0] == b[0] && a[1] == b[1] && a[2] == b[2];
  }

  modifier afterInit() {
    repo.initialize(owner, address(initialImpl));
    _;
  }

  event VersionAdded(uint8[3] indexed version, address indexed impl);
  event VersionRemoved(uint8[3] indexed version, address indexed impl);
}

contract InvalidImpl {}

contract DuplicateTagImpl is IVersioned {
  function getVersion() external pure override returns (uint8[3] memory) {
    return [0, 0, 1];
  }
}

contract InitialImpl is IVersioned {
  function getVersion() external pure override returns (uint8[3] memory) {
    return [0, 0, 1];
  }
}

contract Impl1 is IVersioned {
  function getVersion() external pure override returns (uint8[3] memory) {
    return [0, 0, 2];
  }
}
