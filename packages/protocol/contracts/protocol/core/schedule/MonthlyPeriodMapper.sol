// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

// solhint-disable-next-line
import {BokkyPooBahsDateTimeLibrary as DateTimeLib} from "BokkyPooBahsDateTimeLibrary/contracts/BokkyPooBahsDateTimeLibrary.sol";
import {IPeriodMapper} from "../../../interfaces/IPeriodMapper.sol";

/// @title Monthly schedule
/// @author Warbler Labs Engineering
/// @notice A schedule mapping timestamps to periods. Each period begins on the first second
///         of each month
contract MonthlyPeriodMapper is IPeriodMapper {
  // @inheritdoc IPeriodMapper
  function periodOf(uint256 timestamp) external pure override returns (uint256) {
    return DateTimeLib.diffMonths(0, timestamp);
  }

  /// @inheritdoc IPeriodMapper
  function startOf(uint256 period) external pure override returns (uint256) {
    return DateTimeLib.addMonths(0, period);
  }
}
