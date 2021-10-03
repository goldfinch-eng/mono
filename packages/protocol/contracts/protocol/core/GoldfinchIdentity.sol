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
    bytes memory signature
  )
    public
    payable
    override
    onlySigner(keccak256(abi.encodePacked(to, id, amount, nonces[to])), signature)
    incrementNonce(to)
  {
    require(msg.value >= MINT_COST_PER_TOKEN, "Token mint requires 0.00083 ETH");
    require(id == ID_VERSION_0, "Token id not supported");
    require(balanceOf(to, id) == 0, "Balance before mint must be 0");
    require(amount > 0, "Amount must be greater than 0");

    _mint(to, id, amount, "");
  }

  function burn(
    address account,
    uint256 id,
    uint256 value,
    bytes memory signature
  )
    public
    override
    onlySigner(keccak256(abi.encodePacked(account, id, value, nonces[account])), signature)
    incrementNonce(account)
  {
    _burn(account, id, value);

    uint256 accountBalance = balanceOf(account, id);
    require(accountBalance == 0, "Balance after burn must be 0");
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

  modifier incrementNonce(address account) {
    nonces[account] += 1;
    _;
  }
}
