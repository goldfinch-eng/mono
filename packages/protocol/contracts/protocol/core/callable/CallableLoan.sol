// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

// solhint-disable-next-line max-line-length
import {IERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";
// solhint-disable-next-line max-line-length
import {SafeERC20Upgradeable as SafeERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {ICallableLoan} from "../../../interfaces/ICallableLoan.sol";
import {ILoan} from "../../../interfaces/ILoan.sol";
import {IRequiresUID} from "../../../interfaces/IRequiresUID.sol";
import {IERC20UpgradeableWithDec} from "../../../interfaces/IERC20UpgradeableWithDec.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {IVersioned} from "../../../interfaces/IVersioned.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {IGoldfinchConfig} from "../../../interfaces/IGoldfinchConfig.sol";
import {CallableLoanConfigHelper} from "./CallableLoanConfigHelper.sol";
import {Waterfall, Tranche, WaterfallLogic, TrancheLogic} from "./structs/Waterfall.sol";
// solhint-disable-next-line max-line-length
import {CallableCreditLine, CallableCreditLineLogic, StaleCallableCreditLine, StaleCallableCreditLineLogic, WaterfallLogic, TrancheLogic} from "./structs/CallableCreditLine.sol";
import {BaseUpgradeablePausable} from "../BaseUpgradeablePausable08x.sol";
import {SaturatingSub} from "../../../library/SaturatingSub.sol";
import {PaymentSchedule, PaymentScheduleLogic} from "../schedule/PaymentSchedule.sol";
import {CallableLoanAccountant} from "./CallableLoanAccountant.sol";

/// @title The main contract to faciliate lending. Backers and the Senior Pool fund the loan
///   through this contract. The borrower draws down on and pays back a loan through this contract.
/// @author Warbler Labs
contract CallableLoan is
  BaseUpgradeablePausable,
  ICallableLoan,
  ICreditLine,
  IRequiresUID,
  IVersioned
{
  IGoldfinchConfig public config;

  using CallableLoanConfigHelper for IGoldfinchConfig;
  using SafeERC20 for IERC20UpgradeableWithDec;
  using SaturatingSub for uint256;

  bytes32 public constant LOCKER_ROLE = keccak256("LOCKER_ROLE");
  uint8 internal constant MAJOR_VERSION = 1;
  uint8 internal constant MINOR_VERSION = 0;
  uint8 internal constant PATCH_VERSION = 0;

  StaleCallableCreditLine private _staleCreditLine;

  uint256 public override createdAt;
  address public override borrower;
  bool public drawdownsPaused;
  uint256[] public allowedUIDTypes;
  uint256 public totalDeployed;
  uint256 public fundableAt;
  bool public locked;

  /*
   * Unsupported - only included for compatibility with ICreditLine.
   */
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

  function initialize(
    address _config,
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    ISchedule _schedule,
    uint256 _lateFeeApr,
    uint256 _fundableAt,
    uint256[] calldata _allowedUIDTypes
  ) public initializer {
    require(address(_config) != address(0) && address(_borrower) != address(0), "ZERO");

    config = IGoldfinchConfig(_config);
    address owner = config.protocolAdminAddress();
    __BaseUpgradeablePausable__init(owner);
    _staleCreditLine.initialize(config, _interestApr, _schedule, _lateFeeApr, _limit);
    borrower = _borrower;
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

  function submitCall(uint256 callAmount, uint256 poolTokenId) external override {
    CallableCreditLine storage cl = _staleCreditLine.checkpoint();
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolTokenId);
    require(
      poolTokens.isApprovedOrOwner(msg.sender, poolTokenId) &&
        hasAllowedUID(msg.sender) &&
        tokenInfo.tranche == cl.uncalledCapitalTrancheIndex(),
      "NA"
    );

    (uint256 interestWithdrawn, uint256 principalWithdrawn) = withdrawMax(poolTokenId);
    uint256 totalWithdrawn = interestWithdrawn + principalWithdrawn;
    uint256 principalRemaining = cl.proportionalPrincipalOutstanding({
      trancheId: tokenInfo.tranche,
      principalDeposited: tokenInfo.principalAmount
    });
    require(callAmount > 0 && principalRemaining >= callAmount, "IA");

    // TODO: Use real PoolToken splitting from main && move callRequestedTokenId to the other tranche.
    (uint256 callRequestedTokenId, uint256 remainingTokenId) = _splitForCall(
      callAmount,
      poolTokenId,
      cl.uncalledCapitalTrancheIndex(),
      cl.activeCallSubmissionTranche()
    );
    cl.submitCall(callAmount);
    if (totalWithdrawn > 0) {
      IERC20UpgradeableWithDec usdc = config.getUSDC();
      usdc.safeTransferFrom(address(this), msg.sender, totalWithdrawn);
    }
    emit CallRequestSubmitted(poolTokenId, callRequestedTokenId, remainingTokenId, callAmount);
  }

  function _splitForCall(
    uint256 callAmount,
    uint256 poolTokenId,
    uint256 uncalledCapitalTrancheIndex,
    uint256 activeCallSubmissionTranche
  ) private returns (uint256 specifiedTokenId, uint256 remainingTokenId) {
    IPoolTokens poolToken = config.getPoolTokens();
    address owner = poolToken.ownerOf(poolTokenId);
    IPoolTokens.TokenInfo memory tokenInfo = poolToken.getTokenInfo(poolTokenId);
    poolToken.burn(poolTokenId);
    specifiedTokenId = poolToken.mint(
      IPoolTokens.MintParams({principalAmount: callAmount, tranche: activeCallSubmissionTranche}),
      owner
    );
    remainingTokenId = poolToken.mint(
      IPoolTokens.MintParams({
        principalAmount: tokenInfo.principalAmount - callAmount,
        tranche: uncalledCapitalTrancheIndex
      }),
      owner
    );
  }

  /**
   * Set accepted UID types for the loan.
   * Requires that users have not already begun to deposit.
   */
  function setAllowedUIDTypes(uint256[] calldata ids) external onlyLocker {
    require(_staleCreditLine.checkpoint().totalPrincipalDeposited() == 0, "AF");
    allowedUIDTypes = ids;
  }

  function getAllowedUIDTypes() external view returns (uint256[] memory) {
    return allowedUIDTypes;
  }

  /// @inheritdoc ILoan
  /**
   * @dev DL: deposits locked
   * @dev IA: invalid amount - must be greater than 0.
   * @dev IT: invalid tranche - must be uncalled capital tranche
   * @dev NA: not authorized. Must have correct UID or be go listed
   * @notice Supply capital to the loan.
   * @param tranche *UNSUPPORTED* -
   * @param amount amount of capital to supply
   * @return tokenId NFT representing your position in this pool
   */
  function deposit(
    uint256 tranche,
    uint256 amount
  ) public override nonReentrant whenNotPaused returns (uint256) {
    CallableCreditLine storage cl = _staleCreditLine.checkpoint();
    require(!locked, "DL");
    require(amount > 0, "IA");
    require(tranche == cl.uncalledCapitalTrancheIndex(), "IT");
    require(hasAllowedUID(msg.sender), "NA");
    require(block.timestamp >= fundableAt, "Not open for funding");

    cl.deposit(amount);
    uint256 tokenId = config.getPoolTokens().mint(
      IPoolTokens.MintParams({tranche: tranche, principalAmount: amount}),
      msg.sender
    );
    config.getUSDC().safeTransferFrom(msg.sender, address(this), amount);

    emit DepositMade(msg.sender, tranche, tokenId, amount);
    return tokenId;
  }

  /// @inheritdoc ILoan
  /**
   * @dev DL: deposits locked
   * @dev IA: invalid amount - must be greater than 0.
   * @dev IT: invalid tranche - must be uncalled capital tranche
   * @dev NA: not authorized. Must have correct UID or be go listed
   * @notice Supply capital to the loan.
   * @param tranche *UNSUPPORTED* -
   * @param amount amount of capital to supply
   * @return tokenId NFT representing your position in this pool
   */
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
    public
    override
    nonReentrant
    whenNotPaused
    returns (uint256 interestWithdrawn, uint256 principalWithdrawn)
  {
    CallableCreditLine storage cl = _staleCreditLine.checkpoint();
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    (uint256 interestWithdrawable, uint256 principalWithdrawable) = cl
      .cumulativeAmountWithdrawable({
        trancheId: tokenInfo.tranche,
        principal: tokenInfo.principalAmount
      });
    uint256 amountWithdrawable = interestWithdrawable +
      principalWithdrawable -
      tokenInfo.principalRedeemed -
      tokenInfo.interestRedeemed;
    return _withdraw(tokenInfo, tokenId, amountWithdrawable);
  }

  /// @inheritdoc ILoan
  /// @dev DP: drawdowns paused
  /// @dev IF: insufficient funds
  function drawdown(uint256 amount) external override(ICreditLine, ILoan) onlyLocker whenNotPaused {
    // TODO: Do we need to checkpiont? Should be able to safely assume that the credit line is not stale.
    CallableCreditLine storage cl = _staleCreditLine.checkpoint();
    require(!drawdownsPaused, "DP");

    // TODO: Introduce proper condition for allowing drawdown.
    //       How about cannot drawdown any capital which has been paid back via pay? ()
    require(cl.totalPrincipalPaid() == 0);
    require(amount <= cl.totalPrincipalPaid(), "IF");

    // Assumes investments have been made already (saves the borrower a separate transaction to lock the pool)
    _lockDeposits();

    cl.drawdown(amount);

    config.getUSDC().safeTransferFrom(address(this), borrower, amount);
    emit DrawdownMade(borrower, amount);
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
    // TODO: Is this the proper condition for a loan being inactive?
    require(termEndTime() > 0, "LI");

    return (interestOwedAt(timestamp), interestAccruedAt(timestamp), principalOwedAt(timestamp));
  }

  /// @inheritdoc ILoan
  /// @dev ZA: zero amount
  function pay(
    uint256 amount
  ) external override nonReentrant whenNotPaused returns (PaymentAllocation memory) {
    return _pay(amount);
  }

  /// @inheritdoc ILoan
  /// @dev ZA: zero amount
  /// @dev IPP: Insufficient principal payment - Amount of principal paid violates payment waterfall
  /// @dev IIP: Insufficient interest payment - Amount of interest paid violates payment waterfall
  function pay(
    uint256 principalPayment,
    uint256 interestPayment
  )
    external
    override(ICreditLine, ILoan)
    nonReentrant
    whenNotPaused
    returns (PaymentAllocation memory)
  {
    ILoan.PaymentAllocation memory pa = _pay(principalPayment + interestPayment);
    require(principalPayment >= pa.principalPayment + pa.additionalBalancePayment, "OPP");
    require(interestPayment >= pa.owedInterestPayment + pa.accruedInterestPayment, "IP");
    return pa;
  }

  function nextDueTimeAt(uint256 timestamp) public view returns (uint256) {
    return _staleCreditLine.nextDueTimeAt(timestamp);
  }

  function nextInterestDueTimeAt(uint256 timestamp) public view returns (uint256) {
    return _staleCreditLine.nextInterestDueTimeAt(timestamp);
  }

  function schedule() public view override returns (ISchedule) {
    return _staleCreditLine.schedule();
  }

  function scheduleAndTermStartTime() public view returns (ISchedule, uint64) {
    return (_staleCreditLine.schedule(), _staleCreditLine.termStartTime());
  }

  // TODO: Unnecessary now?
  /// @notice Pauses all drawdowns (but not deposits/withdraws)
  function pauseDrawdowns() public onlyAdmin {
    drawdownsPaused = true;
    emit DrawdownsPaused(address(this));
  }

  // TODO: Unnecessary now?
  /// @notice Unpause drawdowns
  function unpauseDrawdowns() public onlyAdmin {
    drawdownsPaused = false;
    emit DrawdownsUnpaused(address(this));
  }

  /*
   * Unsupported ICreditLine method kept for ICreditLine conformance
   */
  function setLimit(uint256 newAmount) external override onlyAdmin {
    revert("US");
  }

  // No pass yet
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

  function _pay(uint256 amount) internal returns (ILoan.PaymentAllocation memory) {
    CallableCreditLine storage cl = _staleCreditLine.checkpoint();
    require(amount > 0, "ZA");
    require(locked, "NL");
    ILoan.PaymentAllocation memory pa = CallableLoanAccountant.allocatePayment(
      amount,
      cl.totalPrincipalOutstanding(),
      cl.interestOwed(),
      cl.interestAccrued(),
      cl.principalOwed()
    );
    uint256 totalInterestPayment = pa.owedInterestPayment + pa.accruedInterestPayment;
    uint256 totalPrincipalPayment = pa.principalPayment + pa.additionalBalancePayment;
    uint256 totalPayment = totalInterestPayment + totalPrincipalPayment;

    uint256 reserveFundsFeePercent = uint256(100) / (config.getReserveDenominator());
    uint256 reserveFundsFee = (reserveFundsFeePercent * totalInterestPayment) / 100;

    cl.pay(totalPrincipalPayment, totalInterestPayment);

    config.getUSDC().safeTransferFrom(msg.sender, address(this), totalPayment);
    config.getUSDC().safeTransferFrom(address(this), config.reserveAddress(), reserveFundsFee);
    emit ReserveFundsCollected(address(this), reserveFundsFee);
    return pa;
  }

  // // Internal //////////////////////////////////////////////////////////////////

  // No pass yet
  /// @dev ZA: Zero amount
  /// @dev IA: Invalid amount - amount too large
  /// @dev DL: Tranched Locked
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

    // TODO: Require amount is less than or equal to the amount that can be withdrawn
    // TODO: Need to include logic for determining redeemable amount on tokens.
    //       callableCreditLine.cumulativeAmountWithdrawable(trancheId, ...tokenInfo)
    // (uint256 interestRedeemable, uint256 principalRedeemable) = TranchingLogic
    //   .redeemableInterestAndPrincipal(trancheInfo, tokenInfo);
    // uint256 netRedeemable = interestRedeemable.add(principalRedeemable);

    // TODO START TEMPORARY
    uint256 netRedeemable = 0;
    // TODO END TEMPORARY

    require(amount <= netRedeemable, "IA");
    // TODO: require(!locked, "DL");

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

    config.getUSDC().safeTransferFrom(
      address(this),
      msg.sender,
      principalToRedeem + interestToRedeem
    );

    emit WithdrawalMade(
      msg.sender,
      tokenInfo.tranche,
      tokenId,
      interestToRedeem,
      principalToRedeem
    );

    return (interestToRedeem, principalToRedeem);
  }

  /// @dev DL: Deposits locked. Deposits have already been locked.
  function _lockDeposits() internal {
    require(!locked, "DL");
    locked = true;
    // TODO: Is this still necessary?
    // setLimit(
    //   MathUpgradeable.min(creditLine.limit().add(currentTotal), maxLimit())
    // );
    emit DepositsLocked(address(this));
  }

  // // ICreditLine Conformance /////////////////////////////////////////////////////

  /**
   * Pass 1
   */
  /// @inheritdoc ILoan
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

  /// @inheritdoc ICreditLine
  function balance() public view returns (uint256) {
    return _staleCreditLine.totalPrincipalOutstanding();
  }

  /// @inheritdoc ICreditLine
  function interestOwed() public view override returns (uint256) {
    return _staleCreditLine.interestOwed();
  }

  /// @inheritdoc ICreditLine
  function principalOwed() public view override returns (uint256) {
    return _staleCreditLine.principalOwed();
  }

  /// @inheritdoc ICreditLine
  function termEndTime() public view override returns (uint256) {
    return _staleCreditLine.termEndTime();
  }

  /// @inheritdoc ICreditLine
  function nextDueTime() public view override returns (uint256) {
    return _staleCreditLine.nextDueTime();
  }

  /// @inheritdoc ICreditLine
  function interestAccruedAsOf() public view override returns (uint256) {
    return _staleCreditLine.interestAccruedAsOf();
  }

  /// @inheritdoc ICreditLine
  function currentLimit() public view override returns (uint256) {
    return _staleCreditLine.limit();
  }

  /// @inheritdoc ICreditLine
  function limit() public view override returns (uint256) {
    return _staleCreditLine.limit();
  }

  /// @inheritdoc ICreditLine
  function interestApr() public view override returns (uint256) {
    return _staleCreditLine.interestApr();
  }

  /// @inheritdoc ICreditLine
  function lateFeeApr() public view override returns (uint256) {
    return _staleCreditLine.lateFeeApr();
  }

  function isLate() public view returns (bool) {
    return _staleCreditLine.isLate();
  }

  function withinPrincipalGracePeriod() public view returns (bool) {
    return false;
  }

  /// @inheritdoc ICreditLine
  function totalInterestAccrued() public view override returns (uint256) {
    return 0;
  }

  /// @inheritdoc ICreditLine
  function totalInterestAccruedAt(uint256 timestamp) public view override returns (uint256) {
    return 0;
  }

  /// @inheritdoc ICreditLine
  function totalInterestPaid() public view override returns (uint256) {
    return _staleCreditLine.totalInterestPaid();
  }

  /// @inheritdoc ICreditLine
  function totalInterestOwed() public view override returns (uint256) {
    _staleCreditLine.totalInterestOwed();
  }

  /// @inheritdoc ICreditLine
  function totalInterestOwedAt(uint256 timestamp) public view override returns (uint256) {
    _staleCreditLine.totalInterestOwedAt(timestamp);
  }

  /// @inheritdoc ICreditLine
  function interestOwedAt(uint256 timestamp) public view override returns (uint256) {
    return _staleCreditLine.interestOwedAt(timestamp);
  }

  /// @inheritdoc ICreditLine
  function interestAccrued() public view override returns (uint256) {
    return 0;
  }

  /// @notice Interest accrued in the current payment period for `timestamp`. Coverted to
  ///   owed interest once we cross into the payment period after `timestamp`. Is 0
  ///   if `timestamp` is after loan maturity (all interest accrued immediately becomes
  ///   interest owed).
  /// @inheritdoc ICreditLine
  function interestAccruedAt(uint256 timestamp) public view override returns (uint256) {
    return 0;
  }

  /// @inheritdoc ICreditLine
  function principalOwedAt(uint256 timestamp) public view override returns (uint256) {
    return _staleCreditLine.principalOwedAt(timestamp);
  }

  /// @inheritdoc ICreditLine
  function totalPrincipalPaid() public view override returns (uint256) {
    return _staleCreditLine.totalPrincipalPaid();
  }

  /// @inheritdoc ICreditLine
  function totalPrincipalOwedAt(uint256 timestamp) public view override returns (uint256) {
    _staleCreditLine.totalPrincipalOwedAt(timestamp);
  }

  /// @inheritdoc ICreditLine
  function totalPrincipalOwed() public view override returns (uint256) {
    _staleCreditLine.totalPrincipalOwed();
  }

  /// @inheritdoc ICreditLine
  function termStartTime() public view override returns (uint256) {
    return _staleCreditLine.termStartTime();
  }

  /// @inheritdoc ICreditLine
  function lastFullPaymentTime() public view override returns (uint256) {
    return _staleCreditLine.lastFullPaymentTime();
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
