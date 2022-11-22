# Router

Central repository for getting contracts relevant for cake

## Functions

### `initialize`
 * Uses `initializer` modifier
 Sets the access control key so that `setContract` can use check if the caller is an admin

### `setContract`

* Set a key to a specific contract
* Requires that the caller is an admin, determined by the access control contract
* ! Router does not emit an event when a contract is updated


## Issues
* 🟢 No event is emitted when `setContract` is called