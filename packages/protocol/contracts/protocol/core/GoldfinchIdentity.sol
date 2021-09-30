// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

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

  uint256 public constant ID_VERSION_0 = 0;

  uint256 public constant MINT_COST_PER_TOKEN = 830000 gwei;

  /// @dev We include a nonce in every hashed message, and increment the nonce as part of a
  /// state-changing operation, so as to prevent replay attacks, i.e. the reuse of a signature.
  mapping(address => uint256) public nonces;

  function initialize(address owner, string memory uri) public initializer {
    require(owner != address(0), "Owner address cannot be empty");

    __ERC1155PresetPauser_init(owner, uri);
    __GoldfinchIdentity_init(owner);
  }

  function __GoldfinchIdentity_init(address owner) internal initializer {
    __GoldfinchIdentity_init_unchained(owner);
  }

  function __GoldfinchIdentity_init_unchained(address owner) internal initializer {
    _setupRole(SIGNER_ROLE, owner);
  }

  function mint(
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data,
    bytes memory signature
  ) public payable override onlySigner(keccak256(abi.encodePacked(to, id, amount, nonces[to])), signature) {
    require(msg.value >= MINT_COST_PER_TOKEN, "Token mint requires 0.00083 ETH");
    require(id == ID_VERSION_0, "Token id not supported");
    require(amount > 0, "Amount must be greater than 0");

    nonces[to] += 1;
    _mint(to, id, amount, data);
  }

  /// @dev We use `abi.encode()` rather than `abi.encodePacked()` for generating the hashed
  /// message passed to `onlySigner()`, because `ids` and `amounts` have dynamic types. Per the Warning in
  /// https://github.com/ethereum/solidity/blob/v0.8.4/docs/abi-spec.rst#non-standard-packed-mode,
  /// `abi.encodePacked()` generates an ambiguous result if more than one dynamic type is passed to it.
  // TODO[PR] See if gas cost is cheaper if instead of using `abi.encode()`, we used `abi.encodePacked()`,
  // plus `keccak256(abi.encodePacked(ids))` to represent ids as a static type (i.e. bytes32), so that only
  // one parameter of the outer `abi.encodePacked()` was dynamic.
  function mintBatch(
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data,
    bytes memory signature
  ) public payable override onlySigner(keccak256(abi.encode(to, ids, amounts, nonces[to])), signature) {
    uint256 length = amounts.length;
    require(ids.length == length, "ids and amounts length mismatch");
    require(msg.value >= MINT_COST_PER_TOKEN * length, "Token mint requires 0.00083 ETH");
    for (uint256 i = 0; i < length; i++) {
      require(ids[i] == ID_VERSION_0, "Token id not supported");
      require(amounts[i] > 0, "Amount must be greater than 0");
    }

    nonces[to] += 1;
    _mintBatch(to, ids, amounts, data);
  }

  function burn(
    address account,
    uint256 id,
    uint256 value,
    bytes memory signature
  ) public override onlySigner(keccak256(abi.encodePacked(account, id, value, nonces[account])), signature) {
    nonces[account] += 1;
    _burn(account, id, value);

    uint256 accountBalance = balanceOf(account, id);
    require(accountBalance == 0, "Balance after burn must be 0");
  }

  /// @dev Same comment as for `mintBatch()` regarding use of `abi.encode()` in generating hashed message
  /// passed to `onlySigner()`.
  function burnBatch(
    address account,
    uint256[] memory ids,
    uint256[] memory values,
    bytes memory signature
  ) public override onlySigner(keccak256(abi.encode(account, ids, values, nonces[account])), signature) {
    nonces[account] += 1;
    _burnBatch(account, ids, values);

    for (uint256 i = 0; i < ids.length; i++) {
      uint256 accountBalance = balanceOf(account, ids[i]);
      require(accountBalance == 0, "Balance after burn must be 0");
    }
  }

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal override(ERC1155PresetPauserUpgradeable) {
    require(
      (from == address(0) && to != address(0)) || (from != address(0) && to == address(0)),
      "Only mint xor burn transfers are allowed"
    );
    super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
  }

  modifier onlySigner(bytes32 hash, bytes memory signature) {
    bytes32 ethSignedMessage = ECDSAUpgradeable.toEthSignedMessageHash(hash);
    require(hasRole(SIGNER_ROLE, ECDSAUpgradeable.recover(ethSignedMessage, signature)), "Invalid signer");
    _;
  }
}
