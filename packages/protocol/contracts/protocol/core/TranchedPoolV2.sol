// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20Permit} from "@openzeppelin/contracts/drafts/IERC20Permit.sol";
import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import {SafeMath} from "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import {ITranchedPool} from "../../interfaces/ITranchedPool.sol";
import {IV2TranchedPool} from "../../interfaces/IV2TranchedPool.sol";
import {IRequiresUID} from "../../interfaces/IRequiresUID.sol";
import {IERC20withDec} from "../../interfaces/IERC20withDec.sol";
import {IV3CreditLine} from "../../interfaces/IV3CreditLine.sol";
import {IBackerRewards} from "../../interfaces/IBackerRewards.sol";
import {IPoolTokens} from "../../interfaces/IPoolTokens.sol";
import {IVersioned} from "../../interfaces/IVersioned.sol";
import {GoldfinchConfig} from "./GoldfinchConfig.sol";
import {BaseUpgradeablePausable} from "./BaseUpgradeablePausable.sol";
import {ConfigHelper} from "./ConfigHelper.sol";
import {SafeERC20Transfer} from "../../library/SafeERC20Transfer.sol";
import {TranchingLogic} from "./TranchingLogic.sol";

/// @title The main contract to faciliate lending. Backers and the Senior Pool fund the loan
///   through this contract. The borrower draws down on and pays back a loan through this contract.
/// @author Warbler Labs
contract TranchedPoolV2 is BaseUpgradeablePausable, IV2TranchedPool, IRequiresUID, IVersioned {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using TranchingLogic for ITranchedPool.PoolSlice;
  using TranchingLogic for ITranchedPool.TrancheInfo;
  using SafeERC20Transfer for IERC20withDec;

  bytes32 public constant LOCKER_ROLE = keccak256("LOCKER_ROLE");
  bytes32 public constant SENIOR_ROLE = keccak256("SENIOR_ROLE");
  uint8 internal constant MAJOR_VERSION = 1;
  uint8 internal constant MINOR_VERSION = 0;
  uint8 internal constant PATCH_VERSION = 0;

  IV3CreditLine public override creditLine;
  uint256 public override createdAt;
  uint256 public juniorFeePercent;
  bool public drawdownsPaused;
  uint256[] public allowedUIDTypes;
  uint256 public totalDeployed;
  uint256 public fundableAt;

  mapping(uint256 => ITranchedPool.PoolSlice) internal _poolSlices;

  /// @inheritdoc IV2TranchedPool
  uint256 public override numSlices;

  /// @inheritdoc IV2TranchedPool
  function initialize(
    address _config,
    address _borrower,
    uint256 _juniorFeePercent,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr,
    uint256 _principalGracePeriodInDays,
    uint256 _fundableAt,
    uint256[] calldata _allowedUIDTypes
  ) public override initializer {
    require(address(_config) != address(0) && address(_borrower) != address(0), "ZERO");

    config = GoldfinchConfig(_config);
    address owner = config.protocolAdminAddress();
    __BaseUpgradeablePausable__init(owner);
    _initializeNextSlice(_fundableAt);
    _createAndSetCreditLine(
      _borrower,
      _limit,
      _interestApr,
      _paymentPeriodInDays,
      _termInDays,
      _lateFeeApr,
      _principalGracePeriodInDays
    );

    createdAt = block.timestamp;
    juniorFeePercent = _juniorFeePercent;
    if (_allowedUIDTypes.length == 0) {
      uint256[1] memory defaultAllowedUIDTypes = [config.getGo().ID_TYPE_0()];
      allowedUIDTypes = defaultAllowedUIDTypes;
    } else {
      allowedUIDTypes = _allowedUIDTypes;
    }

    _setupRole(LOCKER_ROLE, _borrower);
    _setupRole(LOCKER_ROLE, owner);
    _setRoleAdmin(LOCKER_ROLE, OWNER_ROLE);
    _setRoleAdmin(SENIOR_ROLE, OWNER_ROLE);

    // Give the senior pool the ability to deposit into the senior pool
    _setupRole(SENIOR_ROLE, address(config.getSeniorPool()));
  }

  function setAllowedUIDTypes(uint256[] calldata ids) external onlyLocker {
    require(
      _poolSlices[0].juniorTranche.principalDeposited == 0 &&
        _poolSlices[0].seniorTranche.principalDeposited == 0,
      "has balance"
    );
    allowedUIDTypes = ids;
  }

  function getAllowedUIDTypes() external view returns (uint256[] memory) {
    return allowedUIDTypes;
  }

  /// @notice Intentionable no-op. Included to be compatible with the v1 pool interface
  // solhint-disable-next-line no-empty-blocks
  function assess() external override whenNotPaused {}

  /// @inheritdoc IV2TranchedPool
  /// @dev TL: tranche locked
  /// @dev IA: invalid amount
  /// @dev NA: not authorized. Must have correct UID or be go listed
  function deposit(
    uint256 tranche,
    uint256 amount
  ) public override nonReentrant whenNotPaused returns (uint256) {
    ITranchedPool.TrancheInfo storage trancheInfo = _getTrancheInfo(tranche);
    require(trancheInfo.lockedUntil == 0, "TL");
    require(amount > 0, "IA");
    require(hasAllowedUID(msg.sender), "NA");
    require(block.timestamp > fundableAt, "Not open");
    // senior tranche ids are always odd numbered
    if (TranchingLogic.isSeniorTrancheId(trancheInfo.id)) {
      require(hasRole(SENIOR_ROLE, _msgSender()), "NA");
    }

    trancheInfo.principalDeposited = trancheInfo.principalDeposited.add(amount);
    uint256 tokenId = config.getPoolTokens().mint(
      IPoolTokens.MintParams({tranche: tranche, principalAmount: amount}),
      msg.sender
    );

    config.getUSDC().safeERC20TransferFrom(msg.sender, address(this), amount);
    emit DepositMade(msg.sender, tranche, tokenId, amount);
    return tokenId;
  }

  function depositWithPermit(
    uint256 tranche,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public override returns (uint256 tokenId) {
    IERC20Permit(config.usdcAddress()).permit(msg.sender, address(this), amount, deadline, v, r, s);
    return deposit(tranche, amount);
  }

  /// @inheritdoc IV2TranchedPool
  function withdraw(
    uint256 tokenId,
    uint256 amount
  ) public override nonReentrant whenNotPaused returns (uint256, uint256) {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    ITranchedPool.TrancheInfo storage trancheInfo = _getTrancheInfo(tokenInfo.tranche);

    return _withdraw(trancheInfo, tokenInfo, tokenId, amount);
  }

  /// @inheritdoc IV2TranchedPool
  /// @dev LEN: argument length mismatch
  function withdrawMultiple(
    uint256[] calldata tokenIds,
    uint256[] calldata amounts
  ) public override {
    require(tokenIds.length == amounts.length, "LEN");

    for (uint256 i = 0; i < amounts.length; i++) {
      withdraw(tokenIds[i], amounts[i]);
    }
  }

  /// @inheritdoc IV2TranchedPool
  function withdrawMax(
    uint256 tokenId
  )
    external
    override
    nonReentrant
    whenNotPaused
    returns (uint256 interestWithdrawn, uint256 principalWithdrawn)
  {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    ITranchedPool.TrancheInfo storage trancheInfo = _getTrancheInfo(tokenInfo.tranche);

    (uint256 interestRedeemable, uint256 principalRedeemable) = TranchingLogic
      .redeemableInterestAndPrincipal(trancheInfo, tokenInfo);

    uint256 amount = interestRedeemable.add(principalRedeemable);

    return _withdraw(trancheInfo, tokenInfo, tokenId, amount);
  }

  /// @inheritdoc IV2TranchedPool
  /// @dev DP: drawdowns paused
  /// @dev IF: insufficient funds
  function drawdown(uint256 amount) external override onlyLocker whenNotPaused {
    require(!drawdownsPaused, "DP");
    if (!_locked()) {
      // Assumes the senior pool has invested already (saves the borrower a separate transaction to lock the pool)
      _lockPool();
    }
    // Drawdown only draws down from the current slice for simplicity. It's harder to account for how much
    // money is available from previous slices since depositors can redeem after unlock.
    ITranchedPool.PoolSlice storage currentSlice = _poolSlices[numSlices - 1];
    uint256 amountAvailable = TranchingLogic.sharePriceToUsdc(
      currentSlice.juniorTranche.principalSharePrice,
      currentSlice.juniorTranche.principalDeposited
    );
    amountAvailable = amountAvailable.add(
      TranchingLogic.sharePriceToUsdc(
        currentSlice.seniorTranche.principalSharePrice,
        currentSlice.seniorTranche.principalDeposited
      )
    );

    require(amount <= amountAvailable, "IF");

    creditLine.drawdown(amount);

    // Update the share price to reflect the amount remaining in the pool
    uint256 amountRemaining = amountAvailable.sub(amount);
    uint256 oldJuniorPrincipalSharePrice = currentSlice.juniorTranche.principalSharePrice;
    uint256 oldSeniorPrincipalSharePrice = currentSlice.seniorTranche.principalSharePrice;
    currentSlice.juniorTranche.principalSharePrice = currentSlice
      .juniorTranche
      .calculateExpectedSharePrice(amountRemaining, currentSlice);
    currentSlice.seniorTranche.principalSharePrice = currentSlice
      .seniorTranche
      .calculateExpectedSharePrice(amountRemaining, currentSlice);
    currentSlice.principalDeployed = currentSlice.principalDeployed.add(amount);
    totalDeployed = totalDeployed.add(amount);

    address borrower = creditLine.borrower();
    IBackerRewards backerRewards = IBackerRewards(config.backerRewardsAddress());
    backerRewards.onTranchedPoolDrawdown(numSlices - 1);
    config.getUSDC().safeERC20Transfer(borrower, amount);
    emit DrawdownMade(borrower, amount);
    emit SharePriceUpdated(
      address(this),
      currentSlice.juniorTranche.id,
      currentSlice.juniorTranche.principalSharePrice,
      int256(oldJuniorPrincipalSharePrice.sub(currentSlice.juniorTranche.principalSharePrice)) * -1,
      currentSlice.juniorTranche.interestSharePrice,
      0
    );
    emit SharePriceUpdated(
      address(this),
      currentSlice.seniorTranche.id,
      currentSlice.seniorTranche.principalSharePrice,
      int256(oldSeniorPrincipalSharePrice.sub(currentSlice.seniorTranche.principalSharePrice)) * -1,
      currentSlice.seniorTranche.interestSharePrice,
      0
    );
  }

  /// @inheritdoc IV2TranchedPool
  function lockJuniorCapital() external override onlyLocker whenNotPaused {
    _lockJuniorCapital(numSlices.sub(1));
  }

  /// @inheritdoc IV2TranchedPool
  function lockPool() external override onlyLocker whenNotPaused {
    _lockPool();
  }

  /// @inheritdoc IV2TranchedPool
  function setFundableAt(uint256 newFundableAt) external override onlyLocker {
    fundableAt = newFundableAt;
  }

  /// @inheritdoc IV2TranchedPool
  /// @dev NL: not locked
  /// @dev LP: late payment
  /// @dev GP: beyond principal grace period
  function initializeNextSlice(uint256 _fundableAt) external override onlyLocker whenNotPaused {
    require(_locked(), "NL");
    require(!creditLine.isLate(), "LP");
    require(creditLine.withinPrincipalGracePeriod(), "GP");
    _initializeNextSlice(_fundableAt);
    emit SliceCreated(address(this), numSlices.sub(1));
  }

  /// @inheritdoc IV2TranchedPool
  /// @dev IT: invalid timestamp
  /// @dev LI: loan inactive
  function getAmountsOwed(
    uint256 timestamp
  )
    external
    view
    override
    returns (uint256 interestOwed, uint256 interestAccrued, uint256 principalOwed)
  {
    require(timestamp >= block.timestamp, "IT");
    require(creditLine.termEndTime() > 0, "LI");

    return (
      creditLine.interestOwedAt(timestamp),
      creditLine.interestAccruedAt(timestamp),
      creditLine.principalOwedAt(timestamp)
    );
  }

  /// @inheritdoc IV2TranchedPool
  /// @dev ZA: zero amount
  function pay(uint256 amount) external override whenNotPaused returns (PaymentAllocation memory) {
    require(amount > 0, "ZA");
    // Send money to the credit line. Only take what's actually owed
    uint256 maxPayableAmount = creditLine.interestAccrued().add(creditLine.interestOwed()).add(
      creditLine.balance()
    );
    uint256 amountToPay = Math.min(amount, maxPayableAmount);
    config.getUSDC().safeERC20TransferFrom(
      msg.sender,
      address(this),
      amountToPay,
      "Failed to collect payment"
    );

    PaymentAllocation memory pa = _pay(amountToPay);

    assert(pa.paymentRemaining == 0);
    return pa;
  }

  /// @inheritdoc IV2TranchedPool
  /// @dev ZA: zero amount
  /// @dev PO: principal overpayment
  function pay(
    uint256 principalAmount,
    uint256 interestAmount
  ) external override whenNotPaused returns (PaymentAllocation memory) {
    uint256 totalPayment = principalAmount.add(interestAmount);
    require(totalPayment > 0, "ZA");
    require(principalAmount <= creditLine.balance(), "PO");

    // If there is an excess interest payment then only take what we actually need
    uint256 maxPayableInterest = creditLine.interestAccrued().add(creditLine.interestOwed());
    uint256 interestToPay = Math.min(maxPayableInterest, interestAmount);
    config.getUSDC().safeERC20TransferFrom(
      msg.sender,
      address(this),
      principalAmount.add(interestToPay)
    );
    PaymentAllocation memory pa = _pay(principalAmount, interestToPay);

    assert(pa.paymentRemaining == 0);
    return pa;
  }

  /// @notice Pauses the pool and sweeps any remaining funds to the treasury reserve.
  function emergencyShutdown() public onlyAdmin {
    if (!paused()) {
      pause();
    }

    IERC20withDec usdc = config.getUSDC();
    address reserveAddress = config.reserveAddress();
    // Sweep any funds to community reserve
    uint256 poolBalance = usdc.balanceOf(address(this));
    if (poolBalance > 0) {
      config.getUSDC().safeERC20Transfer(reserveAddress, poolBalance);
    }

    uint256 clBalance = usdc.balanceOf(address(creditLine));
    if (clBalance > 0) {
      usdc.safeERC20TransferFrom(address(creditLine), reserveAddress, clBalance);
    }
    emit EmergencyShutdown(address(this));
  }

  /// @notice Pauses all drawdowns (but not deposits/withdraws)
  function pauseDrawdowns() public onlyAdmin {
    drawdownsPaused = true;
    emit DrawdownsPaused(address(this));
  }

  /// @notice Unpause drawdowns
  function unpauseDrawdowns() public onlyAdmin {
    drawdownsPaused = false;
    emit DrawdownsUnpaused(address(this));
  }

  /// @notice Create a new credit line, copy the accounting variables of the old credit line
  ///   to the new one, and discard the old one. Useful for if there's a bug in the old credit
  ///   line and we want to migrate it a new patched impl.
  function migrateCreditLine(
    address _borrower,
    uint256 _maxLimit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr,
    uint256 _principalGracePeriodInDays
  ) public onlyAdmin {
    require(_borrower != address(0) && _paymentPeriodInDays != 0 && _termInDays != 0, "ZERO");

    IV3CreditLine originalCl = creditLine;

    _createAndSetCreditLine(
      _borrower,
      _maxLimit,
      _interestApr,
      _paymentPeriodInDays,
      _termInDays,
      _lateFeeApr,
      _principalGracePeriodInDays,
      originalCl
    );

    originalCl.close();

    // Ensure Roles
    address originalBorrower = originalCl.borrower();
    address newBorrower = creditLine.borrower();
    if (originalBorrower != newBorrower) {
      revokeRole(LOCKER_ROLE, originalBorrower);
      grantRole(LOCKER_ROLE, newBorrower);
    }
    // Transfer any funds to new CL
    uint256 clBalance = config.getUSDC().balanceOf(address(originalCl));
    if (clBalance > 0) {
      config.getUSDC().safeERC20TransferFrom(address(originalCl), address(creditLine), clBalance);
    }
    emit CreditLineMigrated(originalCl, creditLine);
  }

  // CreditLine proxy method
  function setLimit(uint256 newAmount) external onlyAdmin {
    return creditLine.setLimit(newAmount);
  }

  function setMaxLimit(uint256 newAmount) external onlyAdmin {
    return creditLine.setMaxLimit(newAmount);
  }

  /// @inheritdoc IV2TranchedPool
  function getTranche(
    uint256 tranche
  ) public view override returns (ITranchedPool.TrancheInfo memory) {
    return _getTrancheInfo(tranche);
  }

  /// @inheritdoc IV2TranchedPool
  function poolSlices(
    uint256 index
  ) external view override returns (ITranchedPool.PoolSlice memory) {
    return _poolSlices[index];
  }

  /// @inheritdoc IV2TranchedPool
  function totalJuniorDeposits() external view override returns (uint256) {
    uint256 total;
    for (uint256 i = 0; i < numSlices; i++) {
      total = total.add(_poolSlices[i].juniorTranche.principalDeposited);
    }
    return total;
  }

  /// @inheritdoc IV2TranchedPool
  function availableToWithdraw(uint256 tokenId) public view override returns (uint256, uint256) {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    ITranchedPool.TrancheInfo storage trancheInfo = _getTrancheInfo(tokenInfo.tranche);

    if (block.timestamp > trancheInfo.lockedUntil) {
      return TranchingLogic.redeemableInterestAndPrincipal(trancheInfo, tokenInfo);
    } else {
      return (0, 0);
    }
  }

  function hasAllowedUID(address sender) public view override returns (bool) {
    return config.getGo().goOnlyIdTypes(sender, allowedUIDTypes);
  }

  /* Internal functions  */

  /// @dev NL: not locked
  function _pay(uint256 amount) internal returns (PaymentAllocation memory) {
    // We need to make sure the pool is locked before we allocate rewards to ensure it's not
    // possible to game rewards by sandwiching an interest payment to an unlocked pool
    // It also causes issues trying to allocate payments to an empty slice (divide by zero)
    require(_locked(), "NL");

    uint256 interestAccrued = creditLine.totalInterestAccruedAt(creditLine.interestAccruedAsOf());
    PaymentAllocation memory pa = creditLine.pay(amount);
    interestAccrued = creditLine.totalInterestAccrued().sub(interestAccrued);

    distributeToSlicesAndAllocateBackerRewards(interestAccrued, pa);
    return pa;
  }

  /// @dev NL: not locked
  function _pay(
    uint256 principalPayment,
    uint256 interestPayment
  ) internal returns (PaymentAllocation memory) {
    // We need to make sure the pool is locked before we allocate rewards to ensure it's not
    // possible to game rewards by sandwiching an interest payment to an unlocked pool
    // It also causes issues trying to allocate payments to an empty slice (divide by zero)
    require(_locked(), "NL");

    uint256 interestAccrued = creditLine.totalInterestAccrued();
    PaymentAllocation memory pa = creditLine.pay(principalPayment, interestPayment);
    interestAccrued = creditLine.totalInterestAccrued().sub(interestAccrued);

    distributeToSlicesAndAllocateBackerRewards(interestAccrued, pa);
    return pa;
  }

  function distributeToSlicesAndAllocateBackerRewards(
    uint256 interestAccrued,
    PaymentAllocation memory pa
  ) internal {
    // Split the interest accrued proportionally across slices so we know how much interest goes to each slice
    // We need this because the slice start at different times, so we cannot retroactively allocate the interest
    // linearly
    uint256[] memory principalPaymentsPerSlice = new uint256[](numSlices);
    for (uint256 i = 0; i < numSlices; i++) {
      uint256 interestForSlice = TranchingLogic.scaleByFraction(
        interestAccrued,
        _poolSlices[i].principalDeployed,
        totalDeployed
      );
      principalPaymentsPerSlice[i] = TranchingLogic.scaleByFraction(
        pa.principalPayment.add(pa.additionalBalancePayment),
        _poolSlices[i].principalDeployed,
        totalDeployed
      );
      _poolSlices[i].totalInterestAccrued = _poolSlices[i].totalInterestAccrued.add(
        interestForSlice
      );
    }

    uint256 interestPayment = pa.owedInterestPayment.add(pa.accruedInterestPayment);
    uint256 principalPayment = pa.principalPayment.add(pa.additionalBalancePayment);
    if (interestPayment > 0 || principalPayment > 0) {
      uint256 reserveAmount = _collectInterestAndPrincipal(interestPayment, principalPayment);

      for (uint256 i = 0; i < numSlices; i++) {
        _poolSlices[i].principalDeployed = _poolSlices[i].principalDeployed.sub(
          principalPaymentsPerSlice[i]
        );
        totalDeployed = totalDeployed.sub(principalPaymentsPerSlice[i]);
      }

      config.getBackerRewards().allocateRewards(interestPayment);

      emit PaymentApplied(
        creditLine.borrower(),
        address(this),
        pa.owedInterestPayment.add(pa.accruedInterestPayment),
        principalPayment,
        pa.paymentRemaining,
        reserveAmount
      );
    }
  }

  function _collectInterestAndPrincipal(
    uint256 interest,
    uint256 principal
  ) internal returns (uint256) {
    uint256 totalReserveAmount = TranchingLogic.applyToAllSlices(
      _poolSlices,
      numSlices,
      interest,
      principal,
      uint256(100).div(config.getReserveDenominator()), // Convert the denominator to percent
      totalDeployed,
      creditLine,
      juniorFeePercent
    );

    config.getUSDC().safeERC20Transfer(config.reserveAddress(), totalReserveAmount);

    emit ReserveFundsCollected(address(this), totalReserveAmount);

    return totalReserveAmount;
  }

  function _createAndSetCreditLine(
    address _borrower,
    uint256 _maxLimit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr,
    uint256 _principalGracePeriodInDays
  ) internal {
    creditLine = IV3CreditLine(config.getGoldfinchFactory().createCreditLine());
    creditLine.initialize(
      address(config),
      address(this), // Set self as the owner
      _borrower,
      _maxLimit,
      _interestApr,
      _paymentPeriodInDays,
      _termInDays,
      _lateFeeApr,
      _principalGracePeriodInDays
    );
  }

  function _createAndSetCreditLine(
    address _borrower,
    uint256 _maxLimit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr,
    uint256 _principalGracePeriodInDays,
    IV3CreditLine oldCl
  ) internal {
    creditLine = IV3CreditLine(config.getGoldfinchFactory().createCreditLine());
    creditLine.initialize(
      address(config),
      address(this), // Set self as the owner
      _borrower,
      _maxLimit,
      _interestApr,
      _paymentPeriodInDays,
      _termInDays,
      _lateFeeApr,
      _principalGracePeriodInDays,
      oldCl
    );
  }

  // // Internal //////////////////////////////////////////////////////////////////

  /// @dev ZA: Zero amount
  /// @dev IA: Invalid amount - amount too large
  /// @dev TL: Tranched Locked
  function _withdraw(
    ITranchedPool.TrancheInfo storage trancheInfo,
    IPoolTokens.TokenInfo memory tokenInfo,
    uint256 tokenId,
    uint256 amount
  ) internal returns (uint256, uint256) {
    /// @dev NA: not authorized
    require(
      config.getPoolTokens().isApprovedOrOwner(msg.sender, tokenId) && hasAllowedUID(msg.sender),
      "NA"
    );
    require(amount > 0, "ZA");
    (uint256 interestRedeemable, uint256 principalRedeemable) = TranchingLogic
      .redeemableInterestAndPrincipal(trancheInfo, tokenInfo);
    uint256 netRedeemable = interestRedeemable.add(principalRedeemable);

    require(amount <= netRedeemable, "IA");
    require(block.timestamp > trancheInfo.lockedUntil, "TL");

    uint256 interestToRedeem = 0;
    uint256 principalToRedeem = 0;

    // If the tranche has not been locked, ensure the deposited amount is correct
    if (trancheInfo.lockedUntil == 0) {
      trancheInfo.principalDeposited = trancheInfo.principalDeposited.sub(amount);

      principalToRedeem = amount;

      config.getPoolTokens().withdrawPrincipal(tokenId, principalToRedeem);
    } else {
      interestToRedeem = Math.min(interestRedeemable, amount);
      principalToRedeem = Math.min(principalRedeemable, amount.sub(interestToRedeem));

      config.getPoolTokens().redeem(tokenId, principalToRedeem, interestToRedeem);
    }

    config.getUSDC().safeERC20Transfer(msg.sender, principalToRedeem.add(interestToRedeem));

    emit WithdrawalMade(
      msg.sender,
      tokenInfo.tranche,
      tokenId,
      interestToRedeem,
      principalToRedeem
    );

    return (interestToRedeem, principalToRedeem);
  }

  /// @dev TL: tranch locked or has been locked before
  function _lockJuniorCapital(uint256 sliceId) internal {
    require(!_locked() && _poolSlices[sliceId].juniorTranche.lockedUntil == 0, "TL");
    TranchingLogic.lockTranche(_poolSlices[sliceId].juniorTranche, config);
  }

  /// @dev NL: Not locked
  /// @dev TL: tranche locked. The senior pool has already been locked.
  function _lockPool() internal {
    ITranchedPool.PoolSlice storage slice = _poolSlices[numSlices.sub(1)];
    require(slice.juniorTranche.lockedUntil > 0, "NL");
    // Allow locking the pool only once; do not allow extending the lock of an
    // already-locked pool. Otherwise the locker could keep the pool locked
    // indefinitely, preventing withdrawals.
    require(slice.seniorTranche.lockedUntil == 0, "TL");

    uint256 currentTotal = slice.juniorTranche.principalDeposited.add(
      slice.seniorTranche.principalDeposited
    );
    creditLine.setLimit(Math.min(creditLine.limit().add(currentTotal), creditLine.maxLimit()));

    // We start the drawdown period, so backers can withdraw unused capital after borrower draws down
    TranchingLogic.lockTranche(slice.juniorTranche, config);
    TranchingLogic.lockTranche(slice.seniorTranche, config);
  }

  /// @dev SL: slice limit
  function _initializeNextSlice(uint256 newFundableAt) internal {
    require(numSlices < 5, "SL");
    TranchingLogic.initializeNextSlice(_poolSlices, numSlices);
    numSlices = numSlices.add(1);
    fundableAt = newFundableAt;
  }

  // If the senior tranche of the current slice is locked, then the pool is not open to any more deposits
  // (could throw off leverage ratio)
  function _locked() internal view returns (bool) {
    return numSlices == 0 || _poolSlices[numSlices - 1].seniorTranche.lockedUntil > 0;
  }

  function _getTrancheInfo(
    uint256 trancheId
  ) internal view returns (ITranchedPool.TrancheInfo storage) {
    require(
      trancheId > 0 && trancheId <= numSlices.mul(TranchingLogic.NUM_TRANCHES_PER_SLICE),
      "invalid tranche"
    );
    uint256 sliceId = TranchingLogic.trancheIdToSliceIndex(trancheId);
    ITranchedPool.PoolSlice storage slice = _poolSlices[sliceId];
    ITranchedPool.TrancheInfo storage trancheInfo = TranchingLogic.isSeniorTrancheId(trancheId)
      ? slice.seniorTranche
      : slice.juniorTranche;
    return trancheInfo;
  }

  // // Modifiers /////////////////////////////////////////////////////////////////

  /// @inheritdoc IVersioned
  function getVersion() external pure override returns (uint8[3] memory version) {
    (version[0], version[1], version[2]) = (MAJOR_VERSION, MINOR_VERSION, PATCH_VERSION);
  }

  /// @dev NA: not authorized. not locker
  modifier onlyLocker() {
    require(hasRole(LOCKER_ROLE, msg.sender), "NA");
    _;
  }
}
