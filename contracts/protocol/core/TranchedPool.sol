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

contract TranchedPool is BaseUpgradeablePausable, ITranchedPool {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  // Pool is locked after first drawdown, at this point no more deposits are allowed.
  uint256 public poolLockedAt = 0;
  // This is the initial investment period. This means all the junior capital is in, and it's ready to be drawndown
  // once senior capital invests
  uint256 public juniorLockedAt = 0;

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
    address _creditLine
  ) public override initializer {
    __BaseUpgradeablePausable__init(owner);
    seniorTranche = TrancheInfo({principalSharePrice: 1, interestSharePrice: 0, principalDeposited: 0, interestAPR: 0});
    juniorTranche = TrancheInfo({principalSharePrice: 1, interestSharePrice: 0, principalDeposited: 0, interestAPR: 0});
    config = GoldfinchConfig(_config);
    // We may need to call the factory here to create the creditLine, or have the factory provide owner role on the
    // creditLine to this contract
    // TODO: Set both of these as immutable in the constructure, if we can. It will
    // make it cheaper to call them
    creditLine = IV2CreditLine(_creditLine);
    createdAt = block.timestamp;
  }

  function deposit(uint256 tranche, uint256 amount) public {
    require(!locked(), "Pool has been locked");
    require(tranche == 1 || tranche == 2, "Unsupported tranche");

    if (tranche == 1) {
      // senior
      seniorTranche.principalDeposited += amount;
    } else if (tranche == 2) {
      // junior
      require(juniorLockedAt == 0, "Junior tranche has been locked");
      juniorTranche.principalDeposited += amount;
    }
    IPoolTokens.MintParams memory params = IPoolTokens.MintParams({tranche: tranche, principalAmount: amount});
    config.getPoolTokens().mint(params, msg.sender);
  }

  function withdraw(uint256 tokenId, uint256 amount) public {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    require(tokenInfo.tranche == 1 || tokenInfo.tranche == 2, "Unsupported tranche");
    TrancheInfo memory tranche = tokenInfo.tranche == 1 ? seniorTranche : juniorTranche;

    // This supports withdrawing before or after locking because principal share price starts at 1
    // and is set to 0 on lock. Interest share price is always 0 until interest payments come back, when it increases
    uint256 maxAmountRedeemable = (tranche.principalSharePrice * tokenInfo.principalAmount) +
      (tranche.interestSharePrice * tokenInfo.principalAmount);

    require(
      amount.add(tokenInfo.principalRedeemed).add(tokenInfo.interestRedeemed) <= maxAmountRedeemable,
      "Invalid redeem amount"
    );

    // TODO: Fix
    poolTokens.redeem(tokenId, amount, 0);
    doUSDCTransfer(address(this), msg.sender, amount);
  }

  function drawdown(uint256 amount) public onlyCreditDesk {
    // We assume fund has applied it's leverage formula
    if (!locked()) {
      lockPool();
    }
    doUSDCTransfer(address(this), creditLine.borrower(), amount);
  }

  // Mark the investment period as over
  function lockJuniorCapital() public onlyAdmin {
    require(!locked(), "Pool already locked");
    require(juniorLockedAt == 0, "Junior tranche already locked");

    juniorTranche.principalSharePrice = 0;
    juniorLockedAt = block.timestamp;
  }

  function lockPool() public onlyAdmin {
    require(juniorLockedAt > 0, "Junior tranche must be locked first");

    uint256 seniorSharesFraction = percentOwnership(seniorTranche);
    seniorTranche.interestAPR = creditLine.interestApr() * seniorSharesFraction;
    juniorTranche.interestAPR = creditLine.interestApr() * (1 - seniorSharesFraction);
    seniorTranche.principalSharePrice = 0;

    creditLine.setLimit(seniorTranche.principalDeposited + juniorTranche.principalDeposited);

    poolLockedAt = block.timestamp;
  }

  function collectInterestAndPrincipal(uint256 interest, uint256 principal) internal {
    address from = address(creditLine);
    bool success = doUSDCTransfer(from, address(this), principal.add(interest));
    require(success, "Failed to collect repayment");

    (uint256 expectedSeniorSharePrice, uint256 expectedSeniorInterestSharePrice) = calculateExpectedSharePrice(
      seniorTranche
    );

    // This may also need to happen in calculateExpectedSharePrice
    uint256 reserveAmount = interest.div(config.getReserveDenominator()); // protocol fee

    uint256 interestRemaining = interest.sub(reserveAmount);
    uint256 principalRemaining = principal;

    // Increase senior share price
    if (interestRemaining > 0 && seniorTranche.interestSharePrice < expectedSeniorInterestSharePrice) {
      seniorTranche.interestSharePrice =
        seniorTranche.interestSharePrice +
        (interestRemaining * percentOwnership(seniorTranche));
      interestRemaining = interestRemaining - interestRemaining * expectedSeniorInterestSharePrice;
    }
    if (principalRemaining > 0 && seniorTranche.principalSharePrice < expectedSeniorSharePrice) {
      seniorTranche.principalSharePrice =
        seniorTranche.principalSharePrice +
        (principalRemaining * percentOwnership(seniorTranche));
      principalRemaining = principalRemaining - principalRemaining * expectedSeniorSharePrice;
    }

    // increase junior share price with whatever is remaining
    (uint256 expectedJuniorSharePrice, uint256 expectedJuniorInterestSharePrice) = calculateExpectedSharePrice(
      juniorTranche
    );
    // Increase junior share price
    if (interestRemaining > 0 && juniorTranche.interestSharePrice < expectedJuniorInterestSharePrice) {
      juniorTranche.interestSharePrice =
        juniorTranche.interestSharePrice +
        (interestRemaining * percentOwnership(juniorTranche));
      interestRemaining = interestRemaining - interestRemaining * expectedJuniorInterestSharePrice;
    }
    if (principalRemaining > 0 && juniorTranche.principalSharePrice < expectedJuniorSharePrice) {
      juniorTranche.principalSharePrice =
        juniorTranche.principalSharePrice +
        (principalRemaining * percentOwnership(juniorTranche));
      principalRemaining = principalRemaining - principalRemaining * expectedJuniorSharePrice;
    }
  }

  function splitAmountByFraction(
    uint256 amount,
    uint256 sharePrice,
    uint256 fraction
  ) internal returns (uint256, uint256) {
    uint256 newSharePrice = sharePrice + ((amount * fraction) / 100); // scaling may be off for interest, verify
    return (newSharePrice, amount * fraction);
  }

  function calculateExpectedSharePrice(TrancheInfo memory tranche) internal returns (uint256, uint256) {
    // // Same as right now
    // (uint256 principalAccrued, uint256 interestAccrued) = Accountant.calculateInterestAndPrincipalAccrued(
    //   creditLine,
    //   block.timestamp,
    //   config.getLatenessGracePeriodInDays()
    // );
    // uint256 ownershipFraction = percentOwnership(tranche);
    // // interest apr needs to be scaled down
    // return (principalAccrued * ownershipFraction, (interestAccrued * ownershipFraction) / 100);
    return (0, 0);
  }

  function locked() internal returns (bool) {
    return poolLockedAt > 0 && poolLockedAt <= block.timestamp;
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

  function percentOwnership(TrancheInfo memory tranche) internal view returns (uint256) {
    // TODO: Fix
    return tranche.principalDeposited.div(seniorTranche.principalDeposited.add(juniorTranche.principalDeposited));
  }

  function assess() public {
    (uint256 paymentRemaining, uint256 interestPayment, uint256 principalPayment) = creditLine.assess();

    if (interestPayment > 0 || principalPayment > 0) {
      emit PaymentApplied(creditLine.borrower(), address(this), interestPayment, principalPayment, paymentRemaining);
      collectInterestAndPrincipal(interestPayment, principalPayment);
    }
  }

  modifier onlyCreditDesk() {
    require(msg.sender == config.creditDeskAddress(), "Only the credit desk is allowed to call this function");
    _;
  }
}
