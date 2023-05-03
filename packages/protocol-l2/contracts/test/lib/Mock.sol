// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

contract Mock {
  // Use this along with vm.mockCall to mock out dependent contracts in tests. Example:
  //
  // contract Test {
  //   ContractUnderTest foo = new ContractUnderTest();
  //
  //   SomeDependency bar = SomeDependency(address(new Mock));
  //
  //   function setup() {
  //     foo.init(bar);
  //   }
  //
  //   function test() {
  //     vm.mockCall(address(bar), abi.encodeWithSelector(SomeDependency.someMethod.selector), ...);
  //
  //     foo.someCall();
  //   }
  // }

  // Implement a fallback to consume non-returning method calls.
  fallback() external payable {}
}

contract Mocked {
  function mock() internal returns (address) {
    return address(new Mock());
  }
}
