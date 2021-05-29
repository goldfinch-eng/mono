// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./GoldfinchConfig.sol";
import "./BaseUpgradeablePausable.sol";
import "../../interfaces/IBorrower.sol";
import "../../interfaces/ITranchedPool.sol";
import "../../interfaces/ICreditLineFactoryV2.sol";
import "./ConfigHelper.sol";

/**
 * @title CreditLineFactory
 * @notice Contract that allows us to create other contracts, such as CreditLines and BorrowerContracts
 *  Note CreditLineFactory is a legacy name. More properly this can be considered simply the GoldfinchFactory
 * @author Goldfinch
 */

contract CreditLineFactory is BaseUpgradeablePausable {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  event BorrowerCreated(address indexed borrower, address indexed owner);
  event PoolCreated(address indexed pool, address indexed borrower);

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    __BaseUpgradeablePausable__init(owner);
    config = _config;
  }

  function createCreditLine() external returns (address) {
    return config.getCreditLineFactoryV2().createCreditLine();
  }

  /**
   * @notice Allows anyone to create a Borrower contract instance
   * @param owner The address that will own the new Borrower instance
   */
  function createBorrower(address owner) external returns (address) {
    address _borrower = deployMinimal(config.borrowerImplementationAddress());
    IBorrower borrower = IBorrower(_borrower);
    borrower.initialize(owner, address(config));
    emit BorrowerCreated(address(borrower), owner);
    return address(borrower);
  }

  /**
   * @notice Allows anyone to create a new TranchedPool for a single borrower
   * @param _borrower The borrower for whom the CreditLine will be created
   * @param _limit The maximum amount a borrower can drawdown from this CreditLine
   * @param _interestApr The interest amount, on an annualized basis (APR, so non-compounding), expressed as an integer.
   *  We assume 8 digits of precision. For example, to submit 15.34%, you would pass up 15340000,
   *  and 5.34% would be 5340000
   * @param _paymentPeriodInDays How many days in each payment period.
   *  ie. the frequency with which they need to make payments.
   * @param _termInDays Number of days in the credit term. It is used to set the `termEndTime` upon first drawdown.
   *  ie. The credit line should be fully paid off {_termIndays} days after the first drawdown.
   * @param _lateFeeApr The additional interest you will pay if you are late. For example, if this is 3%, and your
   *  normal rate is 15%, then you will pay 18% while you are late.
   *
   * Requirements:
   *  You are the admin
   */
  function createPool(
    address _borrower,
    uint256 _juniorFeePercent,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr
  ) external onlyAdmin returns (address) {
    address tranchedPoolImplAddress = config.tranchedPoolAddress();
    address pool = deployMinimal(tranchedPoolImplAddress);
    ITranchedPool(pool).initialize(
      address(config),
      _borrower,
      _juniorFeePercent,
      _limit,
      _interestApr,
      _paymentPeriodInDays,
      _termInDays,
      _lateFeeApr
    );
    emit PoolCreated(pool, _borrower);
    config.getPoolTokens().onPoolCreated(pool);
    return pool;
  }

  function createMigratedPool(
    address _borrower,
    uint256 _juniorFeePercent,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr
  ) external onlyCreditDesk returns (address) {
    address tranchedPoolImplAddress = config.migratedTranchedPoolAddress();
    address pool = deployMinimal(tranchedPoolImplAddress);
    ITranchedPool(pool).initialize(
      address(config),
      _borrower,
      _juniorFeePercent,
      _limit,
      _interestApr,
      _paymentPeriodInDays,
      _termInDays,
      _lateFeeApr
    );
    emit PoolCreated(pool, _borrower);
    config.getPoolTokens().onPoolCreated(pool);
    return pool;
  }

  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
  }

  // Stolen from:
  // https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/packages/lib/contracts/upgradeability/ProxyFactory.sol
  function deployMinimal(address _logic) internal returns (address proxy) {
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

  modifier onlyCreditDesk {
    require(msg.sender == config.creditDeskAddress(), "Only the CreditDesk can call this");
    _;
  }
}
