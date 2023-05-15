// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import {IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC165Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {ConfigurableRoyaltyStandard} from "../protocol/core/ConfigurableRoyaltyStandard.sol";
import {HasAdmin} from "../protocol/core/HasAdmin.sol";

contract TestConfigurableRoyaltyStandard is IERC2981Upgradeable, HasAdmin {
  using ConfigurableRoyaltyStandard for ConfigurableRoyaltyStandard.RoyaltyParams;

  ConfigurableRoyaltyStandard.RoyaltyParams public royaltyParams;

  // The library event must be copied to the base contract so that decoding clients
  // don't get confused. See https://medium.com/aragondec/library-driven-development-in-solidity-2bebcaf88736#7ed4
  event RoyaltyParamsSet(address indexed sender, address newReceiver, uint256 newRoyaltyPercent);

  constructor(address owner) initializer {
    __AccessControl_init_unchained();
    _setupRole(OWNER_ROLE, owner);
    _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
  }

  /// @inheritdoc IERC2981Upgradeable
  function royaltyInfo(
    uint256 tokenId,
    uint256 salePrice
  ) external view override returns (address, uint256) {
    return royaltyParams.royaltyInfo(tokenId, salePrice);
  }

  /// @notice Set royalty params used in `royaltyInfo`. This function is only callable by
  ///   an address with `OWNER_ROLE`.
  /// @param newReceiver The new address which should receive royalties. See `receiver`.
  /// @param newRoyaltyPercent The new percent of `salePrice` that should be taken for royalties.
  ///   See `royaltyPercent`.
  function setRoyaltyParams(address newReceiver, uint256 newRoyaltyPercent) external onlyAdmin {
    royaltyParams.setRoyaltyParams(newReceiver, newRoyaltyPercent);
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view override(IERC165Upgradeable, AccessControlUpgradeable) returns (bool) {
    return
      interfaceId == ConfigurableRoyaltyStandard._INTERFACE_ID_ERC2981 ||
      super.supportsInterface(interfaceId);
  }
}
