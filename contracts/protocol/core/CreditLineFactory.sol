// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./GoldfinchConfig.sol";
import "./BaseUpgradeablePausable.sol";
import "../periphery/Borrower.sol";
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
    Borrower borrower = new Borrower();
    borrower.initialize(owner, config);
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
    address tranchedPoolImplAddress = config.getAddress(uint256(ConfigOptions.Addresses.TranchedPoolImplementation));
    bytes memory bytecode = getMinimalProxyCreationCode(tranchedPoolImplAddress);
    uint256 createdAt = block.timestamp;
    bytes32 salt = keccak256(abi.encodePacked(_borrower, createdAt));

    address pool = create2Deploy(bytecode, salt);
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
    address tranchedPoolImplAddress = config.getAddress(
      uint256(ConfigOptions.Addresses.MigratedTranchedPoolImplementation)
    );
    bytes memory bytecode = getMinimalProxyCreationCode(tranchedPoolImplAddress);
    uint256 createdAt = block.timestamp;
    bytes32 salt = keccak256(abi.encodePacked(_borrower, createdAt));

    address pool = create2Deploy(bytecode, salt);
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
  // https://forum.openzeppelin.com/t/how-to-compute-the-create2-address-for-a-minimal-proxy/3595/3
  function getMinimalProxyCreationCode(address logic) internal pure returns (bytes memory) {
    bytes10 creation = 0x3d602d80600a3d3981f3;
    bytes10 prefix = 0x363d3d373d3d3d363d73;
    bytes20 targetBytes = bytes20(logic);
    bytes15 suffix = 0x5af43d82803e903d91602b57fd5bf3;
    return abi.encodePacked(creation, prefix, targetBytes, suffix);
  }

  function create2Deploy(bytes memory bytecode, bytes32 salt) internal returns (address) {
    address deployment;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      deployment := create2(0, add(bytecode, 32), mload(bytecode), salt)
    }
    return deployment;
  }

  modifier onlyCreditDesk {
    require(msg.sender == config.creditDeskAddress(), "Only the CreditDesk can call this");
    _;
  }
}
