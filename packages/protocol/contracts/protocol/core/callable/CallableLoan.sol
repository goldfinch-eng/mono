// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

// solhint-disable-next-line max-line-length
import {IERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";
// solhint-disable-next-line max-line-length
import {SafeERC20Upgradeable as SafeERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {ICallableLoan} from "../../../interfaces/ICallableLoan.sol";
import {ILoan} from "../../../interfaces/ILoan.sol";
import {IRequiresUID} from "../../../interfaces/IRequiresUID.sol";
import {IERC20UpgradeableWithDec} from "../../../interfaces/IERC20UpgradeableWithDec.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {IVersioned} from "../../../interfaces/IVersioned.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {IGoldfinchConfig} from "../../../interfaces/IGoldfinchConfig.sol";

import {BaseUpgradeablePausable} from "../BaseUpgradeablePausable08x.sol";

import {CallableLoanConfigHelper} from "./CallableLoanConfigHelper.sol";
import {Waterfall} from "./structs/Waterfall.sol";
// solhint-disable-next-line max-line-length
import {CallableCreditLine, CallableCreditLineLogic, SettledTrancheInfo, LoanState} from "./structs/CallableCreditLine.sol";
import {StaleCallableCreditLine, StaleCallableCreditLineLogic} from "./structs/StaleCallableCreditLine.sol";
import {SaturatingSub} from "../../../library/SaturatingSub.sol";
import {PaymentSchedule, PaymentScheduleLogic} from "../schedule/PaymentSchedule.sol";
import {CallableLoanAccountant} from "./CallableLoanAccountant.sol";

import {console2 as console} from "forge-std/console2.sol";

/// @title CallableLoan
/// @notice A loan that allows the lenders to call back capital from the borrower.
/// @author Warbler Labs
contract CallableLoan is
  BaseUpgradeablePausable,
  ICallableLoan,
  ICreditLine,
  IRequiresUID,
  IVersioned
{
  using CallableLoanConfigHelper for IGoldfinchConfig;
  using SafeERC20 for IERC20UpgradeableWithDec;
  using SaturatingSub for uint256;

  /*================================================================================
  Constants
  ================================================================================*/
  bytes32 public constant LOCKER_ROLE = keccak256("LOCKER_ROLE");
  uint8 internal constant MAJOR_VERSION = 1;
  uint8 internal constant MINOR_VERSION = 0;
  uint8 internal constant PATCH_VERSION = 0;

  /*================================================================================
  Storage State
  ================================================================================*/
  StaleCallableCreditLine private _staleCreditLine;
  uint256 public fundableAt;
  bool public drawdownsPaused;
  uint256[] public allowedUIDTypes;

  /*================================================================================
  Storage Static Configuration
  ================================================================================*/
  IGoldfinchConfig public config;
  uint256 public override createdAt;
  address public override borrower;

  /*================================================================================
  Initialization
  ================================================================================*/
  /// Unsupported - only included for compatibility with ICreditLine.
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
    uint256 _numLockupPeriods,
    ISchedule _schedule,
    uint256 _lateFeeApr,
    uint256 _fundableAt,
    uint256[] calldata _allowedUIDTypes
  ) external initializer {
    // NOTE: This check can be replaced with an after deploy verification rather than
    //       a require statement which increases bytecode size.
    // require(address(_config) != address(0) && address(_borrower) != address(0), "00");

    config = IGoldfinchConfig(_config);
    address owner = config.protocolAdminAddress();
    __BaseUpgradeablePausable__init(owner);
    _staleCreditLine.initialize(
      config,
      _interestApr,
      _numLockupPeriods,
      _schedule,
      _lateFeeApr,
      _limit
    );
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

  /*================================================================================
  Main Public/External Write functions
  ================================================================================*/
  /// @inheritdoc ICallableLoan
  /// @dev IA: Invalid amount - Call amount must be non-zero amount < than principal remaining.
  /// @dev IT: invalid tranche - must be uncalled capital tranche
  /// @dev NA: not authorized. Must have correct UID or be go listed
  /// @notice Supply capital to the loan.
  /// @param callAmount Amount of capital to call back
  /// @param poolTokenId Pool token id to be called back.
  function submitCall(
    uint256 callAmount,
    uint256 poolTokenId
  )
    external
    override
    nonReentrant
    whenNotPaused
    returns (uint256 callRequestedTokenId, uint256 remainingTokenId)
  {
    CallableCreditLine storage cl = _staleCreditLine.checkpoint();
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolTokenId);
    require(
      poolTokens.isApprovedOrOwner(msg.sender, poolTokenId) &&
        hasAllowedUID(msg.sender) &&
        tokenInfo.tranche == cl.uncalledCapitalTrancheIndex(),
      "NA"
    );

    // Pseudo-withdraw max while also caching the total amount of interest and principal withdrawable.
    // Total interest & principal withdrawable are useful for calculating how much will be redeemed on
    // the newly split pool tokens.
    (uint totalInterestWithdrawable, uint totalPrincipalWithdrawable) = cl
      .proportionalInterestAndPrincipalAvailable({
        trancheId: tokenInfo.tranche,
        principal: tokenInfo.principalAmount,
        feePercent: _reserveFundsFeePercent()
      });

    {
      uint netWithdrawableAmount = totalPrincipalWithdrawable -
        tokenInfo.principalRedeemed +
        totalInterestWithdrawable -
        tokenInfo.interestRedeemed;
      if (netWithdrawableAmount > 0) {
        _withdraw(tokenInfo, poolTokenId, netWithdrawableAmount);
      }
    }

    {
      uint256 callablePrincipal = cl.proportionalCallablePrincipal({
        trancheId: tokenInfo.tranche,
        principalDeposited: tokenInfo.principalAmount
      });
      // console.log("Submitting call request:", poolTokenId);
      // console.log("poolTokenId:", poolTokenId);
      // console.log("callAmount", callAmount);
      // console.log("callablePrincipal", callablePrincipal);
      require(callAmount > 0 && callablePrincipal >= callAmount, "IA");
    }

    (uint principalDepositedMoved, uint principalPaidMoved, , uint interestMoved) = cl.submitCall(
      callAmount
    );

    {
      address owner = poolTokens.ownerOf(poolTokenId);
      callRequestedTokenId = poolTokens.mint(
        IPoolTokens.MintParams({
          principalAmount: principalDepositedMoved,
          tranche: cl.activeCallSubmissionTrancheIndex()
        }),
        owner
      );

      poolTokens.redeem(callRequestedTokenId, principalPaidMoved, interestMoved);

      // TODO: Determine "dust" threshold at which we should just not mint a remaining token.
      if (tokenInfo.principalAmount - principalDepositedMoved > 0) {
        remainingTokenId = poolTokens.mint(
          IPoolTokens.MintParams({
            principalAmount: tokenInfo.principalAmount - principalDepositedMoved,
            tranche: cl.uncalledCapitalTrancheIndex()
          }),
          owner
        );
        console.log("totalPrincipalWithdrawable", totalPrincipalWithdrawable);
        console.log("totalInterestWithdrawable", totalInterestWithdrawable);
        console.log("principalPaidMoved", principalPaidMoved);
        console.log("interestMoved", interestMoved);
        // TODO: Remove scaffolding
        //       Due to integer math, redeemeded amounts can be one more than redeemable amounts after splitting.
        //       This scaffolding is to verify the error is only ever off by 1.
        // require(
        //   principalPaidMoved <= totalPrincipalWithdrawable + 1,
        //   "Principal withdrawable is less than principal move"
        // );
        // require(
        //   interestMoved <= totalInterestWithdrawable + 1,
        //   "Interest withdrawable is less than interest moved"
        // );
        poolTokens.redeem(
          remainingTokenId,
          totalPrincipalWithdrawable.saturatingSub(principalPaidMoved),
          totalInterestWithdrawable.saturatingSub(interestMoved)
        );
      } else {
        remainingTokenId = 0;
      }
    }

    poolTokens.redeem(poolTokenId, tokenInfo.principalAmount - totalPrincipalWithdrawable, 0);
    poolTokens.burn(poolTokenId);

    emit CallRequestSubmitted(poolTokenId, callRequestedTokenId, remainingTokenId, callAmount);
  }

  /// @inheritdoc ILoan
  /// @notice Supply capital to the loan.
  /// @param tranche *UNSUPPORTED* - Should always be uncalled capital tranche index.
  /// @param amount amount of capital to supply
  /// @return tokenId NFT representing your position in this pool
  function deposit(
    uint256 tranche,
    uint256 amount
  ) external override nonReentrant whenNotPaused returns (uint256) {
    return _deposit(tranche, amount);
  }

  /// @inheritdoc ILoan
  /// @notice Supply capital to the loan.
  /// @param tranche *UNSUPPORTED* -
  /// @param amount amount of capital to supply
  /// @param deadline deadline of permit operation
  /// @param v v portion of signature
  /// @param r r portion of signature
  /// @param s s portion of signature
  /// @return tokenId NFT representing your position in this pool
  function depositWithPermit(
    uint256 tranche,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external override nonReentrant whenNotPaused returns (uint256 tokenId) {
    IERC20PermitUpgradeable(config.usdcAddress()).permit(
      msg.sender,
      address(this),
      amount,
      deadline,
      v,
      r,
      s
    );
    return _deposit(tranche, amount);
  }

  /// @inheritdoc ILoan
  function withdraw(
    uint256 tokenId,
    uint256 amount
  ) external override nonReentrant whenNotPaused returns (uint256, uint256) {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    return _withdraw(tokenInfo, tokenId, amount);
  }

  /// @inheritdoc ILoan
  /// @dev LEN: argument length mismatch
  function withdrawMultiple(
    uint256[] calldata tokenIds,
    uint256[] calldata amounts
  ) external override nonReentrant whenNotPaused {
    require(tokenIds.length == amounts.length, "LN");

    for (uint256 i = 0; i < amounts.length; i++) {
      IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenIds[i]);
      _withdraw(tokenInfo, tokenIds[i], amounts[i]);
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
    return _withdrawMax(tokenId);
  }

  /// @inheritdoc ILoan
  /// @dev DP: drawdowns paused
  /// @dev ZA: Zero amount - must be greater than 0
  function drawdown(
    uint256 amount
  ) external override(ICreditLine, ILoan) nonReentrant onlyLocker whenNotPaused {
    require(!drawdownsPaused, "DP");
    require(amount > 0, "ZA");
    CallableCreditLine storage cl = _staleCreditLine.checkpoint();

    cl.drawdown(amount);

    config.getUSDC().safeTransfer(borrower, amount);
    emit DrawdownMade(borrower, amount);
  }

  /// @inheritdoc ILoan
  /// @dev ZA: zero amount
  function pay(
    uint256 amount
  )
    external
    override(ICreditLine, ILoan)
    nonReentrant
    whenNotPaused
    returns (PaymentAllocation memory)
  {
    return _pay(amount);
  }

  /// @notice Pauses all drawdowns (but not deposits/withdraws)
  function pauseDrawdowns() external onlyAdmin {
    drawdownsPaused = true;
    emit DrawdownsPaused(address(this));
  }

  /// @notice Unpause drawdowns
  function unpauseDrawdowns() external onlyAdmin {
    drawdownsPaused = false;
    emit DrawdownsUnpaused(address(this));
  }

  /// Set accepted UID types for the loan.
  /// Requires that users have not already begun to deposit.
  function setAllowedUIDTypes(uint256[] calldata ids) external onlyLocker {
    require(_staleCreditLine.checkpoint().totalPrincipalDeposited() == 0, "AF");
    allowedUIDTypes = ids;
  }

  /// @inheritdoc ILoan
  function setFundableAt(uint256 newFundableAt) external override onlyLocker {
    fundableAt = newFundableAt;
  }

  /*================================================================================
  Main Public/External View functions
  ================================================================================*/
  function getAllowedUIDTypes() external view override returns (uint256[] memory) {
    return allowedUIDTypes;
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
    // TODO: Verify this is the correct loan inactive condition.
    require(termEndTime() > 0, "LI");

    return (interestOwedAt(timestamp), interestAccruedAt(timestamp), principalOwedAt(timestamp));
  }

  function uncalledCapitalTrancheIndex() public view returns (uint256) {
    return _staleCreditLine.uncalledCapitalTrancheIndex();
  }

  function getUncalledCapitalInfo() external view returns (UncalledCapitalInfo memory) {
    SettledTrancheInfo memory info = _staleCreditLine.getSettledTrancheInfo(
      uncalledCapitalTrancheIndex()
    );
    return
      UncalledCapitalInfo({
        interestPaid: info.interestPaid,
        principalDeposited: info.principalDeposited,
        principalPaid: info.principalPaid,
        principalReserved: info.principalReserved
      });
  }

  function getCallRequestPeriod(
    uint callRequestPeriodIndex
  ) external view returns (CallRequestPeriod memory) {
    require(callRequestPeriodIndex < uncalledCapitalTrancheIndex());
    SettledTrancheInfo memory info = _staleCreditLine.getSettledTrancheInfo(callRequestPeriodIndex);
    return
      CallRequestPeriod({
        interestPaid: info.interestPaid,
        principalDeposited: info.principalDeposited,
        principalPaid: info.principalPaid,
        principalReserved: info.principalReserved
      });
  }

  function interestBearingBalance() public view returns (uint256) {
    return _staleCreditLine.totalPrincipalOutstandingWithoutReserves();
  }

  /// @dev OU: Only the uncalled tranche can call
  function availableToCall(uint256 tokenId) public view returns (uint256) {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    require(tokenInfo.tranche == uncalledCapitalTrancheIndex(), "OU");
    return
      _staleCreditLine.proportionalCallablePrincipal({
        trancheId: tokenInfo.tranche,
        principalDeposited: tokenInfo.principalAmount
      });
  }

  /// @inheritdoc ILoan
  function availableToWithdraw(uint256 tokenId) public view override returns (uint256, uint256) {
    return _availableToWithdraw(config.getPoolTokens().getTokenInfo(tokenId));
  }

  function hasAllowedUID(address sender) public view override returns (bool) {
    return config.getGo().goOnlyIdTypes(sender, allowedUIDTypes);
  }

  /*================================================================================
  Internal Write functions
  ================================================================================*/
  function _pay(uint256 amount) internal returns (ILoan.PaymentAllocation memory) {
    CallableCreditLine storage cl = _staleCreditLine.checkpoint();
    require(amount > 0, "ZA");

    uint interestOwedBeforePayment = cl.interestOwed();
    uint interestAccruedBeforePayment = cl.interestAccrued();

    uint timeUntilNextPrincipalSettlemenet = cl
      .nextPrincipalDueTimeAt(block.timestamp)
      .saturatingSub(block.timestamp);
    ILoan.PaymentAllocation memory pa = CallableLoanAccountant.allocatePayment({
      paymentAmount: amount,
      interestOwed: interestOwedBeforePayment,
      interestAccrued: interestAccruedBeforePayment,
      principalOwed: cl.principalOwed(),
      interestRate: cl.interestApr(),
      timeUntilNextPrincipalSettlemenet: timeUntilNextPrincipalSettlemenet,
      balance: cl.totalPrincipalOutstanding()
    });

    uint256 totalInterestPayment = pa.owedInterestPayment + pa.accruedInterestPayment;
    uint256 totalPrincipalPayment = pa.principalPayment + pa.additionalBalancePayment;
    uint256 totalPayment = totalInterestPayment + totalPrincipalPayment;

    uint256 reserveFundsFee = (_reserveFundsFeePercent() * totalInterestPayment) / 100;

    cl.pay(totalPrincipalPayment, totalInterestPayment);
    emit PaymentApplied({
      payer: msg.sender,
      pool: address(this),
      interest: totalInterestPayment,
      principal: totalPrincipalPayment,
      remaining: 0,
      reserve: reserveFundsFee
    });

    config.getUSDC().safeTransferFrom(msg.sender, address(this), totalPayment);
    config.getUSDC().safeTransfer(config.reserveAddress(), reserveFundsFee);
    emit ReserveFundsCollected(address(this), reserveFundsFee);
    return pa;
  }

  /// @dev ZA: zero amount - must be greater than 0.
  /// @dev IT: invalid tranche - must be uncalled capital tranche
  /// @dev NA: not authorized. Must have correct UID or be go listed
  /// @notice Supply capital to the loan.
  /// @param tranche *UNSUPPORTED* - Should always be uncalled capital tranche index.
  /// @param amount amount of capital to supply
  /// @return tokenId NFT representing your position in this pool
  function _deposit(uint256 tranche, uint256 amount) internal returns (uint256) {
    CallableCreditLine storage cl = _staleCreditLine.checkpoint();
    require(amount > 0, "ZA");
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

  /// @dev ZA: Zero amount
  /// @dev IA: Invalid amount - amount too large
  /// @dev DL: Deposits Locked
  function _withdraw(
    IPoolTokens.TokenInfo memory tokenInfo,
    uint256 tokenId,
    uint256 amount
  ) internal returns (uint256, uint256) {
    require(amount > 0, "ZA");
    IPoolTokens poolTokens = config.getPoolTokens();
    /// @dev NA: not authorized
    require(poolTokens.isApprovedOrOwner(msg.sender, tokenId) && hasAllowedUID(msg.sender), "NA");

    CallableCreditLine storage cl = _staleCreditLine.checkpoint();
    // calculate the amount that will ever be redeemable
    (uint interestWithdrawable, uint principalWithdrawable) = _availableToWithdraw(tokenInfo);

    require(amount <= interestWithdrawable + principalWithdrawable, "IA");

    // prefer to withdraw interest first, then principal
    uint interestToRedeem = Math.min(interestWithdrawable, amount);
    uint amountAfterInterest = amount - interestToRedeem;
    uint principalToRedeem = Math.min(amountAfterInterest, principalWithdrawable);

    {
      if (cl.loanState() == LoanState.InProgress) {
        poolTokens.redeem({
          tokenId: tokenId,
          principalRedeemed: principalToRedeem,
          interestRedeemed: interestToRedeem
        });
      } else if (cl.loanState() == LoanState.FundingPeriod) {
        // if the pool is still funding, we need to decrease the deposit rather than the amount redeemed
        assert(interestToRedeem == 0);
        cl.withdraw(tokenInfo.tranche, principalToRedeem);
        poolTokens.withdrawPrincipal({tokenId: tokenId, principalAmount: principalToRedeem});
      } else if (cl.loanState() == LoanState.DrawdownPeriod) {
        // Could currently just use a else statement, but this is more explicit and future-proof.
        revert("IS");
      }
    }

    config.getUSDC().safeTransfer(msg.sender, interestToRedeem + principalToRedeem);

    emit WithdrawalMade({
      owner: msg.sender,
      tranche: tokenInfo.tranche,
      tokenId: tokenId,
      interestWithdrawn: interestToRedeem,
      principalWithdrawn: principalToRedeem
    });

    return (interestToRedeem, principalToRedeem);
  }

  function _withdrawMax(uint256 tokenId) internal returns (uint256, uint256) {
    /* CallableCreditLine storage cl = */ _staleCreditLine.checkpoint();
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    (uint256 interestWithdrawable, uint256 principalWithdrawable) = _availableToWithdraw(tokenInfo);
    uint totalWithdrawable = interestWithdrawable + principalWithdrawable;
    if (totalWithdrawable == 0) {
      return (0, 0);
    }
    return _withdraw(tokenInfo, tokenId, totalWithdrawable);
  }

  /*================================================================================
  PaymentSchedule proxy functions
  ================================================================================*/
  function nextPrincipalDueTime() public view returns (uint) {
    return _staleCreditLine.nextPrincipalDueTime();
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

  /*================================================================================
  Internal View functions
  ================================================================================*/
  function _reserveFundsFeePercent() public view returns (uint256) {
    return uint256(100) / (config.getReserveDenominator());
  }

  function _availableToWithdraw(
    IPoolTokens.TokenInfo memory tokenInfo
  ) internal view returns (uint interestAvailable, uint principalAvailable) {
    if (tokenInfo.principalAmount == 0) {
      // Bail out early to account for proportion of zero.
      return (0, 0);
    }

    (uint totalInterestWithdrawable, uint totalPrincipalWithdrawable) = _staleCreditLine
      .proportionalInterestAndPrincipalAvailable({
        trancheId: tokenInfo.tranche,
        principal: tokenInfo.principalAmount,
        feePercent: _reserveFundsFeePercent()
      });

    // TODO: Remove scaffolding
    //       Due to integer math, redeemeded amounts can be one more than redeemable amounts after splitting.
    //       This scaffolding is to verify the error is only ever off by 1.
    // require(
    //   tokenInfo.principalRedeemed <= totalPrincipalWithdrawable + 1,
    //   "Principal withdrawable is less than principal redeemed"
    // );
    // require(
    //   tokenInfo.interestRedeemed <= totalInterestWithdrawable + 1,
    //   "Interest withdrawable is less than interest redeemed"
    // );
    return (
      totalInterestWithdrawable - tokenInfo.interestRedeemed,
      totalPrincipalWithdrawable.saturatingSub(tokenInfo.principalRedeemed)
    );
  }

  /*================================================================================
  Legacy ICreditLine Conformance
  ================================================================================*/
  /// @inheritdoc ILoan
  function creditLine() external view override returns (ICreditLine) {
    return this;
  }

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

  /// @notice We keep this to conform to the ICreditLine interface, but it's redundant information
  ///   now that we have `checkpointedAsOf`
  function interestAccruedAsOf() public view override returns (uint256) {
    return _staleCreditLine.checkpointedAsOf();
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

  /// @inheritdoc ICreditLine
  function isLate() public view override returns (bool) {
    return _staleCreditLine.isLate();
  }

  /// @inheritdoc ICreditLine
  function totalInterestAccrued() public view override returns (uint256) {
    return _staleCreditLine.totalInterestAccrued();
  }

  /// @inheritdoc ICreditLine
  function totalInterestAccruedAt(uint256 timestamp) public view override returns (uint256) {
    return _staleCreditLine.totalInterestAccruedAt(timestamp);
  }

  /// @inheritdoc ICreditLine
  function totalInterestPaid() public view override returns (uint256) {
    return _staleCreditLine.totalInterestPaid();
  }

  /// @inheritdoc ICreditLine
  function totalInterestOwed() public view override returns (uint256) {
    return _staleCreditLine.totalInterestOwed();
  }

  /// @inheritdoc ICreditLine
  function totalInterestOwedAt(uint256 timestamp) public view override returns (uint256) {
    return _staleCreditLine.totalInterestOwedAt(timestamp);
  }

  /// @inheritdoc ICreditLine
  function interestOwedAt(uint256 timestamp) public view override returns (uint256) {
    return _staleCreditLine.interestOwedAt(timestamp);
  }

  /// @inheritdoc ICreditLine
  function interestAccrued() public view override returns (uint256) {
    return _staleCreditLine.interestAccrued();
  }

  /// @inheritdoc ICreditLine
  function interestAccruedAt(uint256 timestamp) public view override returns (uint256) {
    return _staleCreditLine.interestAccruedAt(timestamp);
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
    return _staleCreditLine.totalPrincipalOwedAt(timestamp);
  }

  /// @inheritdoc ICreditLine
  function totalPrincipalOwed() public view override returns (uint256) {
    return _staleCreditLine.totalPrincipalOwed();
  }

  /// @inheritdoc ICreditLine
  function termStartTime() public view override returns (uint256) {
    return _staleCreditLine.termStartTime();
  }

  /// @inheritdoc ICreditLine
  function withinPrincipalGracePeriod() public view override returns (bool) {
    return _staleCreditLine.withinPrincipalGracePeriod();
  }

  /// @inheritdoc ICreditLine
  function lastFullPaymentTime() public view override returns (uint256) {
    return _staleCreditLine.lastFullPaymentTime();
  }

  /// Unsupported in callable loans.
  function pay(
    uint256 principalPayment,
    uint256 interestPayment
  ) external override(ICreditLine) nonReentrant whenNotPaused returns (PaymentAllocation memory) {
    revert("US");
  }

  /// Unsupported in callable loans.
  function maxLimit() external view override returns (uint256) {
    revert("US");
  }

  /// Unsupported in callable loans.
  function setMaxLimit(uint256 newAmount) external override onlyAdmin {
    revert("US");
  }

  /// Unsupported ICreditLine method kept for ICreditLine conformance
  function setLimit(uint256 newAmount) external override onlyAdmin {
    revert("US");
  }

  /*================================================================================
  Modifiers
  ================================================================================*/
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
