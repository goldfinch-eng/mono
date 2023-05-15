## PauserPausable

Inheriting from OpenZeppelin's Pausable contract, this does small
 augmentations to make it work with a PAUSER_ROLE, leveraging the AccessControl contract.
 It is meant to be inherited.

### PAUSER_ROLE

```solidity
bytes32 PAUSER_ROLE
```

### __PauserPausable__init

```solidity
function __PauserPausable__init() public
```

### pause

```solidity
function pause() public
```

_Pauses all functions guarded by Pause

See {Pausable-_pause}.

Requirements:

- the caller must have the PAUSER_ROLE._

### unpause

```solidity
function unpause() public
```

_Unpauses the contract

See {Pausable-_unpause}.

Requirements:

- the caller must have the Pauser role_

### onlyPauserRole

```solidity
modifier onlyPauserRole()
```

