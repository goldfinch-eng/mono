// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {Vm} from "forge-std/Vm.sol";
import {IERC20WithName} from "../../interfaces/IERC20WithName.sol";

/// @notice Library for generating signatures for EIP712 depositWithPermit
library DepositWithPermitHelpers {
  bytes32 internal constant PERMIT_TYPEHASH =
    keccak256(
      bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
    );

  bytes32 internal constant EIP712_DOMAIN_HASH =
    keccak256(
      bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    );

  function domainSeparator(IERC20WithName token) internal view returns (bytes32) {
    uint256 chainId;
    // solhint-disable no-inline-assembly
    assembly {
      chainId := chainid()
    }
    return
      keccak256(
        abi.encode(
          EIP712_DOMAIN_HASH,
          keccak256(bytes(token.name())),
          keccak256(bytes("1")),
          chainId,
          address(token)
        )
      );
  }

  function approvalDigest(
    IERC20WithName token,
    address owner,
    address spender,
    uint256 value,
    uint256 nonce,
    uint256 deadline
  ) internal view returns (bytes32) {
    bytes32 domainSeparatorResult = domainSeparator(token);
    return
      keccak256(
        abi.encodePacked(
          bytes1(0x19),
          bytes1(0x01),
          domainSeparatorResult,
          keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonce, deadline))
        )
      );
  }
}
