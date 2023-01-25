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
import {TestCallableLoan} from "../TestCallableLoan.sol";

contract CallableLoanBuilder {
  uint256 public constant DEFAULT_MAX_LIMIT = 1_000_000 * 1e6;
  uint256 public constant DEFAULT_APR = 5 * 1e16;
  uint256 public constant DEFAULT_LATE_APR = 0;

  GoldfinchFactory private gfFactory;
  SeniorPool private seniorPool;
  MonthlyScheduleRepo private monthlyScheduleRepo;
  uint256 private maxLimit;
  uint256 private apr;
  uint256 private lateFeeApr;
  uint256 private fundableAt;
  uint256[] private allowedUIDTypes = [0, 1, 2, 3, 4];

  constructor(
    GoldfinchFactory _gfFactory,
    SeniorPool _seniorPool,
    MonthlyScheduleRepo _monthlyScheduleRepo
  ) public {
    gfFactory = _gfFactory;
    seniorPool = _seniorPool;
    monthlyScheduleRepo = _monthlyScheduleRepo;
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

  function build(address borrower) external returns (TestCallableLoan, CreditLine) {
    ITranchedPool created = gfFactory.createCallableLoan(
      borrower,
      maxLimit,
      apr,
      defaultSchedule(),
      lateFeeApr,
      fundableAt,
      allowedUIDTypes
    );
    TestCallableLoan callableLoan = TestCallableLoan(address(created));
    return (callableLoan, CreditLine(address(callableLoan.creditLine())));
  }

  function withMaxLimit(uint256 _maxLimit) external returns (CallableLoanBuilder) {
    maxLimit = _maxLimit;
    return this;
  }

  function withApr(uint256 _apr) external returns (CallableLoanBuilder) {
    apr = _apr;
    return this;
  }

  function withLateFeeApr(uint256 _lateFeeApr) external returns (CallableLoanBuilder) {
    lateFeeApr = _lateFeeApr;
    return this;
  }

  function withFundableAt(uint256 _fundableAt) external returns (CallableLoanBuilder) {
    fundableAt = _fundableAt;
    return this;
  }

  function withAllowedUIDTypes(
    uint256[] calldata _allowedUIDTypes
  ) external returns (CallableLoanBuilder) {
    allowedUIDTypes = _allowedUIDTypes;
    return this;
  }
}
