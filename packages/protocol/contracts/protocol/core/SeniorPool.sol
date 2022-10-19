// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import {SafeERC20} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/drafts/IERC20Permit.sol";
import {IERC20} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

import {ISeniorPool} from "../../interfaces/ISeniorPool.sol";
import {IFidu} from "../../interfaces/IFidu.sol";
import {ISeniorPoolEpochWithdrawals} from "../../interfaces/ISeniorPoolEpochWithdrawals.sol";
import {IWithdrawalRequestToken} from "../../interfaces/IWithdrawalRequestToken.sol";
import {ISeniorPoolStrategy} from "../../interfaces/ISeniorPoolStrategy.sol";
import {ITranchedPool} from "../../interfaces/ITranchedPool.sol";
import {ICUSDCContract} from "../../interfaces/ICUSDCContract.sol";
import {IERC20withDec} from "../../interfaces/IERC20withDec.sol";
import {IPoolTokens} from "../../interfaces/IPoolTokens.sol";
import {Accountant} from "./Accountant.sol";
import {BaseUpgradeablePausable} from "./BaseUpgradeablePausable.sol";
import {ConfigHelper} from "./ConfigHelper.sol";
import {GoldfinchConfig} from "./GoldfinchConfig.sol";

/**
 * @title Goldfinch's SeniorPool contract
 * @notice Main entry point for senior LPs (a.k.a. capital providers)
 *  Automatically invests across borrower pools using an adjustable strategy.
 * @author Goldfinch
 */
