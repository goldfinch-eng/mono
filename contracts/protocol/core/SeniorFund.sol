// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./BaseUpgradeablePausable.sol";
import "../../interfaces/IFund.sol";
import "./ConfigHelper.sol";

/**
 * @title Goldfinch's SeniorFund contract
 * @notice Main entry point for senior LPs (a.k.a. capital providers)
 *  Automatically invests across borrower pools using an adjustable strategy.
 * @author Goldfinch
 */
contract SeniorFund is BaseUpgradeablePausable, IFund {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  uint256 public compoundBalance;

  event DepositMade(address indexed capitalProvider, uint256 amount, uint256 shares);
  event WithdrawalMade(address indexed capitalProvider, uint256 userAmount, uint256 reserveAmount);
  event InterestCollected(address indexed payer, uint256 poolAmount, uint256 reserveAmount);
  event PrincipalCollected(address indexed payer, uint256 amount);
  event ReserveFundsCollected(address indexed user, uint256 amount);

  event PrincipalWrittenDown(address indexed tranchedPool, int256 amount);
  event InvestmentMade(address indexed tranchedPool, uint256 amount);

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    __BaseUpgradeablePausable__init(owner);

    config = _config;
    sharePrice = fiduMantissa();

    IERC20withDec usdc = config.getUSDC();
    // Sanity check the address
    usdc.totalSupply();

    bool success = usdc.approve(address(this), uint256(-1));
    require(success, "Failed to approve USDC");
  }

  /**
   * @notice Deposits `amount` USDC from msg.sender into the SeniorFund, and grants you the
   *  equivalent value of FIDU tokens
   * @param amount The amount of USDC to deposit
   */
  function deposit(uint256 amount) external override whenNotPaused withinTransactionLimit(amount) nonReentrant {
    require(amount > 0, "Must deposit more than zero");
    // Check if the amount of new shares to be added is within limits
    uint256 depositShares = getNumShares(amount);
    uint256 potentialNewTotalShares = totalShares().add(depositShares);
    require(sharesWithinLimit(potentialNewTotalShares), "Deposit would put the fund over the total limit.");
    emit DepositMade(msg.sender, amount, depositShares);
    bool success = doUSDCTransfer(msg.sender, address(this), amount);
    require(success, "Failed to transfer for deposit");

    config.getSeniorFundFidu().mintTo(msg.sender, depositShares);
  }

  /**
   * @notice Withdraws USDC from the SeniorFund to msg.sender, and burns the equivalent value of FIDU tokens
   * @param usdcAmount The amount of USDC to withdraw
   */
  function withdraw(uint256 usdcAmount) external override whenNotPaused nonReentrant {
    require(usdcAmount > 0, "Must withdraw more than zero");
    uint256 withdrawShares = getNumShares(usdcAmount);
    _withdraw(usdcAmount, withdrawShares);
  }

  /**
   * @notice Withdraws USDC (denominated in FIDU terms) from the SeniorFund to msg.sender
   * @param fiduAmount The amount of USDC to withdraw in terms of FIDU shares
   */
  function withdrawInFidu(uint256 fiduAmount) external override whenNotPaused nonReentrant {
    require(fiduAmount > 0, "Must withdraw more than zero");
    uint256 usdcAmount = getUSDCAmountFromShares(fiduAmount);
    uint256 withdrawShares = fiduAmount;
    _withdraw(usdcAmount, withdrawShares);
  }

  /**
   * @notice Moves any USDC still in the SeniorFund to Compound, and tracks the amount internally.
   * This is done to earn interest on latent funds until we have other borrowers who can use it.
   *
   * Requirements:
   *  - The caller must be an admin.
   */
  function sweepToCompound() public override onlyAdmin whenNotPaused {
    IERC20 usdc = config.getUSDC();
    uint256 usdcBalance = usdc.balanceOf(address(this));

    ICUSDCContract cUSDC = config.getCUSDCContract();
    // Approve compound to the exact amount
    bool success = usdc.approve(address(cUSDC), usdcBalance);
    require(success, "Failed to approve USDC for compound");

    sweepToCompound(cUSDC, usdcBalance);

    // Remove compound approval to be extra safe
    success = config.getUSDC().approve(address(cUSDC), 0);
    require(success, "Failed to approve USDC for compound");
  }

  /**
   * @notice Moves any USDC from Compound back to the SeniorFund, and recognizes interest earned.
   * This is done automatically on drawdown or withdraw, but can be called manually if necessary.
   *
   * Requirements:
   *  - The caller must be an admin.
   */
  function sweepFromCompound() public override onlyAdmin whenNotPaused {
    _sweepFromCompound();
  }

  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
  }

  /**
   * @notice Invest in an ITranchedPool using the fund's strategy
   * @param pool An ITranchedPool that should be considered for investment
   */
  function invest(ITranchedPool pool) public override {
    require(validPool(pool), "Pool must be valid");

    IFundStrategy strategy = config.getSeniorFundStrategy();
    uint256 amount = strategy.invest(this, pool);
    require(amount > 0, "Investment amount must be positive");

    approvePool(pool, amount);
    pool.deposit(uint256(ITranchedPool.Tranches.Senior), amount);

    emit InvestmentMade(address(pool), amount);
  }

  /**
   * @notice Redeem interest and/or principal from an ITranchedPool investment
   * @param tokenId the ID of an ITranchedPoolToken to be redeemed
   */
  function redeem(uint256 tokenId) public override {
    // TODO: Just withdraw max and adjust share price
  }

  /**
   * @notice Write down an ITranchedPool investment. This will adjust the fund's share price
   *  down if we're considering the investment a loss, or up if the borrower has subsequently
   *  made repayments that restore confidence that the full loan will be repaid.
   * @param pool An ITranchedPool that should be considered for writedown
   */
  function writedown(ITranchedPool pool) public override {
    require(validPool(pool), "Pool must be valid");

    // TODO
  }

  function assets() public view override returns (uint256) {
    // TODO: needs to include pool token principals
    return compoundBalance.add(config.getUSDC().balanceOf(address(this)));
  }

  /* Internal Functions */

  function fiduMantissa() internal pure returns (uint256) {
    return uint256(10)**uint256(18);
  }

  function usdcMantissa() internal pure returns (uint256) {
    return uint256(10)**uint256(6);
  }

  function usdcToFidu(uint256 amount) internal pure returns (uint256) {
    return amount.mul(fiduMantissa()).div(usdcMantissa());
  }

  function fiduToUSDC(uint256 amount) internal pure returns (uint256) {
    return amount.div(fiduMantissa().div(usdcMantissa()));
  }

  function getUSDCAmountFromShares(uint256 fiduAmount) internal view returns (uint256) {
    return fiduToUSDC(fiduAmount.mul(sharePrice).div(fiduMantissa()));
  }

  function getNumShares(uint256 amount) internal view returns (uint256) {
    return usdcToFidu(amount).mul(fiduMantissa()).div(sharePrice);
  }

  function sharesWithinLimit(uint256 _totalShares) internal view returns (bool) {
    return
      _totalShares.mul(sharePrice).div(fiduMantissa()) <=
      usdcToFidu(config.getNumber(uint256(ConfigOptions.Numbers.TotalFundsLimit)));
  }

  function transactionWithinLimit(uint256 amount) internal view returns (bool) {
    return amount <= config.getNumber(uint256(ConfigOptions.Numbers.TransactionLimit));
  }

  function doUSDCTransfer(
    address from,
    address to,
    uint256 amount
  ) internal returns (bool) {
    require(to != address(0), "Can't send to zero address");
    IERC20withDec usdc = config.getUSDC();
    return usdc.transferFrom(from, to, amount);
  }

  function _withdraw(uint256 usdcAmount, uint256 withdrawShares) internal withinTransactionLimit(usdcAmount) {
    IFidu fidu = config.getSeniorFundFidu();
    // Determine current shares the address has and the shares requested to withdraw
    uint256 currentShares = fidu.balanceOf(msg.sender);
    // Ensure the address has enough value in the pool
    require(withdrawShares <= currentShares, "Amount requested is greater than what this address owns");

    if (compoundBalance > 0) {
      _sweepFromCompound();
    }

    uint256 reserveAmount = usdcAmount.div(config.getWithdrawFeeDenominator());
    uint256 userAmount = usdcAmount.sub(reserveAmount);

    emit WithdrawalMade(msg.sender, userAmount, reserveAmount);
    // Send the amounts
    bool success = doUSDCTransfer(address(this), msg.sender, userAmount);
    require(success, "Failed to transfer for withdraw");
    sendToReserve(address(this), reserveAmount, msg.sender);

    // Burn the shares
    fidu.burnFrom(msg.sender, withdrawShares);
  }

  function sweepToCompound(ICUSDCContract cUSDC, uint256 usdcAmount) internal {
    // Our current design requires we re-normalize by withdrawing everything and recognizing interest gains
    // before we can add additional capital to Compound
    require(compoundBalance == 0, "Cannot sweep when we already have a compound balance");
    require(usdcAmount != 0, "Amount to sweep cannot be zero");
    uint256 error = cUSDC.mint(usdcAmount);
    require(error == 0, "Sweep to compound failed");
    compoundBalance = usdcAmount;
  }

  function _sweepFromCompound() internal {
    ICUSDCContract cUSDC = config.getCUSDCContract();
    sweepFromCompound(cUSDC, cUSDC.balanceOf(address(this)));
  }

  function sweepFromCompound(ICUSDCContract cUSDC, uint256 cUSDCAmount) internal {
    uint256 cBalance = compoundBalance;
    require(cBalance != 0, "No funds on compound");
    require(cUSDCAmount != 0, "Amount to sweep cannot be zero");

    IERC20 usdc = config.getUSDC();
    uint256 preRedeemUSDCBalance = usdc.balanceOf(address(this));
    uint256 cUSDCExchangeRate = cUSDC.exchangeRateCurrent();
    uint256 redeemedUSDC = cUSDCToUSDC(cUSDCExchangeRate, cUSDCAmount);

    uint256 error = cUSDC.redeem(cUSDCAmount);
    uint256 postRedeemUSDCBalance = usdc.balanceOf(address(this));
    require(error == 0, "Sweep from compound failed");
    require(postRedeemUSDCBalance.sub(preRedeemUSDCBalance) == redeemedUSDC, "Unexpected redeem amount");

    uint256 interestAccrued = redeemedUSDC.sub(cBalance);
    _collectInterestAndPrincipal(address(this), interestAccrued, 0);
    compoundBalance = 0;
  }

  function cUSDCToUSDC(uint256 exchangeRate, uint256 amount) internal pure returns (uint256) {
    // See https://compound.finance/docs#protocol-math
    // But note, the docs and reality do not agree. Docs imply that that exchange rate is
    // scaled by 1e18, but tests and mainnet forking make it appear to be scaled by 1e16
    // 1e16 is also what Sheraz at Certik said.
    uint256 usdcDecimals = 6;
    uint256 cUSDCDecimals = 8;
    return
      amount // Amount in cToken (1e8)
        .mul(exchangeRate) // Amount in USDC (but scaled by 1e16, cause that's what exchange rate decimals are)
        .div(10**(18 + usdcDecimals - cUSDCDecimals)) // Downscale to cToken decimals (1e8)
        .div(10**2); // Downscale from cToken to USDC decimals (8 to 6)
  }

  function _collectInterestAndPrincipal(
    address from,
    uint256 interest,
    uint256 principal
  ) internal {
    uint256 reserveAmount = interest.div(config.getReserveDenominator());
    uint256 poolAmount = interest.sub(reserveAmount);
    uint256 increment = usdcToSharePrice(poolAmount);
    sharePrice = sharePrice.add(increment);

    if (poolAmount > 0) {
      emit InterestCollected(from, poolAmount, reserveAmount);
    }
    if (principal > 0) {
      emit PrincipalCollected(from, principal);
    }
    if (reserveAmount > 0) {
      sendToReserve(from, reserveAmount, from);
    }
    // Gas savings: No need to transfer to yourself, which happens in sweepFromCompound
    if (from != address(this)) {
      bool success = doUSDCTransfer(from, address(this), principal.add(poolAmount));
      require(success, "Failed to collect principal repayment");
    }
  }

  function sendToReserve(
    address from,
    uint256 amount,
    address userForEvent
  ) internal {
    emit ReserveFundsCollected(userForEvent, amount);
    bool success = doUSDCTransfer(from, config.reserveAddress(), amount);
    require(success, "Reserve transfer was not successful");
  }

  function usdcToSharePrice(uint256 usdcAmount) internal view returns (uint256) {
    return usdcToFidu(usdcAmount).mul(fiduMantissa()).div(totalShares());
  }

  function totalShares() internal view returns (uint256) {
    return config.getSeniorFundFidu().totalSupply();
  }

  modifier withinTransactionLimit(uint256 amount) {
    require(transactionWithinLimit(amount), "Amount is over the per-transaction limit");
    _;
  }

  function validPool(ITranchedPool pool) internal view returns (bool) {
    return config.getPoolTokens().validPool(address(pool));
  }

  function approvePool(ITranchedPool pool, uint256 allowance) internal {
    IERC20withDec usdc = config.getUSDC();
    bool success = usdc.approve(address(pool), allowance);
    require(success, "Failed to approve USDC");
  }
}
