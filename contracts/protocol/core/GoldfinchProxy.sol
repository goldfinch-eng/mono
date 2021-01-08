// solhint-disable-next-line max-line-length
// Based on https://github.com/gnosis/safe-contracts/blob/94f9b9083790495f67b661bfa93b06dcba2d3949/contracts/proxies/GnosisSafeProxy.sol

pragma solidity 0.6.12;
import "./GoldfinchConfig.sol";

interface IProxy {
  function masterCopy() external view returns (address);
}

contract GoldfinchProxy {
  // solhint-disable-next-line max-line-length
  // Based on https://github.com/OpenZeppelin/openzeppelin-contracts/blob/318c4b44eaba2d745ed4a6381c43e03edc53634d/contracts/proxy/UpgradeableProxy.sol#L25
  // We store the variables required by the proxy at particular slots so it doesn't interfere with storage of the
  // actual implementation contracts.
  bytes32 private constant _CONFIG_SLOT = 0xe4c377540a25249f8ddb19e904c94ec9809ed64d822b743ca1ad3811811a3ada;
  bytes32 private constant _CONFIG_INDEX_SLOT = 0xf9217a232c457fc039d6dee19ba3c12c8d2b71d0846fe9b73a7b5f8949e58f6a;

  constructor(address _configAddress, uint256 _configMasterCopyIndex) public {
    require(_configAddress != address(0), "Invalid config address provided");
    assert(_CONFIG_SLOT == bytes32(uint256(keccak256("gfProxy.configAddress")) - 1));
    assert(_CONFIG_INDEX_SLOT == bytes32(uint256(keccak256("gfProxy.configIndex")) - 1));
    bytes32 configAddressSlot = _CONFIG_SLOT;
    bytes32 configIndexSlot = _CONFIG_INDEX_SLOT;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      sstore(configAddressSlot, _configAddress)
      sstore(configIndexSlot, _configMasterCopyIndex)
    }
  }

  /// @dev Fallback function forwards all transactions and returns all received return data.
  fallback() external payable {
    address configAddress;
    uint256 configMasterCopyIndex;

    // solhint-disable-next-line no-inline-assembly
    assembly {
      configAddress := sload(0xe4c377540a25249f8ddb19e904c94ec9809ed64d822b743ca1ad3811811a3ada)
      configMasterCopyIndex := sload(0xf9217a232c457fc039d6dee19ba3c12c8d2b71d0846fe9b73a7b5f8949e58f6a)
    }
    address _masterCopy = GoldfinchConfig(configAddress).getAddress(configMasterCopyIndex);
    // solhint-disable-next-line no-inline-assembly
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
