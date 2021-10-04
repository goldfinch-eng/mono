// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";

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
  function mint(address account, uint256 amount) public override whenNotPaused {
    require(mintingAmountIsWithinCap(amount), "Cannot mint more than cap");
    super.mint(account, amount);
  }

  /**
   * @notice sets the maximum number of tokens that can be minted
   * @dev the cap must be greater than the current total supply
   */
  function setCap(uint256 _cap) external onlyOwner {
    require(_cap >= totalSupply(), "Cannot decrease the cap below existing supply");
    cap = _cap;
    emit CapUpdated(_msgSender(), cap);
  }

  function mintingAmountIsWithinCap(uint256 amount) internal returns (bool) {
    return totalSupply().add(amount) <= cap;
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
