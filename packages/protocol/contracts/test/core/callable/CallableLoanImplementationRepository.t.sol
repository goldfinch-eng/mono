// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {UcuProxy} from "../../../protocol/core/proxy/UcuProxy.sol";
// solhint-disable-next-line max-line-length
import {CallableLoanImplementationRepository as Repo} from "../../../protocol/core/callable/CallableLoanImplementationRepository.sol";
import {Test} from "forge-std/Test.sol";

contract CallableLoanImplementationRepositoryTest is Test {
  address internal constant OWNER = 0x8b0dD65C31EBDC4586AE55855577de020601E36d;

  CallableLoan internal callableLoanImpl = new CallableLoan();
  Repo internal repo = new Repo();

  function testCanInitializeWithCurrentImpl() public {
    repo.initialize(OWNER, address(callableLoanImpl));
    assertEq(repo.currentImplementation(), address(callableLoanImpl));
    assertEq(repo.getByVersion(callableLoanImpl.getVersion()), address(callableLoanImpl));
    assertTrue(repo.hasVersion(callableLoanImpl.getVersion()));
  }

  function testProxyInitializesCorrectly() public {
    repo.initialize(OWNER, address(callableLoanImpl));

    vm.expectEmit(true, false, false, false);
    emit Upgraded(address(callableLoanImpl));
    UcuProxy proxy = new UcuProxy(repo, OWNER, repo.currentLineageId());
    CallableLoan proxyAsTp = CallableLoan(address(proxy));
    assertVersionEq(proxyAsTp.getVersion(), callableLoanImpl.getVersion());
  }

  function assertVersionEq(uint8[3] memory a, uint8[3] memory b) internal returns (bool) {
    return a[0] == b[0] && a[1] == b[1] && a[2] == b[2];
  }

  event Upgraded(address indexed implementation);
}
