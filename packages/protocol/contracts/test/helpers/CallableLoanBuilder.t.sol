// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {ICreditLine} from "../../interfaces/ICreditLine.sol";
import {IGoldfinchFactory} from "../../interfaces/IGoldfinchFactory.sol";
import {CallableLoan} from "../../protocol/core/callable/CallableLoan.sol";
import {ISchedule} from "../../interfaces/ISchedule.sol";
import {ITranchedPool} from "../../interfaces/ITranchedPool.sol";
import {IMonthlyScheduleRepo} from "../../interfaces/IMonthlyScheduleRepo.sol";
import {TestConstants} from "../core/TestConstants.t.sol";

contract CallableLoanBuilder {
  uint256 public constant DEFAULT_LIMIT = 1_000_000 * 1e6;
  uint256 public constant DEFAULT_APR = 5 * 1e16;
  uint256 public constant DEFAULT_LATE_APR = 0;

  IGoldfinchFactory private gfFactory;
  IMonthlyScheduleRepo private monthlyScheduleRepo;
  uint256 private limit;
  uint256 private apr;
  uint256 private lateFeeApr;
  uint256 private fundableAt;
  uint256[] private allowedUIDTypes = [0, 1, 2, 3, 4];

  constructor(IGoldfinchFactory _gfFactory, IMonthlyScheduleRepo _monthlyScheduleRepo) public {
    gfFactory = _gfFactory;
    monthlyScheduleRepo = _monthlyScheduleRepo;
    limit = DEFAULT_LIMIT;
    apr = DEFAULT_APR;
    lateFeeApr = DEFAULT_LATE_APR;
    fundableAt = block.timestamp;
  }

  function defaultSchedule() public returns (ISchedule) {
    return
      monthlyScheduleRepo.createSchedule({
        periodsInTerm: 12,
        periodsPerInterestPeriod: 1,
        periodsPerPrincipalPeriod: 3,
        gracePrincipalPeriods: 0
      });
  }

  function build(address borrower) external returns (CallableLoan, ICreditLine) {
    CallableLoan callableLoan = CallableLoan(
      address(
        gfFactory.createCallableLoan(
          borrower,
          limit,
          apr,
          defaultSchedule(),
          lateFeeApr,
          fundableAt,
          allowedUIDTypes
        )
      )
    );
    return (callableLoan, ICreditLine(callableLoan.creditLine()));
  }

  function withLimit(uint256 _limit) external returns (CallableLoanBuilder) {
    limit = _limit;
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
