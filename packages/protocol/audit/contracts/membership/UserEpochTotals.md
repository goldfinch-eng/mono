
# UserEpochTotals

## `UserEpochTotal`

a struct that wraps logic for checkpoint how much a user has of something in
that's elligible in a given epoch. When a user first deposits the amount will be
count towards the total amount, but not the "elligible" amount. When an epoch is
crossed over the total amount becomes the ellible amount.


### `recordIncrease`
- [x] checkpoints
* Increases the amount and checkpoints if we crossed an epoch

### `recordDecrease`
- [x] checkpoints
Looks good

### `getTotals`
- [x] checkpoints
* Returns the totals