---
sidebar_position: 5
---

# Pausability

All of the Core and Periphery contracts in the Goldfinch Protocol are pausable.

All of the GFI Distribution contracts are also pausable, with the exception of the [MerkleDistributor](./contracts/rewards/MerkleDistributor) and [BackerMerkleDistributor](./contracts/rewards/BackerMerkleDistributor) contracts, which are indirectly pausable because their only state-changing function depends on the [CommunityRewards](./contracts/rewards/CommunityRewards) contract, which is pausable.

Pausability is a security countermeasure. In the event of an emergency, a pausable contract can be paused, to halt the execution of its functions that respect its paused status.

All pausable Core and GFI Distribution contracts in the Protocol are pausable and unpausable by Governance, and some are pausable on an immediate basis via a signer pre-approved by Governance. Of the Protocol's Periphery contracts, a deployed instance of the [Borrower](./contracts/periphery/Borrower) contract is pausable and unpausable by its owner: the borrower to which it belongs. The remaining Periphery contracts are pausable and unpausable by Governance.
