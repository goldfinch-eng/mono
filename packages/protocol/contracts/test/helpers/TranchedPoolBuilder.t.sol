// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {CreditLine} from "../../protocol/core/CreditLine.sol";
import {GoldfinchFactory} from "../../protocol/core/GoldfinchFactory.sol";
import {ISchedule} from "../../interfaces/ISchedule.sol";
import {ITranchedPool} from "../../interfaces/ITranchedPool.sol";
import {MonthlyScheduleRepo} from "../../protocol/core/schedule/MonthlyScheduleRepo.sol";
import {SeniorPool} from "../../protocol/core/SeniorPool.sol";
import {TestConstants} from "../core/TestConstants.t.sol";
import {TestTranchedPool} from "../TestTranchedPool.sol";

contract TranchedPoolBuilder {
  uint256 public constant DEFAULT_JUNIOR_FEE_PERCENT = 20;
  uint256 public constant DEFAULT_MAX_LIMIT = 1_000_000 * 1e6;
  uint256 public constant DEFAULT_APR = 5 * 1e16;
  uint256 public constant DEFAULT_LATE_APR = 0;

  GoldfinchFactory private gfFactory;
  SeniorPool private seniorPool;
  MonthlyScheduleRepo private monthlyScheduleRepo;
  uint256 private juniorFeePercent;
  uint256 private maxLimit;
  uint256 private apr;
  uint256 private lateFeeApr;
  uint256 private fundableAt;
  uint256[] private allowedUIDTypes = [0, 1, 2, 3, 4];
  uint256 private _periodsInTerm = 12;
  uint256 private _periodsPerInterestPeriod = 1;
  uint256 private _periodsPerPrincipalPeriod = 12;
  uint256 private _gracePrincipalPeriods = 0;

  constructor(
    GoldfinchFactory _gfFactory,
    SeniorPool _seniorPool,
    MonthlyScheduleRepo _monthlyScheduleRepo
  ) public {
    gfFactory = _gfFactory;
    seniorPool = _seniorPool;
    monthlyScheduleRepo = _monthlyScheduleRepo;
    juniorFeePercent = DEFAULT_JUNIOR_FEE_PERCENT;
    maxLimit = DEFAULT_MAX_LIMIT;
    apr = DEFAULT_APR;
    lateFeeApr = DEFAULT_LATE_APR;
    fundableAt = block.timestamp;
  }

  function defaultSchedule() public returns (ISchedule) {
    return
      monthlyScheduleRepo.createSchedule({
        periodsInTerm: 12,
        periodsPerInterestPeriod: 1,
        periodsPerPrincipalPeriod: 12,
        gracePrincipalPeriods: 0
      });
  }

  function build(address borrower) external returns (TestTranchedPool, CreditLine) {
    ITranchedPool created = gfFactory.createPool(
      borrower,
      juniorFeePercent,
      maxLimit,
      apr,
      monthlyScheduleRepo.createSchedule({
        periodsInTerm: _periodsInTerm,
        periodsPerInterestPeriod: _periodsPerInterestPeriod,
        periodsPerPrincipalPeriod: _periodsPerPrincipalPeriod,
        gracePrincipalPeriods: _gracePrincipalPeriods
      }),
      lateFeeApr,
      fundableAt,
      allowedUIDTypes
    );
    TestTranchedPool pool = TestTranchedPool(address(created));
    return (pool, CreditLine(address(pool.creditLine())));
  }

  function buildWithMonthlySchedule(
    address borrower,
    uint256 monthsInTerm,
    uint256 monthsPerInterestPeriod,
    uint256 monthsPerPrincipalPeriod
  ) external returns (TestTranchedPool, CreditLine) {
    ITranchedPool created = gfFactory.createPool({
      _borrower: borrower,
      _juniorFeePercent: juniorFeePercent,
      _limit: maxLimit,
      _interestApr: apr,
      _schedule: monthlyScheduleRepo.createSchedule({
        periodsInTerm: monthsInTerm,
        periodsPerInterestPeriod: monthsPerInterestPeriod,
        periodsPerPrincipalPeriod: monthsPerPrincipalPeriod,
        gracePrincipalPeriods: 0
      }),
      _lateFeeApr: lateFeeApr,
      _fundableAt: fundableAt,
      _allowedUIDTypes: allowedUIDTypes
    });
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

  function withLateFeeApr(uint256 _lateFeeApr) external returns (TranchedPoolBuilder) {
    lateFeeApr = _lateFeeApr;
    return this;
  }

  function withFundableAt(uint256 _fundableAt) external returns (TranchedPoolBuilder) {
    fundableAt = _fundableAt;
    return this;
  }

  function withScheduleParams(
    uint256 periodsInTerm,
    uint256 periodsPerInterestPeriod,
    uint256 periodsPerPrincipalPeriod,
    uint256 gracePrincipalPeriods
  ) external returns (TranchedPoolBuilder) {
    _periodsInTerm = periodsInTerm;
    _periodsPerInterestPeriod = periodsPerInterestPeriod;
    _periodsPerPrincipalPeriod = periodsPerPrincipalPeriod;
    _gracePrincipalPeriods = gracePrincipalPeriods;
    return this;
  }

  function withAllowedUIDTypes(
    uint256[] calldata _allowedUIDTypes
  ) external returns (TranchedPoolBuilder) {
    allowedUIDTypes = _allowedUIDTypes;
    return this;
  }
}
