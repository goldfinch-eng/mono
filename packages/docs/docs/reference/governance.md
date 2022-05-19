---
sidebar_position: 3
---

# Governance

All of the Goldfinch Protocol's smart contracts are controlled exclusively by the Governance multi-sig wallet (address [0xBEb28978B2c755155f20fd3d09Cb37e300A6981f](https://etherscan.io/address/0xBEb28978B2c755155f20fd3d09Cb37e300A6981f)), with the exception of deployments of the Borrower contract, which are each controlled by the borrower for whom it was created.

The Governance multi-sig wallet is configured such that at least 6 out of 10 account signatures are necessary to sign a wallet transaction. Each of the Governance multi-sig wallet's 10 accounts is controlled by a different person.

The administrative actions available to Governance on the Protocol's smart contracts are identifiable as those whose successful execution requires the caller to have the `OWNER_ROLE`, or another role (e.g. `PAUSER_ROLE`) which was previously assigned to the Governance wallet address. This is typically accomplished using a function modifier (e.g. `onlyAdmin` for requiring the `OWNER_ROLE`).
