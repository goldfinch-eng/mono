// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {SaturatingSub} from "./SaturatingSub.sol";

library InterestUtil {
  using SaturatingSub for uint256;

  uint256 internal constant INTEREST_DECIMALS = 1e18;
  uint256 internal constant SECONDS_PER_DAY = 60 * 60 * 24;
  uint256 internal constant SECONDS_PER_YEAR = SECONDS_PER_DAY * 365;

  /**
   * Calculates flat interest accrued over a period of time given constant principal.
   */
  function calculateInterest(
    uint256 secondsElapsed,
    uint256 principal,
    uint256 interestApr
  ) internal pure returns (uint256 interest) {
    uint256 totalInterestPerYear = (principal * interestApr) / INTEREST_DECIMALS;
    interest = (totalInterestPerYear * secondsElapsed) / SECONDS_PER_YEAR;
  }

  /**
   * Calculates interest accrued along with late interest over a given time period given constant principal
   *
   */
  function calculateInterest(
    uint256 start,
    uint256 end,
    uint256 lateFeesStartsAt,
    uint256 principal,
    uint256 interestApr,
    uint256 lateInterestApr
  ) internal pure returns (uint256 interest) {
    if (end <= start) return 0;
    uint256 totalDuration = end - start;
    interest = calculateInterest(totalDuration, principal, interestApr);
    if (lateFeesStartsAt < end) {
      uint256 lateDuration = end.saturatingSub(MathUpgradeable.max(lateFeesStartsAt, start));
      interest += calculateInterest(lateDuration, principal, lateInterestApr);
    }
  }
}
