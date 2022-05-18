---
sidebar_position: 6
---

# Timelock

The Goldfinch Protocol does not use timelocks inside its smart contracts. In practice, administration of the Protocol's smart contracts is subject to a minimum time constraint arising from the following facts:
1. That administration is controlled exclusively by the Governance multi-sig wallet.
2. The Governance multi-sig wallet is configured such that at least 6 out of 10 account signatures are necessary to sign a wallet transaction.
3. Each of the Governance multi-sig wallet's 10 accounts is controlled by a different person.
