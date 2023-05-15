// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;
pragma experimental ABIEncoderV2;

import {BaseUpgradeablePausable} from "./BaseUpgradeablePausable.sol";
import {ConfigHelper} from "./ConfigHelper.sol";
import {ConfigOptions} from "./ConfigOptions.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {GoldfinchConfig} from "./GoldfinchConfig.sol";
import {IBorrower} from "../../interfaces/IBorrower.sol";
import {ISchedule} from "../../interfaces/ISchedule.sol";
import {ITranchedPool} from "../../interfaces/ITranchedPool.sol";
import {ICallableLoan} from "../../interfaces/ICallableLoan.sol";
import {ICreditLine} from "../../interfaces/ICreditLine.sol";
import {IPeriodMapper} from "../../interfaces/IPeriodMapper.sol";
import {ImplementationRepository} from "./proxy/ImplementationRepository.sol";
import {UcuProxy} from "./proxy/UcuProxy.sol";

/**
 * @title GoldfinchFactory
 * @notice Contract that allows us to create other contracts, such as CreditLines and BorrowerContracts
 *  Note GoldfinchFactory is a legacy name. More properly this can be considered simply the GoldfinchFactory
 * @author Goldfinch
 */

contract GoldfinchFactory is BaseUpgradeablePausable {
  GoldfinchConfig public config;

  /// Role to allow for pool creation
  bytes32 public constant BORROWER_ROLE = keccak256("BORROWER_ROLE");

  using ConfigHelper for GoldfinchConfig;

  event BorrowerCreated(address indexed borrower, address indexed owner);
  event PoolCreated(ITranchedPool indexed pool, address indexed borrower);
  event CallableLoanCreated(ICallableLoan indexed loan, address indexed borrower);
  event CreditLineCreated(ICreditLine indexed creditLine);
  event BeaconCreated(
    UpgradeableBeacon indexed beacon,
    address indexed owner,
    address indexed implementation
  );

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    require(
      owner != address(0) && address(_config) != address(0),
      "Owner and config addresses cannot be empty"
    );
    __BaseUpgradeablePausable__init(owner);
    config = _config;
    _setRoleAdmin(BORROWER_ROLE, OWNER_ROLE);
  }

  /**
   * @notice Allows anyone to create a CreditLine contract instance
   * @dev There is no value to calling this function directly. It is only meant to be called
   *  by a TranchedPool during it's creation process.
   */
  function createCreditLine() external returns (ICreditLine) {
    ICreditLine creditLine = ICreditLine(
      address(new BeaconProxy(address(config.getCreditLineBeacon()), ""))
    );
    emit CreditLineCreated(creditLine);
    return creditLine;
  }

  /**
   * @notice Allows anyone to create a Borrower contract instance
   * @param owner The address that will own the new Borrower instance
   */
  function createBorrower(address owner) external returns (address) {
    address _borrower = _deployMinimal(config.borrowerImplementationAddress());
    IBorrower borrower = IBorrower(_borrower);
    borrower.initialize(owner, address(config));
    emit BorrowerCreated(address(borrower), owner);
    return address(borrower);
  }

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
  ) external onlyAdminOrBorrower returns (ITranchedPool pool) {
    pool = ITranchedPool(address(new BeaconProxy(address(config.getTranchedPoolBeacon()), "")));

    pool.initialize(
      address(config),
      _borrower,
      _juniorFeePercent,
      _limit,
      _interestApr,
      _schedule,
      _lateFeeApr,
      _fundableAt,
      _allowedUIDTypes
    );
    emit PoolCreated(pool, _borrower);
    config.getPoolTokens().onPoolCreated(address(pool));
  }

  function createBeacon(
    ConfigOptions.Addresses impl,
    address beaconOwner
  ) external onlyAdmin returns (UpgradeableBeacon) {
    address implAddress = config.getAddress(uint256(impl));
    UpgradeableBeacon beacon = new UpgradeableBeacon(implAddress);
    beacon.transferOwnership(beaconOwner);
    emit BeaconCreated(beacon, beaconOwner, implAddress);
    return beacon;
  }

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
  ) external onlyAdminOrBorrower returns (ICallableLoan loan) {
    return
      _createCallableLoanWithProxyOwner(
        _borrower,
        _borrower,
        _limit,
        _interestApr,
        _numLockupPeriods,
        _schedule,
        _lateFeeApr,
        _fundableAt,
        _allowedUIDTypes
      );
  }

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
  ) external onlyAdminOrBorrower returns (ICallableLoan loan) {
    return
      _createCallableLoanWithProxyOwner(
        _proxyOwner,
        _borrower,
        _limit,
        _interestApr,
        _numLockupPeriods,
        _schedule,
        _lateFeeApr,
        _fundableAt,
        _allowedUIDTypes
      );
  }

  function _createCallableLoanWithProxyOwner(
    address _proxyOwner,
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _numLockupPeriods,
    ISchedule _schedule,
    uint256 _lateFeeApr,
    uint256 _fundableAt,
    uint256[] calldata _allowedUIDTypes
  ) internal returns (ICallableLoan loan) {
    // need to enclose in a scope to avoid overflowing stack
    {
      ImplementationRepository repo = config.getCallableLoanImplementationRepository();
      UcuProxy callableLoanProxy = new UcuProxy(repo, _proxyOwner, repo.currentLineageId());
      loan = ICallableLoan(address(callableLoanProxy));
    }

    loan.initialize({
      _config: config,
      _borrower: _borrower,
      _limit: _limit,
      _interestApr: _interestApr,
      _numLockupPeriods: _numLockupPeriods,
      _schedule: _schedule,
      _lateFeeApr: _lateFeeApr,
      _fundableAt: _fundableAt,
      _allowedUIDTypes: _allowedUIDTypes
    });
    emit CallableLoanCreated(loan, _borrower);
    config.getPoolTokens().onPoolCreated(address(loan));
  }

  // Stolen from:
  // https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/packages/lib/contracts/upgradeability/ProxyFactory.sol
  function _deployMinimal(address _logic) internal returns (address proxy) {
    bytes20 targetBytes = bytes20(_logic);
    // solhint-disable-next-line no-inline-assembly
    assembly {
      let clone := mload(0x40)
      mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
      mstore(add(clone, 0x14), targetBytes)
      mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
      proxy := create(0, clone, 0x37)
    }
    return proxy;
  }

  function isBorrower() public view returns (bool) {
    return hasRole(BORROWER_ROLE, _msgSender());
  }

  modifier onlyAdminOrBorrower() {
    require(isAdmin() || isBorrower(), "Must have admin or borrower role to perform this action");
    _;
  }
}
