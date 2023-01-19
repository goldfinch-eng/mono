pragma solidity >=0.6.12;

import {ILoan} from "./ILoan.sol";

interface ICallableLoan is ILoan {
  // All call request periods are initialized into a sequential array during
  // contract initialization.
  struct CallRequestPeriod {
    uint256 callRequestedTotal;
    uint256 callRequestRepayments;
    // startDatetime and index are probably derivable from CallRequestPeriod
    // index in most calling contexts.
    uint256 startDatetime;
    uint256 index;
  }

  /// @notice Submits a call request for the specified pool token and amount
  ///         Mints a new, called pool token of the called amount.
  ///         Splits off any uncalled amount as a new uncalled pool token.
  /// @param amountToCall The amount of the pool token that should be called.
  /// @param poolTokenId The id of the pool token that should be called.
  function call(uint256 amountToCall, uint256 poolTokenId) external;
}
