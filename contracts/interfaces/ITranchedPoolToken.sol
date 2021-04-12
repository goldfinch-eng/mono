// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721.sol";
import "./ITranchedPool.sol";

abstract contract ITranchedPoolToken is IERC721 {
  struct TokenInfo {
    ITranchedPool pool;
    uint256 tranche;
    uint256 principalAmount;
    uint256 principalRedeemed;
    uint256 interestRedeemed;
  }

  function getTokenInfo(uint256 tokenId) public view virtual returns (TokenInfo memory);
}
