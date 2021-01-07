// solhint-disable-next-line max-line-length
// Based on https://github.com/gnosis/safe-contracts/blob/94f9b9083790495f67b661bfa93b06dcba2d3949/contracts/proxies/GnosisSafeProxy.sol

pragma solidity 0.6.12;
import "./GoldfinchConfig.sol";

interface IProxy {
  function masterCopy() external view returns (address);
}

contract GoldfinchProxy {
  // configAddress and the masterCopyIndex always needs to be first two declared variables, to ensure that it is
  // at the same location in the contracts to which calls are delegated.
  // To reduce deployment costs this variable is internal and needs to be retrieved via `getStorageAt`
  address internal configAddress;
  uint256 internal configMasterCopyIndex;

  constructor(address _configAddress, uint256 _configMasterCopyIndex) public {
    require(_configAddress != address(0), "Invalid config address provided");
    configAddress = _configAddress;
    configMasterCopyIndex = _configMasterCopyIndex;
  }

  /// @dev Fallback function forwards all transactions and returns all received return data.
  fallback() external payable {
    address _masterCopy = GoldfinchConfig(configAddress).getAddress(configMasterCopyIndex);
    // solium-disable-next-line security/no-inline-assembly
    assembly {
      // 0xa619486e == keccak("masterCopy()"). The value is right padded to 32-bytes with 0s
      // This implements the IProxy interface above and returns the mastercopy address when called with masterCopy()
      if eq(calldataload(0), 0xa619486e00000000000000000000000000000000000000000000000000000000) {
        mstore(0, _masterCopy)
        return(0, 0x20)
      }
      calldatacopy(0, 0, calldatasize())
      let success := delegatecall(gas(), _masterCopy, 0, calldatasize(), 0, 0)
      returndatacopy(0, 0, returndatasize())
      if eq(success, 0) {
        revert(0, returndatasize())
      }
      return(0, returndatasize())
    }
  }
}
