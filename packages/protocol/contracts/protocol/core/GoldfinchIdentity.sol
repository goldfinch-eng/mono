// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "../../external/ERC1155PresetPauserUpgradeable.sol";
import "../../interfaces/IGoldfinchIdentity.sol";

/**
 * @title GoldfinchIdentity
 * @notice GoldfinchIdentity is an ERC1155-compliant contract for representing
 * the identity verification status of addresses.
 * @author Goldfinch
 */

contract GoldfinchIdentity is ERC1155PresetPauserUpgradeable, IGoldfinchIdentity {
  bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

  /// TODO[PR] Do we need to worry about OZ automatically setting owner as msg.sender? (See PoolTokens.)

  function initialize(string memory uri) public override(ERC1155PresetPauserUpgradeable) initializer {
    super.initialize(uri);
    __GoldfinchIdentity_init(uri);
  }

  function __GoldfinchIdentity_init(string memory uri) internal initializer {
    __GoldfinchIdentity_init_unchained(uri);
  }

  function __GoldfinchIdentity_init_unchained(string memory uri) internal initializer {
    _setupRole(SIGNER_ROLE, _msgSender());
  }

  function mint(
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data,
    bytes memory signature
  ) public override(IGoldfinchIdentity) onlySigner(keccak256(abi.encodePacked(to, id, amount)), signature) {
    _mint(to, id, amount, data);
  }

  function mintBatch(
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data,
    bytes memory signature
  ) public override(IGoldfinchIdentity) onlySigner(keccak256(abi.encodePacked(to, ids, amounts)), signature) {
    _mintBatch(to, ids, amounts, data);
  }

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal override(ERC1155PresetPauserUpgradeable) {
    require(false, "Transfer is disabled");
  }

  function burn(
    address account,
    uint256 id,
    uint256 value,
    bytes memory signature
  )
    public
    override(ERC1155BurnableUpgradeable, IGoldfinchIdentity)
    onlySigner(keccak256(abi.encodePacked(to, id, value)), signature)
  {
    _burn(account, id, value);
  }

  function burnBatch(
    address account,
    uint256[] memory ids,
    uint256[] memory values,
    bytes memory signature
  )
    public
    override(ERC1155BurnableUpgradeable, IGoldfinchIdentity)
    onlySigner(keccak256(abi.encodePacked(to, ids, values)), signature)
  {
    _burnBatch(account, ids, values);
  }

  modifier onlySigner(bytes32 hash, bytes memory signature) {
    require(hasRole(SIGNER_ROLE, ECDSA.recover(hash, signature)), "Invalid signer");
    _;
  }
}
