---
sidebar_position: 11
---

# Front-running

Front-running of transactions is a possibility inherent in the design of Ethereum. The Goldfinch Protocol is designed with this possibility in mind.

Front-running as a concern is applicable only to state-changing functions. View functions have no effect on chain state, so front-running them can have no impact.

The state-changing functions in the Protocol's smart contracts can be distinguished into two kinds: *permissioned*, and *non-permissioned*. Permissioned functions may only be executed by accounts possessing the required permission.

For the Protocol's *permissioned* functions, front-running does not pose a known risk to the Protocol's intended functioning. Front-runner or not, an account can only call a permissioned function successfully if the account possesses the requisite permission. Of the permissioned functions that an account may have permission to call, are there any which it would be advantageous to call as a front-run of some other Protocol participant's transaction? There is only one known scenario[^1] in which this could be advantageous in theory, but it is mitigated in practice by the Protocol's 0.5% withdrawal fee.

For the Protocol's *non-permissioned* functions (e.g. `TranchedPool.assess()`), the design of these functions is such that they cannot be front-run in a meaningful sense, because no caller of them is more special or worthy of earlier execution than any other caller. A situation in which a front-runner, having observed that someone else wants to call some function, tries to front-run that with their own call of a non-permissioned function, is indistinguishable from the operation of the Protocol under circumstances in which participants are not observing each other's transactions.

[^1] The scenario is this: imagine a front-runner who front-runs a borrower's repayment of interest to a TranchedPool, supplying into the SeniorPool ahead of the borrower's repayment. The front-runner thereby effectively receives a share of the repaid interest, in proportion to the front-runner's position in the SeniorPool. The front-runner might be inclined to immediately withdraw their position in the SeniorPool, to minimize their risk exposure. But the Protocol imposes a 0.5% fee on withdrawals. This fee makes such a strategy unprofitable for the front-runner, as long as the repaid interest does not represent more than 0.5% of the total amount in the SeniorPool. As of this writing (May 2022), this condition safely holds, as the largest interest payment to the Protocol represents approximately 0.22% of the total amount in SeniorPool.
