// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

import {Base} from "../../cake/Base.sol";
import {Context} from "../../cake/Context.sol";
import {AccessControl} from "../../cake/AccessControl.sol";
import {Router} from "../../cake/Router.sol";
import "../../cake/Routing.sol" as Routing;

using TestRouting for Context;

library TestRoutingKeys {
  bytes4 internal constant TestContractKey = bytes4(keccak256(abi.encode("TestContract")));
  bytes4 internal constant TestContractDependencyKey =
    bytes4(keccak256(abi.encode("TestContractDependency")));
  bytes4 internal constant TestContractDependency2Key =
    bytes4(keccak256(abi.encode("TestContractDependency2")));
  bytes4 internal constant TestContractDependency3Key =
    bytes4(keccak256(abi.encode("TestContractDependency3")));
}

library TestRouting {
  function testContract(Context context) internal view returns (TestContract) {
    return TestContract(context.router().contracts(TestRoutingKeys.TestContractKey));
  }

  function testContractDependency(Context context) internal view returns (TestContractDependency) {
    return
      TestContractDependency(context.router().contracts(TestRoutingKeys.TestContractDependencyKey));
  }

  function testContractDependency2(
    Context context
  ) internal view returns (TestContractDependency2) {
    return
      TestContractDependency2(
        context.router().contracts(TestRoutingKeys.TestContractDependency2Key)
      );
  }

  function testContractDependency3(
    Context context
  ) internal view returns (TestContractDependency3) {
    return
      TestContractDependency3(
        context.router().contracts(TestRoutingKeys.TestContractDependency3Key)
      );
  }
}

contract TestContractDependency3 is Base {
  constructor(Context _context) Base(_context) {}

  function callChainLength0() public onlyOperator(TestRoutingKeys.TestContractDependency2Key) {}
}

contract TestContractDependency2 is Base {
  constructor(Context _context) Base(_context) {}

  function callChainLength0() public onlyOperator(TestRoutingKeys.TestContractDependencyKey) {}

  function callChainLength1() public onlyOperator(TestRoutingKeys.TestContractDependencyKey) {
    TestContractDependency3 dep = context.testContractDependency3();
    dep.callChainLength0();
  }
}

contract TestContractDependency is Base {
  constructor(Context _context) Base(_context) {}

  function callChainLength0() public onlyOperator(TestRoutingKeys.TestContractKey) {}

  function callChainLength1() public onlyOperator(TestRoutingKeys.TestContractKey) {
    TestContractDependency2 dep = context.testContractDependency2();
    dep.callChainLength0();
  }

  function callChainLength2() public onlyOperator(TestRoutingKeys.TestContractKey) {
    TestContractDependency2 dep = context.testContractDependency2();
    dep.callChainLength1();
  }
}

contract TestContract is Base {
  constructor(Context _context) Base(_context) {}

  function contextlessFunction() public {}

  function callChainLength0() public {}

  function callChainLength1() public {
    TestContractDependency dep = context.testContractDependency();
    dep.callChainLength0();
  }

  function callChainLength2() public {
    TestContractDependency dep = context.testContractDependency();
    dep.callChainLength1();
  }

  function callChainLength3() public {
    TestContractDependency dep = context.testContractDependency();
    dep.callChainLength2();
  }

  function serviceGet() public {
    TestContractDependency dep = context.testContractDependency();
  }

  function serviceGet2() public {
    TestContractDependency dep = context.testContractDependency();
    TestContractDependency2 dep2 = context.testContractDependency2();
  }

  function serviceGet3() public {
    TestContractDependency dep = context.testContractDependency();
    TestContractDependency2 dep2 = context.testContractDependency2();
    TestContractDependency3 dep3 = context.testContractDependency3();
  }
}

contract CakeTest is Test {
  Context context;
  Router router;
  AccessControl accessControl;
  TestContract testContract;
  TestContractDependency testContractDependency;
  TestContractDependency2 testContractDependency2;
  TestContractDependency3 testContractDependency3;

  function setUp() public {
    // NOTE: Router and AccessControl should be proxied under normal circumstances
    accessControl = new AccessControl();
    accessControl.initialize(address(this));

    router = new Router();
    router.initialize(accessControl);
    accessControl.setAdmin(address(router), address(this));

    context = new Context(router);

    testContract = new TestContract(context);
    router.setContract(TestRoutingKeys.TestContractKey, address(testContract));

    testContractDependency = new TestContractDependency(context);
    router.setContract(TestRoutingKeys.TestContractDependencyKey, address(testContractDependency));

    testContractDependency2 = new TestContractDependency2(context);
    router.setContract(
      TestRoutingKeys.TestContractDependency2Key,
      address(testContractDependency2)
    );

    testContractDependency3 = new TestContractDependency3(context);
    router.setContract(
      TestRoutingKeys.TestContractDependency3Key,
      address(testContractDependency3)
    );
  }

  function testContextlessFunction() public {
    testContract.contextlessFunction();
  }

  function testCallChainLength0() public {
    testContract.callChainLength0();
  }

  function testCallChainLength1() public {
    testContract.callChainLength1();
  }

  function testCallChainLength2() public {
    testContract.callChainLength2();
  }

  function testCallChainLength3() public {
    testContract.callChainLength3();
  }

  function testServiceGet() public {
    testContract.serviceGet();
  }

  function testServiceGet2() public {
    testContract.serviceGet2();
  }

  function testServiceGet3() public {
    testContract.serviceGet3();
  }
}
