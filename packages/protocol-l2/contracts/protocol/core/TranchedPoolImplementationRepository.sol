// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;
pragma experimental ABIEncoderV2;

// solhint-disable-next-line max-line-length
import {VersionedImplementationRepository} from "./proxy/VersionedImplementationRepository.sol";

contract TranchedPoolImplementationRepository is VersionedImplementationRepository {}
