## `GoldfinchConfig`

This contract stores mappings of useful "protocol config state", giving a central place
for all other contracts to access it. For example, the TransactionLimit, or the PoolAddress. These config vars
are enumerated in the `ConfigOptions` library, and can only be changed by admins of the protocol.





### `initialize(address owner)` (public)





### `setAddress(uint256 addressKey, address newAddress)` (public)





### `setNumber(uint256 number, uint256 newNumber)` (public)





### `setCreditLineImplementation(address newCreditLine)` (public)





### `setTreasuryReserve(address newTreasuryReserve)` (public)





### `getAddress(uint256 addressKey) → address` (public)





### `getNumber(uint256 number) → uint256` (public)






### `AddressUpdated(address owner, string name, address oldValue, address newValue)`





### `NumberUpdated(address owner, string name, uint256 oldValue, uint256 newValue)`





