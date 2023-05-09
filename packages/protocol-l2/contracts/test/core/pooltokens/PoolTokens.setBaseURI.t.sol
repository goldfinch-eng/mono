// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {PoolTokensBaseTest} from "./PoolTokensBase.t.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";

contract PoolTokensSetBaseURITest is PoolTokensBaseTest {
  function testRevertsForNonAdmin(
    address nonAdmin,
    string memory baseUri
  ) public impersonating(nonAdmin) {
    vm.assume(nonAdmin != GF_OWNER);
    vm.expectRevert(bytes("AD"));
    poolTokens.setBaseURI(baseUri);
  }

  function testAdminCanSet(string memory baseUri) public impersonating(GF_OWNER) {
    poolTokens.setBaseURI(baseUri);
    assertEq(
      keccak256(abi.encodePacked(poolTokens.tokenURI(1))),
      keccak256(abi.encodePacked(baseUri, "1"))
    );
  }

  function testTokenUriUsesBaseUri() public impersonating(GF_OWNER) {
    (TranchedPool tp, ) = defaultTp();

    poolTokens.setBaseURI("http://example.com/");
    poolTokens._disablePoolValidation(true);
    poolTokens._setSender(payable(address(tp)));

    uint256 tokenId = poolTokens.mint(
      IPoolTokens.MintParams({principalAmount: 1, tranche: 2}),
      address(this)
    );

    assertEq(
      keccak256(abi.encodePacked(poolTokens.tokenURI(tokenId))),
      keccak256(abi.encodePacked("http://example.com/1"))
    );
  }
}
