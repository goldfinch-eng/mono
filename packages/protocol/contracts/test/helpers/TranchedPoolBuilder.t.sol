// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {GoldfinchFactory} from "../../protocol/core/GoldfinchFactory.sol";
import {SeniorPool} from "../../protocol/core/SeniorPool.sol";
import {TestTranchedPool} from "../TestTranchedPool.sol";
import {CreditLine} from "../../protocol/core/CreditLine.sol";
import {ITranchedPool} from "../../interfaces/ITranchedPool.sol";
import {ISchedule} from "../../interfaces/ISchedule.sol";
import {MonthlyPeriodMapper} from "../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {Schedule} from "../../protocol/core/schedule/Schedule.sol";
import {TestConstants} from "../core/TestConstants.t.sol";

contract TranchedPoolBuilder {
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

  function defaultSchedule() public returns (ISchedule) {
    return
      createMonthlySchedule({
        periodsInTerm: 12,
        periodsPerInterestPeriod: 1,
        periodsPerPrincipalPeriod: 12,
        gracePrincipalPeriods: 0
      });
  }

  function createMonthlySchedule(
    uint periodsInTerm,
    uint periodsPerPrincipalPeriod,
    uint periodsPerInterestPeriod,
    uint gracePrincipalPeriods
  ) public returns (ISchedule) {
    return
      new Schedule({
        _periodMapper: new MonthlyPeriodMapper(),
        _periodsInTerm: periodsInTerm,
        _periodsPerInterestPeriod: periodsPerInterestPeriod,
        _periodsPerPrincipalPeriod: periodsPerPrincipalPeriod,
        _gracePrincipalPeriods: gracePrincipalPeriods
      });
  }

  function build(address borrower) external returns (TestTranchedPool, CreditLine) {
    ITranchedPool created = gfFactory.createPool(
      borrower,
      juniorFeePercent,
      maxLimit,
      apr,
      defaultSchedule(),
      lateFeeApr,
      fundableAt,
      allowedUIDTypes
    );
    TestTranchedPool pool = TestTranchedPool(address(created));
    return (pool, CreditLine(address(pool.creditLine())));
  }

  function withJuniorFeePercent(uint256 _juniorFeePercent) external returns (TranchedPoolBuilder) {
    juniorFeePercent = _juniorFeePercent;
    return this;
  }

  function withMaxLimit(uint256 _maxLimit) external returns (TranchedPoolBuilder) {
    maxLimit = _maxLimit;
    return this;
  }

  function withApr(uint256 _apr) external returns (TranchedPoolBuilder) {
    apr = _apr;
    return this;
  }

  function withPeriodInDays(uint256 _periodInDays) external returns (TranchedPoolBuilder) {
    periodInDays = _periodInDays;
    return this;
  }

  function withTermInDays(uint256 _termInDays) external returns (TranchedPoolBuilder) {
    termInDays = _termInDays;
    return this;
  }

  function withLateFeeApr(uint256 _lateFeeApr) external returns (TranchedPoolBuilder) {
    lateFeeApr = _lateFeeApr;
    return this;
  }

  function withPrincipalGracePeriodInDays(
    uint256 _principalGracePeriodInDays
  ) external returns (TranchedPoolBuilder) {
    principalGracePeriodInDays = _principalGracePeriodInDays;
    return this;
  }

  function withFundableAt(uint256 _fundableAt) external returns (TranchedPoolBuilder) {
    fundableAt = _fundableAt;
    return this;
  }

  function withAllowedUIDTypes(
    uint256[] calldata _allowedUIDTypes
  ) external returns (TranchedPoolBuilder) {
    allowedUIDTypes = _allowedUIDTypes;
    return this;
  }
}
