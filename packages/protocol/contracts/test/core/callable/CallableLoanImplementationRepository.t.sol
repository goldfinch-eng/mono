// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {IUcuProxy} from "../../../interfaces/IUcuProxy.sol";
// solhint-disable-next-line max-line-length
import {IVersionedImplementationRepository as IRepo} from "../../../interfaces/IVersionedImplementationRepository.sol";
import {Test} from "forge-std/Test.sol";

contract CallableLoanImplementationRepositoryTest is Test {
  address internal constant OWNER = 0x8b0dD65C31EBDC4586AE55855577de020601E36d;

  CallableLoan internal callableLoanImpl = new CallableLoan();
  IRepo internal repo = IRepo(deployCode("CallableLoanImplementationRepository.sol"));

  function testCanInitializeWithCurrentImpl() public {
    (bool success, ) = address(repo).call(
      abi.encodeWithSignature("initialize(address,address)", OWNER, address(callableLoanImpl))
    );
    require(success, "initialize failed");
    assertEq(repo.currentImplementation(), address(callableLoanImpl));
    assertEq(repo.getByVersion(callableLoanImpl.getVersion()), address(callableLoanImpl));
    assertTrue(repo.hasVersion(callableLoanImpl.getVersion()));
  }

  function testProxyInitializesCorrectly() public {
    (bool success, ) = address(repo).call(
      abi.encodeWithSignature("initialize(address,address)", OWNER, address(callableLoanImpl))
    );
    require(success, "initialize failed");
    vm.expectEmit(true, false, false, false);
    emit Upgraded(address(callableLoanImpl));
    IUcuProxy proxy = IUcuProxy(
      deployCode("UcuProxy.sol", abi.encode(repo, OWNER, repo.currentLineageId()))
    );
    CallableLoan proxyAsTp = CallableLoan(address(proxy));
    assertVersionEq(proxyAsTp.getVersion(), callableLoanImpl.getVersion());
  }

  function assertVersionEq(uint8[3] memory a, uint8[3] memory b) internal returns (bool) {
    return a[0] == b[0] && a[1] == b[1] && a[2] == b[2];
  }

  event Upgraded(address indexed implementation);
}
