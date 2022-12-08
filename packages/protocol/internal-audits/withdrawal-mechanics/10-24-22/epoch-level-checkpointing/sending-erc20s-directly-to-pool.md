# Sending ERC20s directly to the SeniorPool

Auditor: [Dalton](https://github.com/daltyboy11)

This section analyzes the effect of sending ERC20's directly to the senior pool. How does it
affect the pool's accounting? Does the pool rely on direct balance checks anywhere?

## Direct USDC transfers

We should in the invariant analysis section that a direct USDC transfer increases the pool's usdc
balance while keeping \_usdcAvailable the same, and this doesn't violate any invariants. The usdc
sent to the pool is lost and cannot be used for investments or withdrawal allocations, but withdrawal
mechanics are unaffected

## Direct FIDU transfers

Withdrawal Mechanics logic always operates on an epoch's fiduRequested variable. It never queries
for the Senior Pool's fidu balance directly. Consequently, direct fidu transfers have no effect
on withdrawal mechanics.

All it does it make that fidu irrecoverable, and since the fidu is irrecoverable, the senior pool
no longer has to fulfill that obligation.

## Direct transfers of other ERC20's

Holding other ERC20's has no effect on withdrawal mechanics because it only uses USDC and FIDU.
