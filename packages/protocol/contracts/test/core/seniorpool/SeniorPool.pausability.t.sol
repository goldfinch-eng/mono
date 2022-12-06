// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {ISeniorPoolEpochWithdrawals} from "../../../interfaces/ISeniorPoolEpochWithdrawals.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";

contract SeniorPoolPausabilityTest is SeniorPoolBaseTest {
  function testWhenPausedDisallowsDeposit(uint256 amount) public paused {
    vm.expectRevert("Pausable: paused");
    sp.deposit(amount);
  }

  function testWhenPausedDisallowsWithdraw(uint256 amount) public paused {
    vm.expectRevert("Pausable: paused");
    sp.withdraw(amount);
  }

  function testWhenPausedDisallowsWithdrawInFidu(uint256 amount) public paused {
    vm.expectRevert("Pausable: paused");
    sp.withdrawInFidu(amount);
  }

  function testWhenPausedDisallowsInvest(ITranchedPool pool) public paused {
    vm.expectRevert("Pausable: paused");
    sp.invest(pool);
  }

  function testWhenPausedDisallowsRedeem(uint256 tokenId) public paused {
    vm.expectRevert("Pausable: paused");
    sp.redeem(tokenId);
  }

  function testWhenPausedDisallowsWritedown(uint256 tokenId) public paused {
    vm.expectRevert("Pausable: paused");
    sp.writedown(tokenId);
  }

  function testWhenPausedDisallowsRequestWithdrawal(uint256 amount) public paused {
    vm.expectRevert("Pausable: paused");
    sp.requestWithdrawal(amount);
  }

  function testWhenPausedDisallowsAddToWithdrawalRequest(
    uint256 amount,
    uint256 requestId
  ) public paused {
    vm.expectRevert("Pausable: paused");
    sp.addToWithdrawalRequest(amount, requestId);
  }

  function testWhenPausedDisallowsCancelWithdrawalRequest(uint256 requestId) public paused {
    vm.expectRevert("Pausable: paused");
    sp.cancelWithdrawalRequest(requestId);
  }

  function testWhenPausedDisallowsClaimWithdrawalRequest(uint256 requestId) public paused {
    vm.expectRevert("Pausable: paused");
    sp.claimWithdrawalRequest(requestId);
  }

  function testWhenPausedCanUnpause() public paused impersonating(GF_OWNER) {
    sp.unpause();
    assertFalse(sp.paused());
  }

  function testOwnerCanPause() public impersonating(GF_OWNER) {
    sp.pause();
    assertTrue(sp.paused());
  }

  function testNonOwnerCannotPause(
    address nonOwner
  ) public onlyAllowListed(nonOwner) impersonating(nonOwner) {
    vm.expectRevert(bytes("NA"));
    sp.pause();
  }

  function testNonOwnerCannotUnpause(
    address nonOwner
  ) public paused onlyAllowListed(nonOwner) impersonating(nonOwner) {
    vm.expectRevert(bytes("NA"));
    sp.unpause();
  }
}