contract SeniorPool is BaseUpgradeablePausable, ISeniorPool {
  using Math for uint256;
  using ConfigHelper for GoldfinchConfig;
  using SafeMath for uint256;
  using SafeERC20 for IFidu;
  using SafeERC20 for IERC20withDec;

  uint256 internal constant USDC_MANTISSA = 1e6;
  uint256 internal constant FIDU_MANTISSA = 1e18;
  bytes32 public constant ZAPPER_ROLE = keccak256("ZAPPER_ROLE");

  /*================================================================================
    Storage
    ================================================================================*/

  GoldfinchConfig public config;

  /// @dev DEPRECATED!
  uint256 internal DEPRECATED_compoundBalance;

  /// @dev DEPRECATED, DO NOT USE.
  mapping(ITranchedPool => uint256) internal DEPRECATED_writedowns;

  /// @dev Writedowns by PoolToken id. This is used to ensure writedowns are incremental.
  ///   Example: At t1, a pool is late and should be written down by 10%. At t2, the pool
  ///   is even later, and should be written down by 25%. This variable helps ensure that
  ///   if writedowns occur at both t1 and t2, t2's writedown is only by the delta of 15%,
  ///   rather than double-counting the writedown percent from t1.
  mapping(uint256 => uint256) public writedownsByPoolToken;

  uint256 internal _checkpointedEpochId;
  mapping(uint256 => Epoch) internal _epochs;
  mapping(uint256 => WithdrawalRequest) internal _withdrawalRequests;
  uint256 public override usdcAvailable;
  uint256 internal _epochDuration;

  /*================================================================================
    Initialization Functions
    ================================================================================*/

  /*================================================================================
    Initialization Functions
    ================================================================================*/

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    require(owner != address(0) && address(_config) != address(0), "Owner and config addresses cannot be empty");

    __BaseUpgradeablePausable__init(owner);
    _setRoleAdmin(ZAPPER_ROLE, OWNER_ROLE);

    config = _config;
    sharePrice = FIDU_MANTISSA;
    totalLoansOutstanding = 0;
    totalWritedowns = 0;

    IERC20withDec usdc = config.getUSDC();
    // Sanity check the address
    usdc.totalSupply();

    bool success = usdc.approve(address(this), uint256(-1));
    require(success, "Failed to approve USDC");
  }

  /*================================================================================
  Admin Functions
  ================================================================================*/
  function setEpochDuration(uint256 newEpochDuration) public override onlyAdmin {
    _checkpointEpochs();
    _epochDuration = newEpochDuration;
    emit EpochDurationChanged(newEpochDuration);
  }

  function initializeEpochs() external onlyAdmin {
    require(_epochs[0].endsAt == 0);
    _epochDuration = 2 weeks;
    usdcAvailable = config.getUSDC().balanceOf(address(this));
    _epochs[0].endsAt = block.timestamp;
    _initializeNextEpoch();
  }

  /*================================================================================
    LP functions
    ================================================================================*/

  // External Functions
  //--------------------------------------------------------------------------------

  /**
   * @notice Deposits `amount` USDC from msg.sender into the SeniorPool, and grants you the
   *  equivalent value of FIDU tokens
   * @param amount The amount of USDC to deposit
   */
  function deposit(uint256 amount) public override whenNotPaused nonReentrant returns (uint256 depositShares) {
    require(config.getGo().goSeniorPool(msg.sender), "NA");
    require(amount > 0, "Must deposit more than zero");
    _checkpointEpochs();
    usdcAvailable += amount;
    // Check if the amount of new shares to be added is within limits
    depositShares = getNumShares(amount);
    emit DepositMade(msg.sender, amount, depositShares);
    require(config.getUSDC().transferFrom(msg.sender, address(this), amount), "Failed to transfer for deposit");

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

  function addToWithdrawalRequest(uint256 fiduAmount, uint256 tokenId) external override whenNotPaused nonReentrant {
    require(config.getGo().goSeniorPool(msg.sender), "NA");
    Epoch storage thisEpoch = _checkpointEpochs();

    IWithdrawalRequestToken requestTokens = config.getWithdrawalRequestToken();
    require(msg.sender == requestTokens.ownerOf(tokenId), "NA");

    WithdrawalRequest storage request = _withdrawalRequests[tokenId];

    request.fiduRequested = request.fiduRequested.add(fiduAmount);
    thisEpoch.fiduRequested = thisEpoch.fiduRequested.add(fiduAmount);

    config.getFidu().safeTransferFrom(msg.sender, address(this), fiduAmount);
  }

  /// @inheritdoc ISeniorPoolEpochWithdrawals
  /// @dev Users who make requests through our dapp will always use their msg.sender address for
  ///   the operator. The extra flexibility of the operator param is needed for contract integration.
  ///   E.g. if someone calls unstakeAndWithdraw on StakingRewards, the contract can call requestWithdrawal
  ///   usint its msg.sender for operator so that the request token is minted not to StakingRewards but to
  ///   the user who called unstakeAndWithdraw.
  function requestWithdrawal(uint256 fiduAmount) external override whenNotPaused nonReentrant returns (uint256) {
    IWithdrawalRequestToken requestTokens = config.getWithdrawalRequestToken();
    require(config.getGo().goSeniorPool(msg.sender), "NA");
    require(requestTokens.balanceOf(msg.sender) == 0, "Existing request");
    Epoch storage thisEpoch = _checkpointEpochs();

    uint256 tokenId = requestTokens.mint(msg.sender);

    WithdrawalRequest storage request = _withdrawalRequests[tokenId];

    request.epochCursor = thisEpoch.id;
    request.fiduRequested = request.fiduRequested.add(fiduAmount);

    thisEpoch.fiduRequested = thisEpoch.fiduRequested.add(fiduAmount);
    config.getFidu().safeTransferFrom(msg.sender, address(this), fiduAmount);

    emit WithdrawalRequested(msg.sender, address(0), fiduAmount);
    return tokenId;
  }

  /// @inheritdoc ISeniorPoolEpochWithdrawals
  function cancelWithdrawalRequest(uint256 tokenId) external override whenNotPaused nonReentrant returns (uint256) {
    require(config.getGo().goSeniorPool(msg.sender), "NA");
    Epoch storage thisEpoch = _checkpointEpochs();

    require(msg.sender == config.getWithdrawalRequestToken().ownerOf(tokenId), "NA");

    WithdrawalRequest storage request = _withdrawalRequests[tokenId];
    // TODO - add to usdcWithdrawable up to the current epoch
    // TODO - remove revert for not fully withdrawn
    require(request.epochCursor == thisEpoch.id, "Not fully withdrawn");

    uint256 reserveBps = config.getSeniorPoolWithdrawalCancelationFeeBps();
    uint256 reserveFidu = request.fiduRequested.mul(reserveBps).div(10_000);
    uint256 userFidu = request.fiduRequested.sub(reserveFidu);

    thisEpoch.fiduRequested = thisEpoch.fiduRequested.sub(request.fiduRequested);

    delete _withdrawalRequests[tokenId];
    // TODO - only burn if usdcWithdrawable == 0
    config.getWithdrawalRequestToken().burn(tokenId);
    config.getFidu().safeTransfer(msg.sender, userFidu);
    config.getFidu().safeTransfer(config.reserveAddress(), reserveFidu);

    emit WithdrawalCanceled(msg.sender, address(0), userFidu.add(reserveFidu));
  }

  /// @inheritdoc ISeniorPoolEpochWithdrawals
  function claimWithdrawalRequest(uint256 tokenId) external override whenNotPaused nonReentrant returns (uint256) {
    require(config.getGo().goSeniorPool(msg.sender), "NA");
    _checkpointEpochs();

    require(msg.sender == config.getWithdrawalRequestToken().ownerOf(tokenId), "NA");

    WithdrawalRequest storage request = _withdrawalRequests[tokenId];
    _withdrawalRequestCheckpoint(request);

    uint256 totalUsdcAmount = request.usdcWithdrawable;
    request.usdcWithdrawable = 0;
    uint256 reserveAmount = totalUsdcAmount.div(config.getWithdrawFeeDenominator());
    totalUsdcAmount = totalUsdcAmount.sub(reserveAmount);

    // if there is no outstanding FIDU, burn the token
    if (request.fiduRequested == 0 && request.usdcWithdrawable == 0) {
      delete _withdrawalRequests[tokenId];
      config.getWithdrawalRequestToken().burn(tokenId);
    }

    _sendToReserve(reserveAmount, msg.sender);
    config.getUSDC().safeTransfer(msg.sender, totalUsdcAmount);

    emit WithdrawalMade(msg.sender, totalUsdcAmount, reserveAmount);
  }

  // view functions
  //--------------------------------------------------------------------------------

  function epochDuration() public view override returns (uint256) {
    return _epochDuration;
  }

  /// @inheritdoc ISeniorPoolEpochWithdrawals
  function currentEpoch() public view override returns (Epoch memory) {
    return _previewCheckpointEpoch(_headEpoch());
  }

  /// @inheritdoc ISeniorPoolEpochWithdrawals
  function withdrawalRequest(uint256 tokenId) external view override returns (WithdrawalRequest memory) {
    WithdrawalRequest storage wr = _withdrawalRequests[tokenId];
    return _previewWithdrawRequestCheckpoint(wr);
  }

  // amount of usdc you will receive
  function previewWithdrawal(uint256 tokenId) public view override returns (uint256) {
    WithdrawalRequest storage wr = _withdrawalRequests[tokenId];
    return _previewWithdrawRequestCheckpoint(wr).usdcWithdrawable;
  }

  // internal view functions
  //--------------------------------------------------------------------------------

  function _previewCheckpointEpoch(Epoch memory epoch) internal view returns (Epoch memory) {
    // If the latest epoch hasn't ended. There's nothing to do
    if (block.timestamp <= epoch.endsAt) {
      return epoch;
    }

    // liquidate epoch
    uint256 usdcNeededToFullyLiquidate = _fiduToUsdc(epoch.fiduRequested);
    uint256 usdcAllocated = usdcAvailable.min(usdcNeededToFullyLiquidate);
    uint256 fiduLiquidated = _usdcToFidu(usdcAllocated);
    epoch.fiduLiquidated = fiduLiquidated;
    epoch.usdcAllocated = usdcAllocated;

    // if multiple epochs have passed since checkpointing, update the endtime
    // and emit many events so that we don't need to write a bunch of useless epochs
    uint256 nopEpochsElapsed = block.timestamp.sub(epoch.endsAt).div(_epochDuration);

    // update the last epoch timestamp to the timestamp of the most recently ended epoch
    epoch.endsAt = epoch.endsAt.add(nopEpochsElapsed.mul(_epochDuration));
    return epoch;
  }

  function _headEpoch() internal view returns (Epoch storage) {
    return _epochs[_checkpointedEpochId];
  }

  function _previewWithdrawRequestCheckpoint(WithdrawalRequest memory wr)
    internal
    view
    returns (WithdrawalRequest memory)
  {
    Epoch memory epoch;
    uint256 endEpoch = block.timestamp < _epochs[_checkpointedEpochId].endsAt
      ? _checkpointedEpochId - 1
      : _checkpointedEpochId;
    for (uint256 i = wr.epochCursor; i <= endEpoch && wr.fiduRequested > 0; ++i) {
      epoch = _epochs[i];
      if (block.timestamp < epoch.endsAt) {
        break;
      }
      if (i == _checkpointedEpochId) {
        epoch = _previewCheckpointEpoch(epoch);
      }
      uint256 proRataUsdc = epoch.usdcAllocated.mul(wr.fiduRequested).div(epoch.fiduRequested);
      uint256 fiduLiquidated = epoch.fiduLiquidated.mul(wr.fiduRequested).div(epoch.fiduRequested);
      wr.fiduRequested = wr.fiduRequested.sub(fiduLiquidated);
      wr.usdcWithdrawable = wr.usdcWithdrawable.add(proRataUsdc);
      wr.epochCursor = i + 1;
    }
    return wr;
  }

  // internal functions
  //--------------------------------------------------------------------------------

  function _sendToReserve(uint256 amount, address userForEvent) internal {
    emit ReserveFundsCollected(userForEvent, amount);
    config.getUSDC().safeTransfer(config.reserveAddress(), amount);
  }

  function _initializeNextEpoch() internal returns (Epoch storage) {
    Epoch storage lastEpoch = _epochs[_checkpointedEpochId];
    Epoch storage nextEpoch = _epochs[++_checkpointedEpochId];

    nextEpoch.id = lastEpoch.id + 1;
    nextEpoch.endsAt = lastEpoch.endsAt.add(_epochDuration);
    uint256 fiduToCarryOverFromLastEpoch = lastEpoch.fiduRequested.sub(lastEpoch.fiduLiquidated);
    nextEpoch.fiduRequested = fiduToCarryOverFromLastEpoch;

    return nextEpoch;
  }

  /// @notice Increment _checkpointedEpochId cursor up to the current epoch
  function _checkpointEpochs() private returns (Epoch storage) {
    _checkpointEpoch(_headEpoch());
    return _headEpoch();
  }

  function _withdrawalRequestCheckpoint(WithdrawalRequest storage wr) internal {
    Epoch storage epoch;
    for (uint256 i = wr.epochCursor; i < _checkpointedEpochId && wr.fiduRequested > 0; i++) {
      epoch = _epochs[i];
      uint256 proRataUsdc = epoch.usdcAllocated.mul(wr.fiduRequested).div(epoch.fiduRequested);
      uint256 fiduLiquidated = epoch.fiduLiquidated.mul(wr.fiduRequested).div(epoch.fiduRequested);
      wr.fiduRequested = wr.fiduRequested.sub(fiduLiquidated);
      wr.usdcWithdrawable = wr.usdcWithdrawable.add(proRataUsdc);
      wr.epochCursor = i + 1;
    }
  }

  function _checkpointEpoch(Epoch storage epoch) internal {
    // If the latest epoch hasn't ended. There's nothing to do
    if (block.timestamp <= epoch.endsAt) {
      return;
    }

    // liquidate epoch
    uint256 usdcNeededToFullyLiquidate = _fiduToUsdc(epoch.fiduRequested);
    uint256 usdcAllocated = usdcAvailable.min(usdcNeededToFullyLiquidate);
    uint256 fiduLiquidated = _usdcToFidu(usdcAllocated);
    epoch.fiduLiquidated = fiduLiquidated;
    epoch.usdcAllocated = usdcAllocated;
    usdcAvailable = usdcAvailable.sub(usdcAllocated);

    emit EpochEnded(epoch.id, epoch.endsAt, usdcAllocated, fiduLiquidated);

    // if multiple epochs have passed since checkpointing, update the endtime
    // and emit many events so that we don't need to write a bunch of useless epochs
    uint256 nopEpochsElapsed = block.timestamp.sub(epoch.endsAt).div(_epochDuration);
    for (uint256 i = 0; i < nopEpochsElapsed; i++) {
      // emit a different event to indicate that its an extension of a nop epoch
      emit EpochEnded(epoch.id, epoch.endsAt.add(i.mul(_epochDuration)), 0, 0);
    }

    // update the last epoch timestamp to the timestamp of the most recently ended epoch
    epoch.endsAt = epoch.endsAt.add(nopEpochsElapsed.mul(_epochDuration));

    _initializeNextEpoch();

    config.getFidu().burnFrom(address(this), epoch.fiduLiquidated);
  }

  function _burnWithdrawRequest(uint256 tokenId) internal {
    delete _withdrawalRequests[tokenId];
    config.getWithdrawalRequestToken().burn(tokenId);
  }

  /*================================================================================
    Zapper Withdraw
    ================================================================================*/
  /**
   * @notice Withdraws USDC from the SeniorPool to msg.sender, and burns the equivalent value of FIDU tokens
   * @param usdcAmount The amount of USDC to withdraw
   */
  function withdraw(uint256 usdcAmount)
    external
    override
    whenNotPaused
    nonReentrant
    onlyZapper
    returns (uint256 amount)
  {
    require(usdcAmount > 0, "Must withdraw more than zero");
    uint256 withdrawShares = getNumShares(usdcAmount);
    return _withdraw(usdcAmount, withdrawShares);
  }

  /**
   * @notice Withdraws USDC (denominated in FIDU terms) from the SeniorPool to msg.sender
   * @param fiduAmount The amount of USDC to withdraw in terms of FIDU shares
   */
  function withdrawInFidu(uint256 fiduAmount)
    external
    override
    whenNotPaused
    nonReentrant
    onlyZapper
    returns (uint256 amount)
  {
    require(fiduAmount > 0, "Must withdraw more than zero");
    uint256 usdcAmount = _getUSDCAmountFromShares(fiduAmount);
    uint256 withdrawShares = fiduAmount;
    return _withdraw(usdcAmount, withdrawShares);
  }

  // Zapper Withdraw: Internal functions
  //--------------------------------------------------------------------------------
  function _withdraw(uint256 usdcAmount, uint256 withdrawShares) internal returns (uint256 userAmount) {
    _checkpointEpochs();
    IFidu fidu = config.getFidu();
    // Determine current shares the address has and the shares requested to withdraw
    uint256 currentShares = fidu.balanceOf(msg.sender);
    // Ensure the address has enough value in the pool
    require(withdrawShares <= currentShares, "Amount requested is greater than what this address owns");
    // require(usdcAmount <= config.getUSDC().balanceOf(address(this)).sub(usdcAllocatedNotWithdrawn), "IB");

    usdcAvailable = usdcAvailable.sub(usdcAmount, "IB");
    // Send to reserves
    userAmount = usdcAmount;

    // Send to user
    config.getUSDC().safeTransfer(msg.sender, usdcAmount);

    // Burn the shares
    fidu.burnFrom(msg.sender, withdrawShares);

    emit WithdrawalMade(msg.sender, userAmount, 0);

    return userAmount;
  }

  /*================================================================================
    Asset Management
    ----------------
    functions related to investing, writing off, and redeeming assets
    ================================================================================*/

  // External functions
  //--------------------------------------------------------------------------------

  /**
   * @notice Invest in an ITranchedPool's senior tranche using the senior pool's strategy
   * @param pool An ITranchedPool whose senior tranche should be considered for investment
   */
  function invest(ITranchedPool pool) public override whenNotPaused nonReentrant {
    require(_isValidPool(pool), "Pool must be valid");
    _checkpointEpochs();

    ISeniorPoolStrategy strategy = config.getSeniorPoolStrategy();
    uint256 amount = strategy.invest(this, pool);

    require(amount > 0, "Investment amount must be positive");
    require(amount <= usdcAvailable, "not enough usdc");

    usdcAvailable = usdcAvailable.sub(amount);

    _approvePool(pool, amount);
    uint256 nSlices = pool.numSlices();
    require(nSlices >= 1, "Pool has no slices");
    uint256 sliceIndex = nSlices.sub(1);
    uint256 seniorTrancheId = _sliceIndexToSeniorTrancheId(sliceIndex);
    totalLoansOutstanding = totalLoansOutstanding.add(amount);
    pool.deposit(seniorTrancheId, amount);

    emit InvestmentMadeInSenior(address(pool), amount);
  }

  /**
   * @notice Redeem interest and/or principal from an ITranchedPool investment
   * @param tokenId the ID of an IPoolTokens token to be redeemed
   */
  function redeem(uint256 tokenId) public override whenNotPaused nonReentrant {
    _checkpointEpochs();
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);

    ITranchedPool pool = ITranchedPool(tokenInfo.pool);
    (uint256 interestRedeemed, uint256 principalRedeemed) = pool.withdrawMax(tokenId);

    _collectInterestAndPrincipal(address(pool), interestRedeemed, principalRedeemed);
  }

  /**
   * @notice Write down an ITranchedPool investment. This will adjust the senior pool's share price
   *  down if we're considering the investment a loss, or up if the borrower has subsequently
   *  made repayments that restore confidence that the full loan will be repaid.
   * @param tokenId the ID of an IPoolTokens token to be considered for writedown
   */
  function writedown(uint256 tokenId) public override whenNotPaused nonReentrant {
    IPoolTokens poolTokens = config.getPoolTokens();
    require(address(this) == poolTokens.ownerOf(tokenId), "Only tokens owned by the senior pool can be written down");

    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    ITranchedPool pool = ITranchedPool(tokenInfo.pool);
    require(_isValidPool(pool), "Pool must be valid");
    _checkpointEpochs();

    // Assess the pool first in case it has unapplied USDC in its credit line
    pool.assess();

    uint256 principalRemaining = tokenInfo.principalAmount.sub(tokenInfo.principalRedeemed);

    (uint256 writedownPercent, uint256 writedownAmount) = _calculateWritedown(pool, principalRemaining);

    uint256 prevWritedownAmount = writedownsByPoolToken[tokenId];

    if (writedownPercent == 0 && prevWritedownAmount == 0) {
      return;
    }

    int256 writedownDelta = int256(prevWritedownAmount) - int256(writedownAmount);
    writedownsByPoolToken[tokenId] = writedownAmount;
    _distributeLosses(writedownDelta);
    if (writedownDelta > 0) {
      // If writedownDelta is positive, that means we got money back. So subtract from totalWritedowns.
      totalWritedowns = totalWritedowns.sub(uint256(writedownDelta));
    } else {
      totalWritedowns = totalWritedowns.add(uint256(writedownDelta * -1));
    }
    emit PrincipalWrittenDown(address(pool), writedownDelta);
  }

  // View Functions
  //--------------------------------------------------------------------------------

  /**
   * @notice Returns the net assests controlled by and owed to the pool
   */
  function assets() public view override returns (uint256) {
    uint256 usdcThatWillBeAllocatedToLatestEpoch = _previewCheckpointEpoch(_epochs[_checkpointedEpochId]).usdcAllocated;
    return usdcAvailable.add(totalLoansOutstanding).sub(usdcThatWillBeAllocatedToLatestEpoch).sub(totalWritedowns);
  }

  function getNumShares(uint256 usdcAmount) public view override returns (uint256) {
    return _getNumShares(usdcAmount, sharePrice);
  }

  function estimateInvestment(ITranchedPool pool) public view override returns (uint256) {
    require(_isValidPool(pool), "Pool must be valid");
    ISeniorPoolStrategy strategy = config.getSeniorPoolStrategy();
    return strategy.estimateInvestment(this, pool);
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

    (, uint256 writedownAmount) = _calculateWritedown(pool, principalRemaining);
    return writedownAmount;
  }

  // Internal functions
  //--------------------------------------------------------------------------------

  function _getNumShares(uint256 _usdcAmount, uint256 _sharePrice) internal pure returns (uint256) {
    return _usdcToFidu(_usdcAmount).mul(FIDU_MANTISSA).div(_sharePrice);
  }

  function _calculateWritedown(ITranchedPool pool, uint256 principal)
    internal
    view
    returns (uint256 writedownPercent, uint256 writedownAmount)
  {
    return
      Accountant.calculateWritedownForPrincipal(
        pool.creditLine(),
        principal,
        block.timestamp,
        config.getLatenessGracePeriodInDays(),
        config.getLatenessMaxDays()
      );
  }

  function _distributeLosses(int256 writedownDelta) internal {
    _checkpointEpochs();
    if (writedownDelta > 0) {
      uint256 delta = _usdcToSharePrice(uint256(writedownDelta));
      sharePrice = sharePrice.add(delta);
    } else {
      // If delta is negative, convert to positive uint, and sub from sharePrice
      uint256 delta = _usdcToSharePrice(uint256(writedownDelta * -1));
      sharePrice = sharePrice.sub(delta);
    }
  }

  function _collectInterestAndPrincipal(
    address from,
    uint256 interest,
    uint256 principal
  ) internal {
    _checkpointEpochs();

    uint256 increment = _usdcToSharePrice(interest);
    sharePrice = sharePrice.add(increment);

    if (interest > 0) {
      emit InterestCollected(from, interest);
    }
    if (principal > 0) {
      emit PrincipalCollected(from, principal);
      totalLoansOutstanding = totalLoansOutstanding.sub(principal);
    }
    usdcAvailable += (interest + principal);
  }

  function _isValidPool(ITranchedPool pool) internal view returns (bool) {
    return config.getPoolTokens().validPool(address(pool));
  }

  function _approvePool(ITranchedPool pool, uint256 allowance) internal {
    IERC20withDec usdc = config.getUSDC();
    require(usdc.approve(address(pool), allowance));
  }

  /*================================================================================
    General Internal Functions
    ================================================================================*/

  function _usdcToFidu(uint256 amount) internal pure returns (uint256) {
    return amount.mul(FIDU_MANTISSA).div(USDC_MANTISSA);
  }

  function _fiduToUsdc(uint256 amount) internal pure returns (uint256) {
    return amount.div(FIDU_MANTISSA.div(USDC_MANTISSA));
  }

  function _getUSDCAmountFromShares(uint256 fiduAmount) internal view returns (uint256) {
    return _getUSDCAmountFromShares(fiduAmount, sharePrice);
  }

  function _getUSDCAmountFromShares(uint256 _fiduAmount, uint256 _sharePrice) internal pure returns (uint256) {
    return _fiduToUsdc(_fiduAmount.mul(_sharePrice)).div(FIDU_MANTISSA);
  }

  function _usdcToSharePrice(uint256 usdcAmount) internal view returns (uint256) {
    return _usdcToFidu(usdcAmount).mul(FIDU_MANTISSA).div(_totalShares());
  }

  function _totalShares() internal view returns (uint256) {
    return config.getFidu().totalSupply();
  }

  /// @notice Returns the senion tranche id for the given slice index
  /// @param index slice index
  /// @return senior tranche id of given slice index
  function _sliceIndexToSeniorTrancheId(uint256 index) internal pure returns (uint256) {
    return index.mul(2).add(1);
  }

  modifier onlyZapper() {
    require(hasRole(ZAPPER_ROLE, msg.sender), "Not Zapper");
    _;
  }
}
