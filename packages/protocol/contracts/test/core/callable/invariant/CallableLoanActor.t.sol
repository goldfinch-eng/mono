// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

struct CallableLoanActorInfo {
  uint256[] tokens;
}

struct CallableLoanActorSet {
  address[] actors;
  mapping(address => bool) saved;
  mapping(address => CallableLoanActorInfo) actorInfo;
}

/// @notice Helper fn's for the CallableLoanActorSet.
///   forEach and reduce are helpful for checking invariants that should
///   hold for every actor and across all actors, respectively
library CallableLoanActorSetLib {
  function add(CallableLoanActorSet storage s, address actor) internal {
    if (!s.saved[actor]) {
      s.actors.push(actor);
      s.saved[actor] = true;
    }
  }

  function contains(CallableLoanActorSet storage s, address actor) internal view returns (bool) {
    return s.saved[actor];
  }

  function count(CallableLoanActorSet storage s) internal view returns (uint256) {
    return s.actors.length;
  }

  /// @notice Execute fn for every actor in the set. The actor's info is also supplied to fn
  function forEach(
    CallableLoanActorSet storage s,
    function(address, CallableLoanActorInfo memory) external fn
  ) internal {
    for (uint i = 0; i < s.actors.length; ++i) {
      address actor = s.actors[i];
      fn(actor, s.actorInfo[actor]);
    }
  }

  /// @notice Reduce over every actor in the set to a single unit256 using reducer
  function reduce(
    CallableLoanActorSet storage s,
    uint256 acc,
    function(uint256, address, CallableLoanActorInfo memory) external returns (uint256) reducer
  ) internal returns (uint256) {
    for (uint i = 0; i < s.actors.length; ++i) {
      address actor = s.actors[i];
      acc = reducer(acc, actor, s.actorInfo[actor]);
    }
    return acc;
  }
}
