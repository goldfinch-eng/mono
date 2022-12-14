// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {GoldfinchFactory} from "../../protocol/core/GoldfinchFactory.sol";
import {SeniorPool} from "../../protocol/core/SeniorPool.sol";
import {TranchedPoolV2} from "../../protocol/core/TranchedPoolV2.sol";
import {CreditLineV2} from "../../protocol/core/CreditLineV2.sol";
import {ITranchedPool} from "../../interfaces/ITranchedPool.sol";
import {TestConstants} from "../core/TestConstants.t.sol";

contract TranchedPoolV2Builder {
  uint256 public constant DEFAULT_JUNIOR_FEE_PERCENT = 20;
  uint256 public constant DEFAULT_MAX_LIMIT = 1_000_000 * 1e6;
  uint256 public constant DEFAULT_APR = 5 * 1e16;
  uint256 public constant DEFAULT_PERIOD_IN_DAYS = 30;
  uint256 public constant DEFAULT_TERM_IN_DAYS = 365;
  uint256 public constant DEFAULT_LATE_APR = 0;
  uint256 public constant DEFAULT_PRINCIPAL_GRACE_PERIOD_DAYS = 185;

  GoldfinchFactory private gfFactory;
  SeniorPool private seniorPool;
  uint256 private juniorFeePercent;
  uint256 private maxLimit;
  uint256 private apr;
  uint256 private periodInDays;
  uint256 private termInDays;
  uint256 private lateFeeApr;
  uint256 private principalGracePeriodInDays;
  uint256 private fundableAt;
  uint256[] private allowedUIDTypes = [0, 1, 2, 3, 4];

  constructor(GoldfinchFactory _gfFactory, SeniorPool _seniorPool) public {
    gfFactory = _gfFactory;
    seniorPool = _seniorPool;
    juniorFeePercent = DEFAULT_JUNIOR_FEE_PERCENT;
    maxLimit = DEFAULT_MAX_LIMIT;
    apr = DEFAULT_APR;
    periodInDays = DEFAULT_PERIOD_IN_DAYS;
    termInDays = DEFAULT_TERM_IN_DAYS;
    lateFeeApr = DEFAULT_LATE_APR;
    principalGracePeriodInDays = DEFAULT_PRINCIPAL_GRACE_PERIOD_DAYS;
    fundableAt = block.timestamp;
  }

  function build(address borrower) external returns (TranchedPoolV2, CreditLineV2) {
    ITranchedPool created = gfFactory.createPool(
      borrower,
      juniorFeePercent,
      maxLimit,
      apr,
      periodInDays,
      termInDays,
      lateFeeApr,
      principalGracePeriodInDays,
      fundableAt,
      allowedUIDTypes
    );
    TranchedPoolV2 pool = TranchedPoolV2(address(created));
    return (pool, CreditLineV2(address(pool.creditLine())));
  }

  function withJuniorFeePercent(
    uint256 _juniorFeePercent
  ) external returns (TranchedPoolV2Builder) {
    juniorFeePercent = _juniorFeePercent;
    return this;
  }

  function withMaxLimit(uint256 _maxLimit) external returns (TranchedPoolV2Builder) {
    maxLimit = _maxLimit;
    return this;
  }

  function withApr(uint256 _apr) external returns (TranchedPoolV2Builder) {
    apr = _apr;
    return this;
  }

  function withPeriodInDays(uint256 _periodInDays) external returns (TranchedPoolV2Builder) {
    periodInDays = _periodInDays;
    return this;
  }

  function withTermInDays(uint256 _termInDays) external returns (TranchedPoolV2Builder) {
    termInDays = _termInDays;
    return this;
  }

  function withLateFeeApr(uint256 _lateFeeApr) external returns (TranchedPoolV2Builder) {
    lateFeeApr = _lateFeeApr;
    return this;
  }

  function withPrincipalGracePeriodInDays(
    uint256 _principalGracePeriodInDays
  ) external returns (TranchedPoolV2Builder) {
    principalGracePeriodInDays = _principalGracePeriodInDays;
    return this;
  }

  function withFundableAt(uint256 _fundableAt) external returns (TranchedPoolV2Builder) {
    fundableAt = _fundableAt;
    return this;
  }

  function withAllowedUIDTypes(
    uint256[] calldata _allowedUIDTypes
  ) external returns (TranchedPoolV2Builder) {
    allowedUIDTypes = _allowedUIDTypes;
    return this;
  }
}
