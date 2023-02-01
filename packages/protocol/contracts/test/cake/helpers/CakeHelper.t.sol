// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase, var-name-mixedcase

pragma solidity ^0.8.16;

import {Context} from "../../../cake/Context.sol";
import {Router} from "../../../cake/Router.sol";
import {AccessControl} from "../../../cake/AccessControl.sol";

import {Test, stdError} from "forge-std/Test.sol";

contract CakeHelper {
  Context public context;
  Router public router;
  AccessControl public accessControl;

  constructor(address superAdmin) {
    // Set up Cake contracts
    // NOTE: AccessControl and Router are normally deployed via proxy. We deploy them directly.
    accessControl = new AccessControl();
    accessControl.initialize(address(this));
    router = new Router();
    router.initialize(accessControl);
    accessControl.setAdmin(address(router), superAdmin);
    context = new Context(router);

    // Hand over super-admin
    accessControl.setAdmin(address(accessControl), superAdmin);
  }

  function contractFor(bytes4 key) external view returns (address) {
    return router.contracts(key);
  }
}
