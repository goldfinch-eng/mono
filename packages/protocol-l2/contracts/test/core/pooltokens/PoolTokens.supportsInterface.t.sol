// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {PoolTokensBaseTest} from "./PoolTokensBase.t.sol";

contract PoolTokensSupportsInterfaceTest is PoolTokensBaseTest {
  function testSupportsERC721() public {
    assertTrue(poolTokens.supportsInterface(0x80ac58cd));
  }

  function testSupportsERC721METADATA() public {
    assertTrue(poolTokens.supportsInterface(0x5b5e139f));
  }

  function testSupportsERC721ENUMERABLE() public {
    assertTrue(poolTokens.supportsInterface(0x780e9d63));
  }

  function testSupportsERC165() public {
    assertTrue(poolTokens.supportsInterface(0x01ffc9a7));
  }

  function testSupportsERC2981() public {
    assertTrue(poolTokens.supportsInterface(0x2a55205a));
  }
}
