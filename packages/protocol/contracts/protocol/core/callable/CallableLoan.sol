// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

// solhint-disable-next-line max-line-length
import {IERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {ICallableLoan} from "../../../interfaces/ICallableLoan.sol";
import {ILoan} from "../../../interfaces/ILoan.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {IRequiresUID} from "../../../interfaces/IRequiresUID.sol";
import {IERC20UpgradeableWithDec} from "../../../interfaces/IERC20UpgradeableWithDec.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {IVersioned} from "../../../interfaces/IVersioned.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {IGoldfinchConfig} from "../../../interfaces/IGoldfinchConfig.sol";
import {CallableLoanConfigHelper} from "./CallableLoanConfigHelper.sol";
import {SafeERC20Transfer} from "../../../library/SafeERC20Transfer08x.sol";
import {Waterfall, Tranche, WaterfallLogic, TrancheLogic} from "./structs/Waterfall.sol";
// solhint-disable-next-line max-line-length
import {CheckpointedCallableCreditLine, CheckpointedCallableCreditLineLogic, CallableCreditLine, CallableCreditLineLogic, WaterfallLogic, TrancheLogic} from "./structs/CallableCreditLine.sol";
import {BaseUpgradeablePausable} from "../BaseUpgradeablePausable08x.sol";
import {SaturatingSub} from "../../../library/SaturatingSub.sol";
import {PaymentSchedule, PaymentScheduleLogic} from "../schedule/PaymentSchedule.sol";

/// @title The main contract to faciliate lending. Backers and the Senior Pool fund the loan
///   through this contract. The borrower draws down on and pays back a loan through this contract.
/// @author Warbler Labs
contract CallableLoan is
  BaseUpgradeablePausable,
  ITranchedPool,
  ICallableLoan,
  ICreditLine,
  // TODO: Should remove ITranchedPool once we have moved all casts from ITranchedPool to ILoan.
  IRequiresUID,
  IVersioned
{
  IGoldfinchConfig public config;

  using CallableLoanConfigHelper for IGoldfinchConfig;
  using SafeERC20Transfer for IERC20UpgradeableWithDec;
  using SaturatingSub for uint256;

  bytes32 public constant LOCKER_ROLE = keccak256("LOCKER_ROLE");
  uint8 internal constant MAJOR_VERSION = 1;
  uint8 internal constant MINOR_VERSION = 0;
  uint8 internal constant PATCH_VERSION = 0;

  CallableCreditLine private callableCreditLine;

  uint256 public override startTime;
  uint256 public override createdAt;
  address public override borrower;
  bool public drawdownsPaused;
  uint256[] public allowedUIDTypes;
  uint256 public totalDeployed;
  uint256 public fundableAt;

  /// @inheritdoc ITranchedPool
  function initialize(
    address _config,
    address _borrower,
    // TODO: Remove once ITranchedPool conformance is removed
    uint256 _juniorFeePercent,
    uint256 _limit,
    uint256 _interestApr,
    ISchedule _schedule,
    uint256 _lateFeeApr,
    uint256 _fundableAt,
    uint256[] calldata _allowedUIDTypes
  ) public override initializer {
    require(address(_config) != address(0) && address(_borrower) != address(0), "ZERO");

    config = IGoldfinchConfig(_config);
    address owner = config.protocolAdminAddress();
    __BaseUpgradeablePausable__init(owner);
    callableCreditLine.initialize(config, _interestApr, _schedule, _lateFeeApr, _limit);
    borrower = _borrower;
    // _createAndSetCreditLine(_borrower, _limit, _interestApr, _schedule, _lateFeeApr);
    createdAt = block.timestamp;
    if (_allowedUIDTypes.length == 0) {
      uint256[1] memory defaultAllowedUIDTypes = [config.getGo().ID_TYPE_0()];
      allowedUIDTypes = defaultAllowedUIDTypes;
    } else {
      allowedUIDTypes = _allowedUIDTypes;
    }

    _setupRole(LOCKER_ROLE, _borrower);
    _setupRole(LOCKER_ROLE, owner);
    _setRoleAdmin(LOCKER_ROLE, OWNER_ROLE);
  }

  function submitCall(uint256 amountToCall, uint256 poolTokenId) external override {
    require(
      config.getPoolTokens().isApprovedOrOwner(msg.sender, poolTokenId) &&
        hasAllowedUID(msg.sender),
      "NA"
    );
    // TODO: Actually submit call request
  }

  function setAllowedUIDTypes(uint256[] calldata ids) external onlyLocker {
    // TODO: Require that the principal deposited is empty
    // require(
    //   _poolSlices[0].juniorTranche.principalDeposited == 0 &&
    //     _poolSlices[0].seniorTranche.principalDeposited == 0,
    //   "has balance"
    // );
    allowedUIDTypes = ids;
  }

  function getAllowedUIDTypes() external view returns (uint256[] memory) {
    return allowedUIDTypes;
  }

  /// @notice Intentionable no-op. Included to be compatible with the v1 pool interface
  // solhint-disable-next-line no-empty-blocks
  function assess() external override whenNotPaused {}

  /// @inheritdoc ILoan
  /// @dev TL: tranche locked
  /// @dev IA: invalid amount
  /// @dev IT: invalid tranche
  /// @dev NA: not authorized. Must have correct UID or be go listed
  function deposit(
    uint256 tranche,
    uint256 amount
  ) public override nonReentrant whenNotPaused returns (uint256) {
    // Currently only valid to deposit into the uncalled capital tranche.
    require(tranche == 1, "IT");
    // TODO:
    // ITranchedPool.TrancheInfo storage trancheInfo = _getTrancheInfo(tranche);
    // require(trancheInfo.lockedUntil == 0, "TL");
    require(amount > 0, "IA");
    require(hasAllowedUID(msg.sender), "NA");
    require(block.timestamp >= fundableAt, "Not open");
    // TODO:
    // trancheInfo.principalDeposited = trancheInfo.principalDeposited.add(amount);
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
  ) public override whenNotPaused returns (uint256 tokenId) {
    IERC20PermitUpgradeable(config.usdcAddress()).permit(
      msg.sender,
      address(this),
      amount,
      deadline,
      v,
      r,
      s
    );
    return deposit(tranche, amount);
  }

  /// @inheritdoc ILoan
  function withdraw(
    uint256 tokenId,
    uint256 amount
  ) public override nonReentrant whenNotPaused returns (uint256, uint256) {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    // ITranchedPool.TrancheInfo storage trancheInfo = _getTrancheInfo(tokenInfo.tranche);

    //return _withdraw(trancheInfo, tokenInfo, tokenId, amount);
    return _withdraw(tokenInfo, tokenId, amount);
  }

  /// @inheritdoc ILoan
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

  /// @inheritdoc ILoan
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
    // TODO:
    // ITranchedPool.TrancheInfo storage trancheInfo = _getTrancheInfo(tokenInfo.tranche);

    // (uint256 interestRedeemable, uint256 principalRedeemable) = TranchingLogic
    //   .redeemableInterestAndPrincipal(trancheInfo, tokenInfo);

    // uint256 amount = interestRedeemable.add(principalRedeemable);

    // return _withdraw(trancheInfo, tokenInfo, tokenId, amount);
    return (0, 0);
  }

  /// @inheritdoc ILoan
  /// @dev DP: drawdowns paused
  /// @dev IF: insufficient funds
  function drawdown(uint256 amount) external override(ICreditLine, ILoan) onlyLocker whenNotPaused {
    require(!drawdownsPaused, "DP");
    if (!_locked()) {
      // Assumes investments have been made already (saves the borrower a separate transaction to lock the pool)
      _lockPool();
    }
    // TODO:
    // Drawdown only draws down from the current slice for simplicity. It's harder to account for how much
    // money is available from previous slices since depositors can redeem after unlock.
    // ITranchedPool.PoolSlice storage currentSlice = _poolSlices[numSlices - 1];
    // uint256 amountAvailable = TranchingLogic.sharePriceToUsdc(
    //   currentSlice.juniorTranche.principalSharePrice,
    //   currentSlice.juniorTranche.principalDeposited
    // );
    // amountAvailable = amountAvailable.add(
    //   TranchingLogic.sharePriceToUsdc(
    //     currentSlice.seniorTranche.principalSharePrice,
    //     currentSlice.seniorTranche.principalDeposited
    //   )
    // );
    // require(amount <= amountAvailable, "IF");

    // TODO: Do we need ot checkpoint or can we put drawdown on non-checkpointed version?
    callableCreditLine.checkpoint().drawdown(amount);

    // TODO:
    // Update the share price to reflect the amount remaining in the pool
    // uint256 amountRemaining = amountAvailable.sub(amount);
    // uint256 oldJuniorPrincipalSharePrice = currentSlice.juniorTranche.principalSharePrice;
    // uint256 oldSeniorPrincipalSharePrice = currentSlice.seniorTranche.principalSharePrice;
    // currentSlice.juniorTranche.principalSharePrice = currentSlice
    //   .juniorTranche
    //   .calculateExpectedSharePrice(amountRemaining, currentSlice);
    // currentSlice.seniorTranche.principalSharePrice = currentSlice
    //   .seniorTranche
    //   .calculateExpectedSharePrice(amountRemaining, currentSlice);
    // currentSlice.principalDeployed = currentSlice.principalDeployed.add(amount);
    // totalDeployed = totalDeployed.add(amount);
    // address borrower = borrower();

    // TODO: Store borrower

    config.getUSDC().safeERC20Transfer(borrower, amount);
    emit DrawdownMade(borrower, amount);
    // TODO:
    // emit SharePriceUpdated(
    //   address(this),
    //   currentSlice.juniorTranche.id,
    //   currentSlice.juniorTranche.principalSharePrice,
    //   int256(oldJuniorPrincipalSharePrice.sub(currentSlice.juniorTranche.principalSharePrice)) * -1,
    //   currentSlice.juniorTranche.interestSharePrice,
    //   0
    // );
    // emit SharePriceUpdated(
    //   address(this),
    //   currentSlice.seniorTranche.id,
    //   currentSlice.seniorTranche.principalSharePrice,
    //   int256(oldSeniorPrincipalSharePrice.sub(currentSlice.seniorTranche.principalSharePrice)) * -1,
    //   currentSlice.seniorTranche.interestSharePrice,
    //   0
    // );
  }

  /// @inheritdoc ITranchedPool
  function lockJuniorCapital() external override onlyLocker whenNotPaused {
    revert("TODO: Remove lockJuniorCapital once we migrate away from ITranchedPool");
  }

  /// @inheritdoc ILoan
  function lockPool() external override onlyLocker whenNotPaused {
    _lockPool();
  }

  /// @inheritdoc ILoan
  function setFundableAt(uint256 newFundableAt) external override onlyLocker {
    fundableAt = newFundableAt;
  }

  /// @inheritdoc ILoan
  /// @dev IT: invalid timestamp
  /// @dev LI: loan inactive
  function getAmountsOwed(
    uint256 timestamp
  )
    external
    view
    override
    returns (
      uint256 returnedInterestOwed,
      uint256 returnedInterestAccrued,
      uint256 returnedPrincipalOwed
    )
  {
    require(timestamp >= block.timestamp, "IT");
    require(termEndTime() > 0, "LI");

    return (interestOwedAt(timestamp), interestAccruedAt(timestamp), principalOwedAt(timestamp));
  }

  /// @inheritdoc ILoan
  /// @dev ZA: zero amount
  function pay(
    uint256 amount
  ) external override nonReentrant whenNotPaused returns (PaymentAllocation memory) {
    require(amount > 0, "ZA");
    // Send money to the credit line. Only take what's actually owed
    uint256 maxPayableAmount = interestAccrued() + interestOwed() + balance();
    uint256 amountToPay = MathUpgradeable.min(amount, maxPayableAmount);
    config.getUSDC().safeERC20TransferFrom(msg.sender, address(this), amountToPay);

    // pay interest first, then principal
    uint256 interestAmount = MathUpgradeable.min(amountToPay, interestOwed() + interestAccrued());
    uint256 principalAmount = amountToPay.saturatingSub(interestAmount);

    PaymentAllocation memory pa = _pay(principalAmount, interestAmount);

    // Payment remaining should always be 0 because we don't take excess usdc
    assert(pa.paymentRemaining == 0);
    return pa;
  }

  /// @inheritdoc ILoan
  /// @dev ZA: zero amount
  /// TODO: Turn back to external
  function pay(
    uint256 principalAmount,
    uint256 interestAmount
  )
    public
    override(ICreditLine, ILoan)
    nonReentrant
    whenNotPaused
    returns (PaymentAllocation memory)
  {
    uint256 totalPayment = principalAmount + interestAmount;
    require(totalPayment > 0, "ZA");

    // If there is an excess principal payment then only take what we actually need
    uint256 principalToPay = MathUpgradeable.min(principalAmount, balance());

    // If there is an excess interest payment then only take what we actually need
    uint256 maxPayableInterest = interestAccrued() + interestOwed();
    uint256 interestToPay = MathUpgradeable.min(interestAmount, maxPayableInterest);
    config.getUSDC().safeERC20TransferFrom(
      msg.sender,
      address(this),
      principalToPay + interestToPay
    );
    PaymentAllocation memory pa = _pay(principalToPay, interestToPay);

    // Payment remaining should always be 0 because we don't take excess usdc
    assert(pa.paymentRemaining == 0);
    return pa;
  }

  /// @notice Pauses the pool and sweeps any remaining funds to the treasury reserve.
  function emergencyShutdown() public onlyAdmin {
    if (!paused()) {
      pause();
    }

    IERC20UpgradeableWithDec usdc = config.getUSDC();
    address reserveAddress = config.reserveAddress();
    // Sweep any funds to community reserve
    uint256 poolBalance = usdc.balanceOf(address(this));
    if (poolBalance > 0) {
      config.getUSDC().safeERC20Transfer(reserveAddress, poolBalance);
    }

    uint256 clBalance = usdc.balanceOf(address(this));
    if (clBalance > 0) {
      usdc.safeERC20TransferFrom(address(this), reserveAddress, clBalance);
    }
    emit EmergencyShutdown(address(this));
  }

  function nextDueTimeAt(uint256 timestamp) public view returns (uint256) {
    PaymentSchedule storage ps = callableCreditLine.paymentSchedule();
    return ps.nextDueTimeAt(timestamp);
  }

  function paymentSchedule() public view returns (PaymentSchedule memory) {
    return callableCreditLine.paymentSchedule();
  }

  function schedule() public view override returns (ISchedule) {
    return callableCreditLine.schedule();
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

  // CreditLine proxy method + ICreditLine
  function setLimit(uint256 newAmount) external override onlyAdmin {
    revert("US");
    // callableCreditLine.setLimit(newAmount);
  }

  /// @inheritdoc ITranchedPool
  // TODO: Remove
  function getTranche(
    uint256 tranche
  ) public view override returns (ITranchedPool.TrancheInfo memory) {
    // return _getTrancheInfo(tranche);
    return ITranchedPool.TrancheInfo(0, 0, 0, 0, 0);
  }

  /// @inheritdoc ITranchedPool
  // TODO: Remove
  function poolSlices(
    uint256 index
  ) external view override returns (ITranchedPool.PoolSlice memory) {
    // return _poolSlices[index];
    return ITranchedPool.PoolSlice(getTranche(0), getTranche(0), 0, 0);
  }

  /// @inheritdoc ITranchedPool
  // TODO: Remove
  function totalJuniorDeposits() external view override returns (uint256) {
    // uint256 total;
    // for (uint256 i = 0; i < numSlices; i++) {
    //   total = total.add(_poolSlices[i].juniorTranche.principalDeposited);
    // }
    // return total;
    return 0;
  }

  /// @inheritdoc ILoan
  function availableToWithdraw(uint256 tokenId) public view override returns (uint256, uint256) {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    // TODO:
    // ITranchedPool.TrancheInfo storage trancheInfo = _getTrancheInfo(tokenInfo.tranche);

    // if (block.timestamp > trancheInfo.lockedUntil) {
    //   return TranchingLogic.redeemableInterestAndPrincipal(trancheInfo, tokenInfo);
    // } else {
    return (0, 0);
    // }
  }

  function hasAllowedUID(address sender) public view override returns (bool) {
    return config.getGo().goOnlyIdTypes(sender, allowedUIDTypes);
  }

  /* Internal functions  */

  /// @dev NL: not locked
  function _pay(
    uint256 principalPayment,
    uint256 interestPayment
  ) internal returns (PaymentAllocation memory) {
    // We need to make sure the pool is locked before we allocate rewards to ensure it's not
    // possible to game rewards by sandwiching an interest payment to an unlocked pool
    // It also causes issues trying to allocate payments to an empty slice (divide by zero)
    require(_locked(), "NL");

    uint256 interestAccrued = totalInterestAccruedAt(interestAccruedAsOf());
    PaymentAllocation memory pa = pay(principalPayment, interestPayment);
    interestAccrued = totalInterestAccrued() - interestAccrued;

    return pa;
  }

  function _collectInterestAndPrincipal(
    uint256 interest,
    uint256 principal
  ) internal returns (uint256) {
    // TODO: Remove
    // uint256 totalReserveAmount = TranchingLogic.applyToAllSlices(
    //   _poolSlices,
    //   numSlices,
    //   interest,
    //   principal,
    //   uint256(100).div(config.getReserveDenominator()), // Convert the denominator to percent
    //   totalDeployed,
    //   creditLine,
    //   0
    // );

    // TODO: This is Placeholder - remove
    uint256 totalReserveAmount = 0;

    config.getUSDC().safeERC20Transfer(config.reserveAddress(), totalReserveAmount);

    emit ReserveFundsCollected(address(this), totalReserveAmount);

    return totalReserveAmount;
  }

  // // Internal //////////////////////////////////////////////////////////////////

  /// @dev ZA: Zero amount
  /// @dev IA: Invalid amount - amount too large
  /// @dev TL: Tranched Locked
  function _withdraw(
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
    // TODO:
    // (uint256 interestRedeemable, uint256 principalRedeemable) = TranchingLogic
    //   .redeemableInterestAndPrincipal(trancheInfo, tokenInfo);
    // uint256 netRedeemable = interestRedeemable.add(principalRedeemable);

    // TODO START TEMPORARY
    uint256 netRedeemable = 0;
    // TODO END TEMPORARY

    require(amount <= netRedeemable, "IA");
    // TODO: require(block.timestamp > trancheInfo.lockedUntil, "TL");

    uint256 interestToRedeem = 0;
    uint256 principalToRedeem = 0;

    // If the tranche has not been locked, ensure the deposited amount is correct
    // TODO:
    // if (trancheInfo.lockedUntil == 0) {
    //   trancheInfo.principalDeposited = trancheInfo.principalDeposited.sub(amount);

    //   principalToRedeem = amount;

    //   config.getPoolTokens().withdrawPrincipal(tokenId, principalToRedeem);
    // } else {
    //   interestToRedeem = MathUpgradeable.min(interestRedeemable, amount);
    //   principalToRedeem = MathUpgradeable.min(principalRedeemable, amount.sub(interestToRedeem));

    //   config.getPoolTokens().redeem(tokenId, principalToRedeem, interestToRedeem);
    // }

    config.getUSDC().safeERC20Transfer(msg.sender, principalToRedeem + interestToRedeem);

    emit WithdrawalMade(
      msg.sender,
      tokenInfo.tranche,
      tokenId,
      interestToRedeem,
      principalToRedeem
    );

    return (interestToRedeem, principalToRedeem);
  }

  /// @dev NL: Not locked
  /// @dev TL: tranche locked. The senior pool has already been locked.
  function _lockPool() internal {
    require(!_locked(), "TL");
    // TODO:
    // ITranchedPool.PoolSlice storage slice = _poolSlices[numSlices.sub(1)];
    // uint256 currentTotal = slice.juniorTranche.principalDeposited.add(
    //   slice.seniorTranche.principalDeposited
    // );

    // TODO:
    // setLimit(
    //   MathUpgradeable.min(creditLine.limit().add(currentTotal), maxLimit())
    // );
    // We start the drawdown period, so backers can withdraw unused capital after borrower draws down
    // TODO:
    // TranchingLogic.lockTranche(slice.seniorTranche, config);
  }

  // If the senior tranche of the current slice is locked, then the pool is not open to any more deposits
  // (could throw off leverage ratio)
  function _locked() internal view returns (bool) {
    // TODO:
    // return numSlices == 0 || _poolSlices[numSlices - 1].seniorTranche.lockedUntil > 0;
    return false;
  }

  // TODO: Remove these conformances to ITranchedPool
  /// @notice Initialize the next slice for the pool. Enables backers and the senior pool to provide additional
  ///   capital to the borrower.
  /// @param _fundableAt time at which the new slice (now the current slice) becomes fundable
  function initializeNextSlice(uint256 _fundableAt) external override {}

  // TODO: Remove these conformances to ITranchedPool
  /// @notice Get the current number of slices for this pool
  /// @return numSlices total current slice count
  function numSlices() external view override returns (uint256) {
    return 0;
  }

  // // ICreditLine Conformance /////////////////////////////////////////////////////

  /**
   *
   */
  function creditLine() external view override returns (ICreditLine) {
    return this;
  }

  /**
   * Unsupported in callable loans.
   */
  function maxLimit() external view override returns (uint256) {
    revert("US");
  }

  /**
   * Unsupported in callable loans.
   */
  function setMaxLimit(uint256 newAmount) external override {
    revert("US");
  }

  // // ICreditLine Conformance TODO Should all be external/////////////////////////////////////////////////////
  function initialize(
    address _config,
    address owner,
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    ISchedule _schedule,
    uint256 _lateFeeApr
  ) external override initializer {
    revert("US");
  }

  function balance() public view returns (uint256) {
    return 0;
  }

  function interestOwed() public view returns (uint256) {
    return 0;
  }

  function principalOwed() public view override returns (uint256) {
    return 0;
  }

  function termEndTime() public view override returns (uint256) {
    return 0;
  }

  function nextDueTime() public view override returns (uint256) {
    return 0;
  }

  function interestAccruedAsOf() public view override returns (uint256) {
    return 0;
  }

  function lastFullPaymentTime() public view override returns (uint256) {
    return 0;
  }

  function currentLimit() public view override returns (uint256) {
    return 0;
  }

  function limit() public view override returns (uint256) {
    return 0;
  }

  function interestApr() public view override returns (uint256) {
    return 0;
  }

  function lateFeeApr() public view override returns (uint256) {
    return 0;
  }

  function isLate() public view returns (bool) {
    return false;
  }

  function withinPrincipalGracePeriod() public view returns (bool) {
    return false;
  }

  /// @notice Cumulative interest accrued up to now
  function totalInterestAccrued() public view override returns (uint256) {
    return 0;
  }

  /// @notice Cumulative interest accrued up to `timestamp`
  function totalInterestAccruedAt(uint256 timestamp) public view override returns (uint256) {
    return 0;
  }

  /// @notice Cumulative interest paid back up to now
  function totalInterestPaid() public view override returns (uint256) {
    return 0;
  }

  /// @notice Cumulative interest owed up to now
  function totalInterestOwed() public view override returns (uint256) {
    return 0;
  }

  /// @notice Cumulative interest owed up to `timestamp`
  function totalInterestOwedAt(uint256 timestamp) public view override returns (uint256) {
    return 0;
  }

  /// @notice Interest that would be owed at `timestamp`
  function interestOwedAt(uint256 timestamp) public view override returns (uint256) {
    return 0;
  }

  /// @notice Interest accrued in the current payment period up to now. Converted to
  ///   owed interest once we cross into the next payment period. Is 0 if the
  ///   current time is after loan maturity (all interest accrued immediately becomes
  ///   interest owed).
  function interestAccrued() public view override returns (uint256) {
    return 0;
  }

  /// @notice Interest accrued in the current payment period for `timestamp`. Coverted to
  ///   owed interest once we cross into the payment period after `timestamp`. Is 0
  ///   if `timestamp` is after loan maturity (all interest accrued immediately becomes
  ///   interest owed).
  function interestAccruedAt(uint256 timestamp) public view override returns (uint256) {
    return 0;
  }

  /// @notice Principal owed up to `timestamp`
  function principalOwedAt(uint256 timestamp) public view override returns (uint256) {
    return 0;
  }

  /// @notice Returns the total amount of principal thats been paid
  function totalPrincipalPaid() public view override returns (uint256) {
    return 0;
  }

  /// @notice Cumulative principal owed at timestamp
  function totalPrincipalOwedAt(uint256 timestamp) public view override returns (uint256) {
    return 0;
  }

  /// @notice Cumulative principal owed at current timestamp
  function totalPrincipalOwed() public view override returns (uint256) {
    return 0;
  }

  /// @notice Time of first drawdown
  function termStartTime() public view override returns (uint256) {
    return 0;
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
