// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../protocol/core/SeniorPool.sol";

contract TestSeniorPool is SeniorPool {
  function _getNumShares(uint256 amount) public view returns (uint256) {
    return getNumShares(amount);
  }

  function usdcMantissa() public pure returns (uint256) {
    return _usdcMantissa();
  }

  function fiduMantissa() public pure returns (uint256) {
    return _fiduMantissa();
  }

  function usdcToFidu(uint256 amount) public pure returns (uint256) {
    return _usdcToFidu(amount);
  }

  function _setSharePrice(uint256 newSharePrice) public returns (uint256) {
    sharePrice = newSharePrice;
  }

  function epochAt(uint256 id) external view returns (Epoch memory) {
    Epoch memory current = currentEpoch();
    require(id <= current.id, "ID");

    if (id == current.id) {
      // The current epoch
      return current;
    } else if (id < _checkpointedEpochId) {
      // A past epoch already written to storage. Return the storage value.
      return _epochs[id];
    } else {
      if (id == _checkpointedEpochId) {
        // A past epoch partially written to storage
        Epoch memory epoch = _epochs[id];
        epoch.sharePrice = sharePrice;
        epoch.fiduRemaining = epoch.fiduRequested;
        epoch.usdcRemaining = epoch.usdcIn;
        return epoch;
      } else {
        // A past epoch not yet written to storage. Any epoch between _checkpointedEpochId + 1 and currentEpoch().id
        // will have then same sharePrice, fiduRequested, fiduRemaining, usdcIn, and usdcRemaining because NO
        // fidu requested, usdc in, or share price altering events have occurred in that time.
        uint256 epochsBetween = current.id.sub(id);
        uint256 secondsBetween = epochsBetween.mul(config.getSeniorPoolWithdrawalEpochDuration());
        return
          Epoch({
            id: id,
            startsAt: current.startsAt.sub(secondsBetween),
            sharePrice: sharePrice,
            fiduRequested: current.fiduRequested,
            usdcIn: current.usdcIn,
            fiduRemaining: current.fiduRequested,
            usdcRemaining: current.usdcIn
          });
      }
    }
  }
}
