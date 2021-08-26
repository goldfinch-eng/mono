// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/drafts/IERC20Permit.sol";

import "../../interfaces/ISeniorPool.sol";
import "../../interfaces/IPoolTokens.sol";
import "./Accountant.sol";
import "./BaseUpgradeablePausable.sol";
import "./ConfigHelper.sol";

/**
 * @title Goldfinch's SeniorPool contract
 * @notice Main entry point for senior LPs (a.k.a. capital providers)
 *  Automatically invests across borrower pools using an adjustable strategy.
 * @author Goldfinch
 */
contract SeniorPool is BaseUpgradeablePausable, ISeniorPool {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using SafeMath for uint256;

  uint256 public compoundBalance;
  mapping(ITranchedPool => uint256) public writedowns;

  event DepositMade(address indexed capitalProvider, uint256 amount, uint256 shares);
  event WithdrawalMade(address indexed capitalProvider, uint256 userAmount, uint256 reserveAmount);
  event InterestCollected(address indexed payer, uint256 amount);
  event PrincipalCollected(address indexed payer, uint256 amount);
  event ReserveFundsCollected(address indexed user, uint256 amount);

  event PrincipalWrittenDown(address indexed tranchedPool, int256 amount);
  event InvestmentMadeInSenior(address indexed tranchedPool, uint256 amount);
  event InvestmentMadeInJunior(address indexed tranchedPool, uint256 amount);

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    require(owner != address(0) && address(_config) != address(0), "Owner and config addresses cannot be empty");

    __BaseUpgradeablePausable__init(owner);

    config = _config;
    // Initialize sharePrice to be identical to the legacy pool. This is in the initializer
    // because it must only ever happen once.
    sharePrice = config.getPool().sharePrice();
    totalLoansOutstanding = config.getCreditDesk().totalLoansOutstanding();
    totalWritedowns = config.getCreditDesk().totalWritedowns();

    IERC20withDec usdc = config.getUSDC();
    // Sanity check the address
    usdc.totalSupply();

    bool success = usdc.approve(address(this), uint256(-1));
    require(success, "Failed to approve USDC");
  }

  /**
   * @notice Deposits `amount` USDC from msg.sender into the SeniorPool, and grants you the
   *  equivalent value of FIDU tokens
   * @param amount The amount of USDC to deposit
   */
  function deposit(uint256 amount) public override whenNotPaused nonReentrant returns (uint256 depositShares) {
    require(amount > 0, "Must deposit more than zero");
    // Check if the amount of new shares to be added is within limits
    depositShares = getNumShares(amount);
    uint256 potentialNewTotalShares = totalShares().add(depositShares);
    require(sharesWithinLimit(potentialNewTotalShares), "Deposit would put the fund over the total limit.");
    emit DepositMade(msg.sender, amount, depositShares);
    bool success = doUSDCTransfer(msg.sender, address(this), amount);
    require(success, "Failed to transfer for deposit");

    config.getFidu().mintTo(msg.sender, depositShares);
    return depositShares;
  }

  /**
   * @notice Identical to deposit, except it allows for a passed up signature to permit
   *  the Senior Pool to move funds on behalf of the user, all within one transaction.
   * @param amount The amount of USDC to deposit
   * @param v secp256k1 signature component
   * @param r secp256k1 signature component
   * @param s secp256k1 signature component
   */
  function depositWithPermit(
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public override returns (uint256 depositShares) {
    IERC20Permit(config.usdcAddress()).permit(msg.sender, address(this), amount, deadline, v, r, s);
    return deposit(amount);
  }

  /**
   * @notice Withdraws USDC from the SeniorPool to msg.sender, and burns the equivalent value of FIDU tokens
   * @param usdcAmount The amount of USDC to withdraw
   */
  function withdraw(uint256 usdcAmount) external override whenNotPaused nonReentrant returns (uint256 amount) {
    require(usdcAmount > 0, "Must withdraw more than zero");
    // This MUST happen before calculating withdrawShares, otherwise the share price
    // changes between calculation and burning of Fidu, which creates a asset/liability mismatch
    if (compoundBalance > 0) {
      _sweepFromCompound();
    }
    uint256 withdrawShares = getNumShares(usdcAmount);
    return _withdraw(usdcAmount, withdrawShares);
  }

  /**
   * @notice Withdraws USDC (denominated in FIDU terms) from the SeniorPool to msg.sender
   * @param fiduAmount The amount of USDC to withdraw in terms of FIDU shares
   */
  function withdrawInFidu(uint256 fiduAmount) external override whenNotPaused nonReentrant returns (uint256 amount) {
    require(fiduAmount > 0, "Must withdraw more than zero");
    // This MUST happen before calculating withdrawShares, otherwise the share price
    // changes between calculation and burning of Fidu, which creates a asset/liability mismatch
    if (compoundBalance > 0) {
      _sweepFromCompound();
    }
    uint256 usdcAmount = getUSDCAmountFromShares(fiduAmount);
    uint256 withdrawShares = fiduAmount;
    return _withdraw(usdcAmount, withdrawShares);
  }

  /**
   * @notice Migrates to a new goldfinch config address
   */
  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
  }

  /**
   * @notice Moves any USDC still in the SeniorPool to Compound, and tracks the amount internally.
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
   * @notice Moves any USDC from Compound back to the SeniorPool, and recognizes interest earned.
   * This is done automatically on drawdown or withdraw, but can be called manually if necessary.
   *
   * Requirements:
   *  - The caller must be an admin.
   */
  function sweepFromCompound() public override onlyAdmin whenNotPaused {
    _sweepFromCompound();
  }

  /**
   * @notice Invest in an ITranchedPool's senior tranche using the fund's strategy
   * @param pool An ITranchedPool whose senior tranche should be considered for investment
   */
  function invest(ITranchedPool pool) public override whenNotPaused nonReentrant onlyAdmin {
    require(validPool(pool), "Pool must be valid");

    if (compoundBalance > 0) {
      _sweepFromCompound();
    }

    ISeniorPoolStrategy strategy = config.getSeniorPoolStrategy();
    uint256 amount = strategy.invest(this, pool);

    require(amount > 0, "Investment amount must be positive");

    approvePool(pool, amount);
    pool.deposit(uint256(ITranchedPool.Tranches.Senior), amount);

    emit InvestmentMadeInSenior(address(pool), amount);
    totalLoansOutstanding = totalLoansOutstanding.add(amount);
  }

  function estimateInvestment(ITranchedPool pool) public view override returns (uint256) {
    require(validPool(pool), "Pool must be valid");
    ISeniorPoolStrategy strategy = config.getSeniorPoolStrategy();
    return strategy.estimateInvestment(this, pool);
  }

  /**
   * @notice Invest in an ITranchedPool's junior tranche.
   * @param pool An ITranchedPool whose junior tranche to invest in
   */
  function investJunior(ITranchedPool pool, uint256 amount) public override whenNotPaused nonReentrant onlyAdmin {
    require(validPool(pool), "Pool must be valid");

    // We don't intend to support allowing the senior fund to invest in the junior tranche if it
    // has already invested in the senior tranche, so we prohibit that here. Note though that we
    // don't care to prohibit the inverse order, of the senior fund investing in the senior
    // tranche after investing in the junior tranche.
    ITranchedPool.TrancheInfo memory seniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Senior));
    require(
      seniorTranche.principalDeposited == 0,
      "SeniorFund cannot invest in junior tranche of tranched pool with non-empty senior tranche."
    );

    if (compoundBalance > 0) {
      _sweepFromCompound();
    }

    require(amount > 0, "Investment amount must be positive");

    approvePool(pool, amount);
    pool.deposit(uint256(ITranchedPool.Tranches.Junior), amount);

    emit InvestmentMadeInJunior(address(pool), amount);
    totalLoansOutstanding = totalLoansOutstanding.add(amount);
  }

  /**
   * @notice Redeem interest and/or principal from an ITranchedPool investment
   * @param tokenId the ID of an IPoolTokens token to be redeemed
   */
  function redeem(uint256 tokenId) public override whenNotPaused nonReentrant onlyAdmin {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);

    ITranchedPool pool = ITranchedPool(tokenInfo.pool);
    (uint256 interestRedeemed, uint256 principalRedeemed) = pool.withdrawMax(tokenId);

    _collectInterestAndPrincipal(address(pool), interestRedeemed, principalRedeemed);
  }

  /**
   * @notice Write down an ITranchedPool investment. This will adjust the fund's share price
   *  down if we're considering the investment a loss, or up if the borrower has subsequently
   *  made repayments that restore confidence that the full loan will be repaid.
   * @param tokenId the ID of an IPoolTokens token to be considered for writedown
   */
  function writedown(uint256 tokenId) public override whenNotPaused nonReentrant onlyAdmin {
    IPoolTokens poolTokens = config.getPoolTokens();
    require(address(this) == poolTokens.ownerOf(tokenId), "Only tokens owned by the senior fund can be written down");

    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    ITranchedPool pool = ITranchedPool(tokenInfo.pool);
    require(validPool(pool), "Pool must be valid");

    uint256 principalRemaining = tokenInfo.principalAmount.sub(tokenInfo.principalRedeemed);

    (uint256 writedownPercent, uint256 writedownAmount) = _calculateWritedown(pool, principalRemaining);

    uint256 prevWritedownAmount = writedowns[pool];

    if (writedownPercent == 0 && prevWritedownAmount == 0) {
      return;
    }

    int256 writedownDelta = int256(prevWritedownAmount) - int256(writedownAmount);
    writedowns[pool] = writedownAmount;
    distributeLosses(writedownDelta);
    if (writedownDelta > 0) {
      // If writedownDelta is positive, that means we got money back. So subtract from totalWritedowns.
      totalWritedowns = totalWritedowns.sub(uint256(writedownDelta));
    } else {
      totalWritedowns = totalWritedowns.add(uint256(writedownDelta * -1));
    }
    emit PrincipalWrittenDown(address(pool), writedownDelta);
  }

  /**
   * @notice Calculates the writedown amount for a particular pool position
   * @param tokenId The token reprsenting the position
   * @return The amount in dollars the principal should be written down by
   */
  function calculateWritedown(uint256 tokenId) public view override returns (uint256) {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    ITranchedPool pool = ITranchedPool(tokenInfo.pool);

    uint256 principalRemaining = tokenInfo.principalAmount.sub(tokenInfo.principalRedeemed);
    (uint256 _, uint256 writedownAmount) = _calculateWritedown(pool, principalRemaining);
    return writedownAmount;
  }

  /**
   * @notice Returns the net assests controlled by and owed to the pool
   */
  function assets() public view override returns (uint256) {
    return
      compoundBalance.add(config.getUSDC().balanceOf(address(this))).add(totalLoansOutstanding).sub(totalWritedowns);
  }

  /**
   * @notice Converts and USDC amount to FIDU amount
   * @param amount USDC amount to convert to FIDU
   */
  function getNumShares(uint256 amount) public view override returns (uint256) {
    return usdcToFidu(amount).mul(fiduMantissa()).div(sharePrice);
  }

  /* Internal Functions */

  function _calculateWritedown(ITranchedPool pool, uint256 principal)
    internal
    view
    returns (uint256 writedownPercent, uint256 writedownAmount)
  {
    return
      Accountant.calculateWritedownForPrincipal(
        pool.creditLine(),
        principal,
        currentTime(),
        config.getLatenessGracePeriodInDays(),
        config.getLatenessMaxDays()
      );
  }

  function currentTime() internal view virtual returns (uint256) {
    return block.timestamp;
  }

  function distributeLosses(int256 writedownDelta) internal {
    if (writedownDelta > 0) {
      uint256 delta = usdcToSharePrice(uint256(writedownDelta));
      sharePrice = sharePrice.add(delta);
    } else {
      // If delta is negative, convert to positive uint, and sub from sharePrice
      uint256 delta = usdcToSharePrice(uint256(writedownDelta * -1));
      sharePrice = sharePrice.sub(delta);
    }
  }

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

  function sharesWithinLimit(uint256 _totalShares) internal view returns (bool) {
    return
      _totalShares.mul(sharePrice).div(fiduMantissa()) <=
      usdcToFidu(config.getNumber(uint256(ConfigOptions.Numbers.TotalFundsLimit)));
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

  function _withdraw(uint256 usdcAmount, uint256 withdrawShares) internal returns (uint256 userAmount) {
    IFidu fidu = config.getFidu();
    // Determine current shares the address has and the shares requested to withdraw
    uint256 currentShares = fidu.balanceOf(msg.sender);
    // Ensure the address has enough value in the pool
    require(withdrawShares <= currentShares, "Amount requested is greater than what this address owns");

    uint256 reserveAmount = usdcAmount.div(config.getWithdrawFeeDenominator());
    userAmount = usdcAmount.sub(reserveAmount);

    emit WithdrawalMade(msg.sender, userAmount, reserveAmount);
    // Send the amounts
    bool success = doUSDCTransfer(address(this), msg.sender, userAmount);
    require(success, "Failed to transfer for withdraw");
    sendToReserve(reserveAmount, msg.sender);

    // Burn the shares
    fidu.burnFrom(msg.sender, withdrawShares);
    return userAmount;
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
    uint256 reserveAmount = interestAccrued.div(config.getReserveDenominator());
    uint256 poolAmount = interestAccrued.sub(reserveAmount);

    _collectInterestAndPrincipal(address(this), poolAmount, 0);

    if (reserveAmount > 0) {
      sendToReserve(reserveAmount, address(cUSDC));
    }

    compoundBalance = 0;
  }

  function cUSDCToUSDC(uint256 exchangeRate, uint256 amount) internal pure returns (uint256) {
    // See https://compound.finance/docs#protocol-math
    // But note, the docs and reality do not agree. Docs imply that that exchange rate is
    // scaled by 1e18, but tests and mainnet forking make it appear to be scaled by 1e16
    // 1e16 is also what Sheraz at Certik said.
    uint256 usdcDecimals = 6;
    uint256 cUSDCDecimals = 8;

    // We multiply in the following order, for the following reasons...
    // Amount in cToken (1e8)
    // Amount in USDC (but scaled by 1e16, cause that's what exchange rate decimals are)
    // Downscale to cToken decimals (1e8)
    // Downscale from cToken to USDC decimals (8 to 6)
    return amount.mul(exchangeRate).div(10**(18 + usdcDecimals - cUSDCDecimals)).div(10**2);
  }

  function _collectInterestAndPrincipal(
    address from,
    uint256 interest,
    uint256 principal
  ) internal {
    uint256 increment = usdcToSharePrice(interest);
    sharePrice = sharePrice.add(increment);

    if (interest > 0) {
      emit InterestCollected(from, interest);
    }
    if (principal > 0) {
      emit PrincipalCollected(from, principal);
      totalLoansOutstanding = totalLoansOutstanding.sub(principal);
    }
  }

  function sendToReserve(uint256 amount, address userForEvent) internal {
    emit ReserveFundsCollected(userForEvent, amount);
    bool success = doUSDCTransfer(address(this), config.reserveAddress(), amount);
    require(success, "Reserve transfer was not successful");
  }

  function usdcToSharePrice(uint256 usdcAmount) internal view returns (uint256) {
    return usdcToFidu(usdcAmount).mul(fiduMantissa()).div(totalShares());
  }

  function totalShares() internal view returns (uint256) {
    return config.getFidu().totalSupply();
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
