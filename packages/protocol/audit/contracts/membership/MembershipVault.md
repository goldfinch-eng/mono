
# MembershipVault

## Functions

### `adjustHoldings`

* Only callable by the membership director

Set the amount eligible for the current epoch as well as the amount eligible for the next epoch


### `_checkpoint`

* carries forward the total balances into future epochs from the 
  epoch following the last checkpointed epoch
* promotes a users nextBalance to their elligible balance and updates the last
  epoch checkpointed cursor

