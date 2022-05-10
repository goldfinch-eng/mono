---
sidebar_position: 11
---

# Front-running

Front-running of transactions is a possibility inherent in the design of Ethereum. The Goldfinch Protocol has been designed with this possibility in mind.

Front-running as a concern is applicable only to state-changing functions. View functions have no effect on chain state, so front-running them can have no impact.

The state-changing functions in the Protocol's smart contracts can be distinguished into two kinds: permissioned, and non-permissioned. Permissioned functions may only be exected by accounts possessing the required permission.

For the Protocol's permissioned functions, front-running does not pose a risk to the Protocol's intended functioning. Front-runners cannot call those functions successfully; only the permissioned accounts can.

For the Protocol's non-permissioned functions (e.g. `TranchedPool.assess()`), the design of these functions is such that they cannot be front-run in a meaningful sense, because no caller of them is more special or worthy of earlier execution than any other caller. While it is always possible, due to the transparent nature of transactions in the Ethereum mempool, for someone to observe that someone else wants to interact with the Protocol in a certain way, and to send with higher priority a transaction that duplicates (or not) the original transaction, this does not pose a risk to the intended functioning of the Protocol. Indeed, it is indistinguishable from the operation of the Protocol under circumstances in which participants are not observing each other's transactions.
