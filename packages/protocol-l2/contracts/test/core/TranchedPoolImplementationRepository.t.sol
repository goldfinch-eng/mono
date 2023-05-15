// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {TranchedPool} from "../../protocol/core/TranchedPool.sol";
import {UcuProxy} from "../../protocol/core/proxy/UcuProxy.sol";
// solhint-disable-next-line max-line-length
import {TranchedPoolImplementationRepository as Repo} from "../../protocol/core/TranchedPoolImplementationRepository.sol";
import {Test} from "forge-std/Test.sol";

contract TranchedPoolImplementationRepositoryTest is Test {
  address internal constant OWNER = 0x8b0dD65C31EBDC4586AE55855577de020601E36d;

  TranchedPool internal tranchedPoolImpl = new TranchedPool();
  Repo internal repo = new Repo();

  function testCanInitializeWithCurrentImpl() public {
    repo.initialize(OWNER, address(tranchedPoolImpl));
    assertEq(repo.currentImplementation(), address(tranchedPoolImpl));
    assertEq(repo.getByVersion(tranchedPoolImpl.getVersion()), address(tranchedPoolImpl));
    assertTrue(repo.hasVersion(tranchedPoolImpl.getVersion()));
  }

  function testProxyInitializesCorrectly() public {
    repo.initialize(OWNER, address(tranchedPoolImpl));

    vm.expectEmit(true, false, false, false);
    emit Upgraded(address(tranchedPoolImpl));
    UcuProxy proxy = new UcuProxy(repo, OWNER, repo.currentLineageId());
    TranchedPool proxyAsTp = TranchedPool(address(proxy));
    assertVersionEq(proxyAsTp.getVersion(), tranchedPoolImpl.getVersion());
  }

  function assertVersionEq(uint8[3] memory a, uint8[3] memory b) internal pure returns (bool) {
    return a[0] == b[0] && a[1] == b[1] && a[2] == b[2];
  }

  event Upgraded(address indexed implementation);
}
