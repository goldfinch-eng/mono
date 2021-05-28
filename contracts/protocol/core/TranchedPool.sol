// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/drafts/IERC20Permit.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

import "../../interfaces/ITranchedPool.sol";
import "../../interfaces/IERC20withDec.sol";
import "../../interfaces/IV2CreditLine.sol";
import "../../interfaces/IPoolTokens.sol";
import "./GoldfinchConfig.sol";
import "./BaseUpgradeablePausable.sol";
import "./ConfigHelper.sol";
import "../../external/FixedPoint.sol";

contract TranchedPool is BaseUpgradeablePausable, ITranchedPool {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using FixedPoint for FixedPoint.Unsigned;
  using FixedPoint for uint256;

  bytes32 public constant LOCKER_ROLE = keccak256("LOCKER_ROLE");
  uint256 public constant FP_SCALING_FACTOR = 10**18;
  uint256 public constant INTEREST_DECIMALS = 1e8;
  uint256 public constant SECONDS_PER_DAY = 60 * 60 * 24;
  uint256 public constant ONE_HUNDRED = 100; // Need this because we cannot call .div on a literal 100
  uint256 public juniorFeePercent;

  TrancheInfo internal seniorTranche;
  TrancheInfo internal juniorTranche;

  event DepositMade(address indexed owner, uint256 indexed tranche, uint256 indexed tokenId, uint256 amonut);
  event WithdrawalMade(
    address indexed owner,
    uint256 indexed tranche,
    uint256 indexed tokenId,
    uint256 interestWithdrawn,
    uint256 principalWithdrawn
  );

  event PaymentCollected(address indexed payer, address indexed pool, uint256 paymentAmount);
  event PaymentApplied(
    address indexed payer,
    address indexed pool,
    uint256 interestAmount,
    uint256 principalAmount,
    uint256 remainingAmount
  );

  function initialize(
    address _config,
    address _borrower,
    uint256 _juniorFeePercent,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr
  ) public override initializer {
    config = GoldfinchConfig(_config);
    address owner = config.protocolAdminAddress();
    __BaseUpgradeablePausable__init(owner);
    seniorTranche = TrancheInfo({
      principalSharePrice: usdcToSharePrice(1, 1),
      interestSharePrice: 0,
      principalDeposited: 0,
      lockedUntil: 0
    });
    juniorTranche = TrancheInfo({
      principalSharePrice: usdcToSharePrice(1, 1),
      interestSharePrice: 0,
      principalDeposited: 0,
      lockedUntil: 0
    });
    address _creditLine = config.getCreditLineFactory().createCreditLine();
    creditLine = IV2CreditLine(_creditLine);
    creditLine.initialize(
      _config,
      address(this), // Set self as the owner
      _borrower,
      _limit,
      _interestApr,
      _paymentPeriodInDays,
      _termInDays,
      _lateFeeApr
    );

    createdAt = block.timestamp;
    juniorFeePercent = _juniorFeePercent;

    _setupRole(LOCKER_ROLE, _borrower);
    _setupRole(LOCKER_ROLE, owner);
    _setRoleAdmin(LOCKER_ROLE, OWNER_ROLE);

    // Unlock self for infinite amount
    bool success = config.getUSDC().approve(address(this), uint256(-1));
    require(success, "Failed to approve USDC");
  }

  function deposit(uint256 tranche, uint256 amount) public override nonReentrant whenNotPaused {
    TrancheInfo storage trancheInfo = getTrancheInfo(tranche);
    require(trancheInfo.lockedUntil == 0, "Tranche has been locked");

    trancheInfo.principalDeposited += amount;
    IPoolTokens.MintParams memory params = IPoolTokens.MintParams({tranche: tranche, principalAmount: amount});
    uint256 tokenId = config.getPoolTokens().mint(params, msg.sender);
    safeUSDCTransfer(msg.sender, address(this), amount);
    emit DepositMade(msg.sender, tranche, tokenId, amount);
  }

  function depositWithPermit(
    uint256 tranche,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public override {
    IERC20Permit(config.usdcAddress()).permit(msg.sender, address(this), amount, deadline, v, r, s);
    deposit(tranche, amount);
  }

  function withdraw(uint256 tokenId, uint256 amount)
    public
    override
    onlyTokenHolder(tokenId)
    nonReentrant
    whenNotPaused
    returns (uint256 interestWithdrawn, uint256 principalWithdrawn)
  {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    TrancheInfo storage trancheInfo = getTrancheInfo(tokenInfo.tranche);

    return _withdraw(trancheInfo, tokenInfo, tokenId, amount);
  }

  function withdrawMax(uint256 tokenId)
    external
    override
    onlyTokenHolder(tokenId)
    nonReentrant
    whenNotPaused
    returns (uint256 interestWithdrawn, uint256 principalWithdrawn)
  {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    TrancheInfo storage trancheInfo = getTrancheInfo(tokenInfo.tranche);

    (uint256 interestRedeemable, uint256 principalRedeemable) = redeemableInterestAndPrincipal(trancheInfo, tokenInfo);

    uint256 amount = interestRedeemable.add(principalRedeemable);

    return _withdraw(trancheInfo, tokenInfo, tokenId, amount);
  }

  function _withdraw(
    TrancheInfo storage trancheInfo,
    IPoolTokens.TokenInfo memory tokenInfo,
    uint256 tokenId,
    uint256 amount
  ) internal returns (uint256 interestWithdrawn, uint256 principalWithdrawn) {
    (uint256 interestRedeemable, uint256 principalRedeemable) = redeemableInterestAndPrincipal(trancheInfo, tokenInfo);
    uint256 netRedeemable = interestRedeemable.add(principalRedeemable);

    require(amount <= netRedeemable, "Invalid redeem amount");
    require(currentTime() > trancheInfo.lockedUntil, "Tranche is locked");

    // If the tranche has not been locked, ensure the deposited amount is correct
    if (trancheInfo.lockedUntil == 0) {
      trancheInfo.principalDeposited = trancheInfo.principalDeposited.sub(amount);
    }

    uint256 interestToRedeem = Math.min(interestRedeemable, amount);
    uint256 principalToRedeem = Math.min(principalRedeemable, amount.sub(interestToRedeem));

    config.getPoolTokens().redeem(tokenId, principalToRedeem, interestToRedeem);
    safeUSDCTransfer(address(this), msg.sender, principalToRedeem.add(interestToRedeem));

    emit WithdrawalMade(msg.sender, tokenInfo.tranche, tokenId, interestToRedeem, principalToRedeem);

    return (interestToRedeem, principalToRedeem);
  }

  function redeemableInterestAndPrincipal(TrancheInfo storage trancheInfo, IPoolTokens.TokenInfo memory tokenInfo)
    internal
    view
    returns (uint256 interestRedeemable, uint256 principalRedeemable)
  {
    // This supports withdrawing before or after locking because principal share price starts at 1
    // and is set to 0 on lock. Interest share price is always 0 until interest payments come back, when it increases
    uint256 maxPrincipalRedeemable = sharePriceToUsdc(trancheInfo.principalSharePrice, tokenInfo.principalAmount);
    // The principalAmount is used as the totalShares because we want the interestSharePrice to be expressed as a
    // percent of total loan value e.g. if the interest is 10% APR, the interestSharePrice should approach a max of 0.1.
    uint256 maxInterestRedeemable = sharePriceToUsdc(trancheInfo.interestSharePrice, tokenInfo.principalAmount);

    interestRedeemable = maxInterestRedeemable.sub(tokenInfo.interestRedeemed);
    principalRedeemable = maxPrincipalRedeemable.sub(tokenInfo.principalRedeemed);

    return (interestRedeemable, principalRedeemable);
  }

  function drawdown(uint256 amount) external override onlyLocker whenNotPaused {
    if (!locked()) {
      // Assumes the senior fund has invested already (saves the borrower a separate transaction to lock the pool)
      _lockPool();
    }

    creditLine.drawdown(amount);

    // Update the share price to reflect the amount remaining in the pool
    uint256 amountRemaining = totalDeposited().sub(creditLine.balance());
    juniorTranche.principalSharePrice = calculateExpectedSharePrice(amountRemaining, juniorTranche);
    seniorTranche.principalSharePrice = calculateExpectedSharePrice(amountRemaining, seniorTranche);

    safeUSDCTransfer(address(this), creditLine.borrower(), amount);
  }

  // Mark the investment period as over
  function lockJuniorCapital() external override onlyLocker whenNotPaused {
    _lockJuniorCapital();
  }

  function _lockJuniorCapital() internal {
    require(!locked(), "Pool already locked");
    require(juniorTranche.lockedUntil == 0, "Junior tranche already locked");

    juniorTranche.lockedUntil = currentTime().add(config.getDrawdownPeriodInSeconds());
  }

  function lockPool() external override onlyLocker whenNotPaused {
    _lockPool();
  }

  function _lockPool() internal {
    require(juniorTranche.lockedUntil > 0, "Junior tranche must be locked first");

    creditLine.setLimit(Math.min(totalDeposited(), creditLine.limit()));

    // We start the drawdown period, so backers can withdraw unused capital after borrower draws down
    uint256 lockPeriod = config.getDrawdownPeriodInSeconds();
    seniorTranche.lockedUntil = currentTime().add(lockPeriod);
    juniorTranche.lockedUntil = currentTime().add(lockPeriod);
  }

  function collectInterestAndPrincipal(
    address from,
    uint256 interest,
    uint256 principal
  ) internal {
    safeUSDCTransfer(from, address(this), principal.add(interest), "Failed to collect payment");

    (uint256 interestAccrued, uint256 principalAccrued) = getTotalInterestAndPrincipal(currentTime());
    uint256 reserveFeePercent = ONE_HUNDRED.div(config.getReserveDenominator()); // Convert the denonminator to percent

    uint256 totalReserveAmount; // protocol fee

    uint256 interestRemaining = interest;
    uint256 principalRemaining = principal;

    // First determine the expected share price for the senior tranche. This is the gross amount the senior
    // tranche should receive.
    uint256 expectedInterestSharePrice = calculateExpectedSharePrice(interestAccrued, seniorTranche);
    uint256 expectedPrincipalSharePrice = calculateExpectedSharePrice(principalAccrued, seniorTranche);

    // Deduct the junior fee and the protocol reserve
    uint256 desiredNetInterestSharePrice = scaleByFraction(
      expectedInterestSharePrice,
      ONE_HUNDRED.sub(juniorFeePercent + reserveFeePercent),
      ONE_HUNDRED
    );
    // Collect protocol fee interest received (we've subtracted this from the senior portion above)
    uint256 reserveDeduction = scaleByFraction(interestRemaining, reserveFeePercent, ONE_HUNDRED);
    totalReserveAmount = totalReserveAmount.add(reserveDeduction);
    interestRemaining = interestRemaining.sub(reserveDeduction);

    // Apply the interest remaining so we get up to the netInterestSharePrice
    (interestRemaining, principalRemaining) = applyToTrancheBySharePrice(
      interestRemaining,
      principalRemaining,
      desiredNetInterestSharePrice,
      expectedPrincipalSharePrice,
      seniorTranche
    );

    // Then fill up the junior tranche with all the interest remaining, upto the principal share price
    expectedInterestSharePrice = juniorTranche.interestSharePrice.add(
      usdcToSharePrice(interestRemaining, juniorTranche.principalDeposited)
    );
    expectedPrincipalSharePrice = calculateExpectedSharePrice(principalAccrued, juniorTranche);
    (interestRemaining, principalRemaining) = applyToTrancheBySharePrice(
      interestRemaining,
      principalRemaining,
      expectedInterestSharePrice,
      expectedPrincipalSharePrice,
      juniorTranche
    );

    // All remaining interest and principal is applied towards the junior tranche as interest
    interestRemaining = interestRemaining.add(principalRemaining);
    // Since any principal remaining is treated as interest (there is "extra" interest to be distributed)
    // we need to make sure to collect the protocol fee on the additional interest (we only deducted the
    // fee on the original interest portion)
    reserveDeduction = scaleByFraction(principalRemaining, reserveFeePercent, ONE_HUNDRED);
    totalReserveAmount = totalReserveAmount.add(reserveDeduction);
    interestRemaining = interestRemaining.sub(reserveDeduction);
    principalRemaining = 0;

    (interestRemaining, principalRemaining) = applyToTrancheByAmount(
      interestRemaining.add(principalRemaining),
      0,
      interestRemaining.add(principalRemaining),
      0,
      juniorTranche
    );

    safeUSDCTransfer(address(this), config.reserveAddress(), totalReserveAmount, "Failed to send to reserve");
  }

  function getTotalInterestAndPrincipal(uint256 asOf)
    internal
    view
    returns (uint256 interestAccrued, uint256 principalAccrued)
  {
    interestAccrued = creditLine.totalInterestAccrued();
    principalAccrued = creditLine.principalOwed();
    // Add any remaining balance we have to the principal accrued so expected share price will reflect partial
    // drawdowns appropriately. (e.g. if 300K was drawndown from a 1M loan, current and expected share price should
    // be 0.7 and not 0)
    principalAccrued = principalAccrued.add(totalDeposited().sub(creditLine.balance()));
    return (interestAccrued, principalAccrued);
  }

  function calculateExpectedSharePrice(uint256 amount, TrancheInfo memory tranche) internal view returns (uint256) {
    uint256 sharePrice = usdcToSharePrice(amount, tranche.principalDeposited);
    return scaleByPercentOwnership(sharePrice, tranche);
  }

  // If the senior tranche is locked, then the pool is not open to any more deposits (could throw off leverage ratio)
  function locked() internal view returns (bool) {
    return seniorTranche.lockedUntil > 0;
  }

  function safeUSDCTransfer(
    address from,
    address to,
    uint256 amount,
    string memory message
  ) internal {
    require(to != address(0), "Can't send to zero address");
    IERC20withDec usdc = config.getUSDC();
    bool success = usdc.transferFrom(from, to, amount);
    require(success, message);
  }

  function safeUSDCTransfer(
    address from,
    address to,
    uint256 amount
  ) internal {
    string memory message = "Failed to transfer USDC";
    safeUSDCTransfer(from, to, amount, message);
  }

  function getTrancheInfo(uint256 tranche) internal view returns (TrancheInfo storage) {
    require(
      tranche == uint256(ITranchedPool.Tranches.Senior) || tranche == uint256(ITranchedPool.Tranches.Junior),
      "Unsupported tranche"
    );
    return tranche == uint256(ITranchedPool.Tranches.Senior) ? seniorTranche : juniorTranche;
  }

  function getTranche(uint256 tranche) public view override returns (TrancheInfo memory) {
    return getTrancheInfo(tranche);
  }

  function scaleByPercentOwnership(uint256 amount, TrancheInfo memory tranche) internal view returns (uint256) {
    uint256 totalDeposited = juniorTranche.principalDeposited.add(seniorTranche.principalDeposited);
    return scaleByFraction(amount, tranche.principalDeposited, totalDeposited);
  }

  function scaleByFraction(
    uint256 amount,
    uint256 fraction,
    uint256 total
  ) internal view returns (uint256) {
    FixedPoint.Unsigned memory totalAsFixedPoint = FixedPoint.fromUnscaledUint(total);
    FixedPoint.Unsigned memory fractionAsFixedPoint = FixedPoint.fromUnscaledUint(fraction);
    return fractionAsFixedPoint.div(totalAsFixedPoint).mul(amount).div(FP_SCALING_FACTOR).rawValue;
  }

  function totalDeposited() internal view returns (uint256) {
    return juniorTranche.principalDeposited.add(seniorTranche.principalDeposited);
  }

  function currentTime() internal view virtual returns (uint256) {
    return block.timestamp;
  }

  function applyToTrancheBySharePrice(
    uint256 interestRemaining,
    uint256 principalRemaining,
    uint256 desiredInterestSharePrice,
    uint256 desiredPrincipalSharePrice,
    TrancheInfo storage tranche
  ) internal returns (uint256, uint256) {
    uint256 totalShares = tranche.principalDeposited;

    // If the desired share price is lower, then ignore it, and leave it unchanged
    if (desiredPrincipalSharePrice < tranche.principalSharePrice) {
      desiredPrincipalSharePrice = tranche.principalSharePrice;
    }
    if (desiredInterestSharePrice < tranche.interestSharePrice) {
      desiredInterestSharePrice = tranche.interestSharePrice;
    }
    uint256 interestSharePriceDifference = desiredInterestSharePrice.sub(tranche.interestSharePrice);
    uint256 desiredInterestAmount = sharePriceToUsdc(interestSharePriceDifference, totalShares);
    uint256 principalSharePriceDifference = desiredPrincipalSharePrice.sub(tranche.principalSharePrice);
    uint256 desiredPrincipalAmount = sharePriceToUsdc(principalSharePriceDifference, totalShares);

    (interestRemaining, principalRemaining) = applyToTrancheByAmount(
      interestRemaining,
      principalRemaining,
      desiredInterestAmount,
      desiredPrincipalAmount,
      tranche
    );
    return (interestRemaining, principalRemaining);
  }

  function applyToTrancheByAmount(
    uint256 interestRemaining,
    uint256 principalRemaining,
    uint256 desiredInterestAmount,
    uint256 desiredPrincipalAmount,
    TrancheInfo storage tranche
  ) internal returns (uint256, uint256) {
    uint256 totalShares = tranche.principalDeposited;
    uint256 newSharePrice;

    (interestRemaining, newSharePrice) = applyToSharePrice(
      interestRemaining,
      tranche.interestSharePrice,
      desiredInterestAmount,
      totalShares
    );
    tranche.interestSharePrice = newSharePrice;

    (principalRemaining, newSharePrice) = applyToSharePrice(
      principalRemaining,
      tranche.principalSharePrice,
      desiredPrincipalAmount,
      totalShares
    );
    tranche.principalSharePrice = newSharePrice;

    return (interestRemaining, principalRemaining);
  }

  function applyToSharePrice(
    uint256 amountRemaining,
    uint256 currentSharePrice,
    uint256 desiredAmount,
    uint256 totalShares
  ) internal pure returns (uint256, uint256) {
    // If no money left to apply, or don't need any changes, return the original amounts
    if (amountRemaining == 0 || desiredAmount == 0) {
      return (amountRemaining, currentSharePrice);
    }
    if (amountRemaining < desiredAmount) {
      // We don't have enough money to adjust share price to the desired level. So just use whatever amount is left
      desiredAmount = amountRemaining;
    }
    uint256 sharePriceDifference = usdcToSharePrice(desiredAmount, totalShares);
    return (amountRemaining.sub(desiredAmount), currentSharePrice.add(sharePriceDifference));
  }

  function usdcToSharePrice(uint256 amount, uint256 totalShares) public pure returns (uint256) {
    return totalShares == 0 ? 0 : amount.mul(FP_SCALING_FACTOR).div(totalShares);
  }

  function sharePriceToUsdc(uint256 sharePrice, uint256 totalShares) public pure returns (uint256) {
    return sharePrice.mul(totalShares).div(FP_SCALING_FACTOR);
  }

  function assess() external override whenNotPaused {
    _assess();
  }

  function pay(uint256 amount) external override whenNotPaused {
    require(amount > 0, "Must pay more than zero");

    collectPayment(amount);
    _assess();
  }

  function collectPayment(uint256 amount) internal {
    emit PaymentCollected(msg.sender, address(this), amount);
    safeUSDCTransfer(msg.sender, address(creditLine), amount, "Failed to collect payment");
  }

  function _assess() internal {
    (uint256 paymentRemaining, uint256 interestPayment, uint256 principalPayment) = creditLine.assess();
    if (interestPayment > 0 || principalPayment > 0) {
      emit PaymentApplied(creditLine.borrower(), address(this), interestPayment, principalPayment, paymentRemaining);
      collectInterestAndPrincipal(address(creditLine), interestPayment, principalPayment.add(paymentRemaining));
    }
  }

  modifier onlyCreditDesk() {
    require(msg.sender == config.creditDeskAddress(), "Only the credit desk is allowed to call this function");
    _;
  }

  modifier onlyLocker() {
    require(hasRole(LOCKER_ROLE, msg.sender), "Must have locker role to perform this action");
    _;
  }

  modifier onlyTokenHolder(uint256 tokenId) {
    require(
      msg.sender == config.getPoolTokens().ownerOf(tokenId),
      "Only the token owner is allowed to call this function"
    );
    _;
  }
}
