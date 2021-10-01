// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

<<<<<<< HEAD:packages/protocol/contracts/protocol/core/GFI.sol
import "@openzeppelin/contracts-ethereum-package/contracts/presets/ERC20PresetMinterPauser.sol";
import "./ConfigHelper.sol";
=======
import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";
>>>>>>> [feature] cap the max amount of GFI:packages/protocol/contracts/staking/GFI.sol

/**
 * @title GFI
 * @notice GFI is Goldfinch's governance token.
 * @author Goldfinch
 */
contract GFI is ERC20PresetMinterPauser {
  using SafeMath for uint256;

  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

  /// The maximum number of tokens that can be minted
  uint256 public cap;

  event CapUpdated(address indexed who, uint256 cap);

  constructor(
    address owner,
    string memory name,
    string memory symbol,
    uint256 initialCap
  ) public ERC20PresetMinterPauser(name, symbol) {
    cap = initialCap;

    _setupRole(MINTER_ROLE, owner);
    _setupRole(PAUSER_ROLE, owner);
    _setupRole(OWNER_ROLE, owner);

    _setRoleAdmin(MINTER_ROLE, OWNER_ROLE);
    _setRoleAdmin(PAUSER_ROLE, OWNER_ROLE);
    _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
  }

  /**
   * @notice create and send tokens to a specified address
   * @dev this function will fail if the caller attempts to mint over the current cap
   */
  // solhint-disable-next-line modifiers/ensure-modifiers
  function mint(address account, uint256 amount) public override onlyMinter {
    require(mintingAmountIsWithinCap(amount, totalSupply(), cap), "Cannot mint more than cap");
    _mint(account, amount);
  }

  /**
   * @notice sets the maximum number of tokens that can be minted
   * @dev the cap must be greater than the current total supply
   */
  // solhint-disable-next-line modifiers/ensure-modifiers
  function setCap(uint256 cap_) external onlyOwner {
    require(cap_ >= totalSupply(), "Cannot decrease the cap below existing supply");
    cap = cap_;
    emit CapUpdated(_msgSender(), cap);
  }

  function mintingAmountIsWithinCap(
    uint256 amount,
    uint256 totalSupply,
    uint256 cap_
  ) internal pure returns (bool) {
    return totalSupply.add(amount) <= cap_;
  }

  modifier onlyOwner() {
    require(hasRole(OWNER_ROLE, _msgSender()), "Must be owner");
    _;
  }

  modifier onlyMinter() {
    require(hasRole(MINTER_ROLE, _msgSender()), "Must be minter");
    _;
  }
}
