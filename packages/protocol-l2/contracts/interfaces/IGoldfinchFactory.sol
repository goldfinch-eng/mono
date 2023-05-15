// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {ISchedule} from "./ISchedule.sol";
import {ITranchedPool} from "./ITranchedPool.sol";
import {ICreditLine} from "./ICreditLine.sol";
import {ICallableLoan} from "./ICallableLoan.sol";
import {ConfigOptions} from "../protocol/core/ConfigOptions.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

interface IGoldfinchFactory {
  /**
   * @notice Allows anyone to create a CreditLine contract instance
   * @dev There is no value to calling this function directly. It is only meant to be called
   *  by a TranchedPool during it's creation process.
   */
  function createCreditLine() external returns (ICreditLine);

  /**
   * @notice Allows anyone to create a Borrower contract instance
   * @param owner The address that will own the new Borrower instance
   */
  function createBorrower(address owner) external returns (address);

  /**
   * @notice Allows anyone to create a new TranchedPool for a single borrower
   * Requirements:
   *  You are the admin or a borrower
   */
  function createPool(
    address _borrower,
    uint256 _juniorFeePercent,
    uint256 _limit,
    uint256 _interestApr,
    ISchedule _schedule,
    uint256 _lateFeeApr,
    uint256 _fundableAt,
    uint256[] calldata _allowedUIDTypes
  ) external returns (ITranchedPool);

  /**
   * @notice Allows anyone to create a new CallableLoan for a single borrower
   * Requirements:
   *  You are the admin or a borrower
   */
  function createCallableLoan(
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _numLockupPeriods,
    ISchedule _schedule,
    uint256 _lateFeeApr,
    uint256 _fundableAt,
    uint256[] calldata _allowedUIDTypes
  ) external returns (ICallableLoan);

  /**
   * @notice Create a callable loan where the proxy owner is different than the borrower
   */
  function createCallableLoanWithProxyOwner(
    address _proxyOwner,
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _numLockupPeriods,
    ISchedule _schedule,
    uint256 _lateFeeApr,
    uint256 _fundableAt,
    uint256[] calldata _allowedUIDTypes
  ) external returns (ICallableLoan);

  /**
   * @notice Create a beacon whose initial implementation points to an address stored in the GoldfinchConfig.
   * @param impl The GoldfinchConfig Address enum value of the implementation
   * @param beaconOwner The owner of the beacon
   */
  function createBeacon(
    ConfigOptions.Addresses impl,
    address beaconOwner
  ) external returns (UpgradeableBeacon);
}
