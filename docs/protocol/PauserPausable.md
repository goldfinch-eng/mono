## `PauserPausable`

Inheriting from OpenZeppelin's Pausable contract, this does small
augmentations to make it work with a PAUSER_ROLE, leveraging the AccessControl contract.
It is meant to be inherited.





### `__PauserPausable__init()` (public)





### `pause()` (public)



Pauses all functions guarded by Pause

See {Pausable-_pause}.

Requirements:

- the caller must have the PAUSER_ROLE.

### `unpause()` (public)



Unpauses the contract

See {Pausable-_unpause}.

Requirements:

- the caller must have the Pauser role


