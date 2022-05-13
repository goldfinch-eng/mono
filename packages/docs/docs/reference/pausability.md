---
sidebar_position: 4
---

# Pausability

All of the Core and Periphery contracts in the Goldfinch Protocol are pausable.

All of the GFI Distribution contracts are also pausable, with the exception of the [MerkleDistributor](./contracts/rewards/MerkleDistributor) and [BackerMerkleDistributor](./contracts/rewards/BackerMerkleDistributor) contracts, which are indirectly pausable because their only state-changing function depends on the [CommunityRewards](./contracts/rewards/CommunityRewards) contract, which is pausable.

Pausability is a security countermeasure. In the event of an emergency, a pausable contract can be paused, to halt the execution of its functions that respect its paused status.

All pausable contracts in the Goldfinch Protocol are pausable only by Governance, with the exception of deployed instances of the [Borrower](./contracts/periphery/Borrower) contract. The Borrower contract is pausable by its owner (i.e. the borrower to which it belongs).
