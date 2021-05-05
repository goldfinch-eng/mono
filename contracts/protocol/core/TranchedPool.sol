// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../interfaces/ITranchedPool.sol";
import "../../interfaces/IERC20withDec.sol";
import "../../interfaces/IV2CreditLine.sol";
import "../../interfaces/IPoolTokens.sol";
import "./Accountant.sol";
import "./GoldfinchConfig.sol";
import "./BaseUpgradeablePausable.sol";
import "./ConfigHelper.sol";
import "./CreditLine.sol";
import "../../external/FixedPoint.sol";

contract TranchedPool is BaseUpgradeablePausable, ITranchedPool {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using FixedPoint for FixedPoint.Unsigned;
  using FixedPoint for uint256;

  uint256 public constant FP_SCALING_FACTOR = 10**18;
  uint256 public constant INTEREST_DECIMALS = 1e8;
  uint256 public constant SECONDS_PER_DAY = 60 * 60 * 24;
  uint256 public constant ONE_HUNDRED = 100; // Need this because we cannot call .div on a literal 100
  uint256 public juniorFeePercent;

  event DepositMade(address indexed owner, uint256 indexed tranche, uint256 indexed tokenId, uint256 amonut);
  event WithdrawalMade(address indexed owner, uint256 indexed tranche, uint256 indexed tokenId, uint256 amount);

  event PaymentApplied(
    address indexed payer,
    address indexed pool,
    uint256 interestAmount,
    uint256 principalAmount,
    uint256 remainingAmount
  );

  function initialize(
    address owner,
    address _config,
    address _creditLine,
    uint256 _juniorFeePercent
  ) public override initializer {
    __BaseUpgradeablePausable__init(owner);
    seniorTranche = TrancheInfo({
      principalSharePrice: 1,
      interestSharePrice: 0,
      principalDeposited: 0,
      interestAPR: 0,
      lockedAt: 0
    });
    juniorTranche = TrancheInfo({
      principalSharePrice: 1,
      interestSharePrice: 0,
      principalDeposited: 0,
      interestAPR: 0,
      lockedAt: 0
    });
    config = GoldfinchConfig(_config);
    // We may need to call the factory here to create the creditline, or have the factory provide owner role on the
    // creditline to this contract
    creditLine = IV2CreditLine(_creditLine);
    createdAt = block.timestamp;
    juniorFeePercent = _juniorFeePercent;

    // Unlock self for infinite amount
    bool success = config.getUSDC().approve(address(this), uint256(-1));
    require(success, "Failed to approve USDC");
  }

  function deposit(uint256 tranche, uint256 amount) public {
    require(!locked(), "Pool has been locked");
    TrancheInfo storage trancheInfo = getTrancheInfo(tranche);

    require(trancheInfo.lockedAt == 0, "Tranche has been locked");
    trancheInfo.principalDeposited += amount;
    IPoolTokens.MintParams memory params = IPoolTokens.MintParams({tranche: tranche, principalAmount: amount});
    uint256 tokenId = config.getPoolTokens().mint(params, msg.sender);
    doUSDCTransfer(msg.sender, address(this), amount);
    emit DepositMade(msg.sender, tranche, tokenId, amount);
  }

  function withdraw(uint256 tokenId, uint256 amount) public {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    TrancheInfo storage trancheInfo = getTrancheInfo(tokenInfo.tranche);

    // This supports withdrawing before or after locking because principal share price starts at 1
    // and is set to 0 on lock. Interest share price is always 0 until interest payments come back, when it increases
    uint256 maxAmountRedeemable = (trancheInfo.principalSharePrice * tokenInfo.principalAmount) +
      (trancheInfo.interestSharePrice * tokenInfo.principalAmount);

    require(
      amount.add(tokenInfo.principalRedeemed).add(tokenInfo.interestRedeemed) <= maxAmountRedeemable,
      "Invalid redeem amount"
    );

    // If the tranche has not been locked, ensure the deposited amount is correct
    if (trancheInfo.lockedAt == 0) {
      trancheInfo.principalDeposited = trancheInfo.principalDeposited.sub(amount);
    }

    // TODO: Fix
    config.getPoolTokens().redeem(tokenId, amount, 0);
    doUSDCTransfer(address(this), msg.sender, amount);
  }

  function drawdown(uint256 amount) public {
    // We assume fund has applied it's leverage formula
    if (!locked()) {
      lockPool();
    }

    require(amount <= creditLine.limit(), "Cannot drawdown more than the limit");
    require(creditLine.balance() == 0, "Multiple drawdowns not supported yet");

    // TODO: Refactor once we merge creditdesk into the tranchedpool
    creditLine.setInterestAccruedAsOf(currentTime());
    creditLine.setLastFullPaymentTime(currentTime());
    creditLine.setBalance(amount);
    uint256 secondsPerPeriod = creditLine.paymentPeriodInDays().mul(SECONDS_PER_DAY);
    creditLine.setNextDueTime(currentTime().add(secondsPerPeriod));
    creditLine.setTermEndTime(currentTime().add(SECONDS_PER_DAY.mul(creditLine.termInDays())));

    doUSDCTransfer(address(this), creditLine.borrower(), amount);
  }

  // Mark the investment period as over
  function lockJuniorCapital() public onlyAdmin {
    require(!locked(), "Pool already locked");
    require(juniorTranche.lockedAt == 0, "Junior tranche already locked");

    juniorTranche.principalSharePrice = 0;
    juniorTranche.lockedAt = currentTime();
  }

  function lockPool() public onlyAdmin {
    require(juniorTranche.lockedAt > 0, "Junior tranche must be locked first");

    seniorTranche.interestAPR = scaleByPercentOwnership(creditLine.interestApr(), seniorTranche);
    juniorTranche.interestAPR = scaleByPercentOwnership(creditLine.interestApr(), juniorTranche);
    seniorTranche.principalSharePrice = 0;

    creditLine.setLimit(seniorTranche.principalDeposited + juniorTranche.principalDeposited);

    seniorTranche.lockedAt = currentTime();
  }

  // TODO: Needs access control (only public for tests)
  function collectInterestAndPrincipal(
    address from,
    uint256 interest,
    uint256 principal
  ) public {
    bool success = doUSDCTransfer(from, address(this), principal.add(interest));
    require(success, "Failed to collect repayment");

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
    // Collect protocol fee from senior tranche
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

    // All remaining interest and principal is applied towards the junior tranche
    (interestRemaining, principalRemaining) = applyToTrancheByAmount(
      interestRemaining,
      principalRemaining,
      interestRemaining,
      principalRemaining,
      juniorTranche
    );

    success = doUSDCTransfer(address(this), config.reserveAddress(), totalReserveAmount);
    require(success, "Failed to send to reserve");
  }

  function getTotalInterestAndPrincipal(uint256 asOf) internal view returns (uint256, uint256) {
    // TODO: Since this is used to determine the expected share price at a point in time, it shouldn't include any
    // past payments. This is very different from the current calculations
    return
      Accountant.calculateInterestAndPrincipalAccrued(
        CreditLine(address(creditLine)),
        asOf,
        config.getLatenessGracePeriodInDays()
      );
  }

  function calculateExpectedSharePrice(uint256 amount, TrancheInfo memory tranche) internal view returns (uint256) {
    uint256 sharePrice = usdcToSharePrice(amount, tranche.principalDeposited);
    return scaleByPercentOwnership(sharePrice, tranche);
  }

  function locked() internal view returns (bool) {
    return seniorTranche.lockedAt > 0 && seniorTranche.lockedAt <= currentTime();
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

  function getTrancheInfo(uint256 tranche) internal view returns (TrancheInfo storage) {
    require(tranche == 1 || tranche == 2, "Unsupported tranche");
    return tranche == 1 ? seniorTranche : juniorTranche;
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
    // If no money left to apply, return the original amounts
    if (amountRemaining == 0) {
      return (amountRemaining, currentSharePrice);
    }
    if (amountRemaining < desiredAmount) {
      // We have enough money to adjust share price to the desired level. So just use whatever amount is left
      desiredAmount = amountRemaining;
    }
    uint256 sharePriceDifference = usdcToSharePrice(desiredAmount, totalShares);
    return (amountRemaining.sub(desiredAmount), currentSharePrice.add(sharePriceDifference));
  }

  function usdcToSharePrice(uint256 amount, uint256 totalShares) public pure returns (uint256) {
    return amount.mul(scalingFactor()).div(totalShares);
  }

  function sharePriceToUsdc(uint256 sharePrice, uint256 totalShares) public pure returns (uint256) {
    return sharePrice.mul(totalShares).div(scalingFactor());
  }

  function scalingFactor() internal pure returns (uint256) {
    // TODO: We could probably just used FixedPoint for this
    return uint256(10)**uint256(18);
  }

  function assess() public {
    (uint256 paymentRemaining, uint256 interestPayment, uint256 principalPayment) = creditLine.assess();

    if (interestPayment > 0 || principalPayment > 0) {
      emit PaymentApplied(creditLine.borrower(), address(this), interestPayment, principalPayment, paymentRemaining);
      collectInterestAndPrincipal(address(creditLine), interestPayment, principalPayment);
    }
  }

  modifier onlyCreditDesk() {
    require(msg.sender == config.creditDeskAddress(), "Only the credit desk is allowed to call this function");
    _;
  }
}
