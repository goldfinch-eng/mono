// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts-ethereum-package/contracts/presets/ERC20PresetMinterPauser.sol";
import "./ConfigHelper.sol";

/**
 * @title Fidu
 * @notice Fidu (symbol: FIDU) is Goldfinch's liquidity token, representing shares
 *  in the Pool. When you deposit, we mint a corresponding amount of Fidu, and when you withdraw, we
 *  burn Fidu. The share price of the Pool implicitly represents the "exchange rate" between Fidu
 *  and USDC (or whatever currencies the Pool may allow withdraws in during the future)
 * @author Goldfinch
 */

contract Fidu is ERC20PresetMinterPauserUpgradeSafe {
  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  /*
    We are using our own initializer function so we can set the owner by passing it in.
    I would override the regular "initializer" function, but I can't because it's not marked
    as "virtual" in the parent contract
  */
  // solhint-disable-next-line func-name-mixedcase
  function __initialize__(
    address owner,
    string memory name,
    string memory symbol,
    GoldfinchConfig _config
  ) public initializer {
    __Context_init_unchained();
    __AccessControl_init_unchained();
    __ERC20_init_unchained(name, symbol);

    __ERC20Burnable_init_unchained();
    __Pausable_init_unchained();
    __ERC20Pausable_init_unchained();

    config = _config;

    _setupRole(MINTER_ROLE, owner);
    _setupRole(PAUSER_ROLE, owner);
    _setupRole(OWNER_ROLE, owner);

    _setRoleAdmin(MINTER_ROLE, OWNER_ROLE);
    _setRoleAdmin(PAUSER_ROLE, OWNER_ROLE);
    _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
  }

  /**
   * @dev Creates `amount` new tokens for `to`.
   *
   * See {ERC20-_mint}.
   *
   * Requirements:
   *
   * - the caller must have the `MINTER_ROLE`.
   */
  function mintTo(address to, uint256 amount) public {
    require(canMint(amount), "Cannot mint: it would create an asset/liability mismatch");
    // This will lock the function down to only the minter
    super.mint(to, amount);
  }

  /**
   * @dev Destroys `amount` tokens from `account`, deducting from the caller's
   * allowance.
   *
   * See {ERC20-_burn} and {ERC20-allowance}.
   *
   * Requirements:
   *
   * - the caller must have the MINTER_ROLE
   */
  function burnFrom(address from, uint256 amount) public override {
    require(hasRole(MINTER_ROLE, _msgSender()), "ERC20PresetMinterPauser: Must have minter role to burn");
    require(canBurn(amount), "Cannot burn: it would create an asset/liability mismatch");
    _burn(from, amount);
  }

  // Internal functions

  // canMint assumes that the USDC that backs the new shares has already been sent to the Pool
  function canMint(uint256 newAmount) internal view returns (bool) {
    uint256 liabilities = totalSupply().add(newAmount).mul(config.getPool().sharePrice()).div(fiduMantissa());
    uint256 liabilitiesInDollars = fiduToUSDC(liabilities);
    uint256 _assets = config.getPool().assets();
    // $1 threshold to handle potential rounding errors, from differing decimals on Fidu and USDC;
    uint256 threshold = 1e6;
    if (_assets >= liabilitiesInDollars) {
      return _assets.sub(liabilitiesInDollars) <= threshold;
    } else {
      return liabilitiesInDollars.sub(_assets) <= threshold;
    }
  }

  // canBurn assumes that the USDC that backed these shares has already been moved out the Pool
  function canBurn(uint256 amountToBurn) internal view returns (bool) {
    uint256 liabilities = totalSupply().sub(amountToBurn).mul(config.getPool().sharePrice()).div(fiduMantissa());
    uint256 liabilitiesInDollars = fiduToUSDC(liabilities);
    uint256 _assets = config.getPool().assets();
    // $1 threshold to handle potential rounding errors, from differing decimals on Fidu and USDC;
    uint256 threshold = 1e6;
    if (_assets >= liabilitiesInDollars) {
      return _assets.sub(liabilitiesInDollars) <= threshold;
    } else {
      return liabilitiesInDollars.sub(_assets) <= threshold;
    }
  }

  function fiduToUSDC(uint256 amount) internal view returns (uint256) {
    return amount.div(fiduMantissa().div(usdcMantissa()));
  }

  function fiduMantissa() internal view returns (uint256) {
    return uint256(10)**uint256(decimals());
  }

  function usdcMantissa() internal view returns (uint256) {
    return uint256(10)**uint256(config.getUSDC().decimals());
  }
}
