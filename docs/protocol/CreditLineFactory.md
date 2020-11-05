## `CreditLineFactory`

Contract that allows us to follow the minimal proxy pattern for creating CreditLines.
This saves us gas, and lets us easily swap out the CreditLine implementaton.





### `initialize(address owner, contract GoldfinchConfig _config)` (public)





### `createCreditLine(bytes _data) → address` (public)





### `deployMinimal(address _logic, bytes _data) → address proxy` (internal)






