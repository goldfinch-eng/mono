---
id: how-the-protocol-works
title: How the Protocol Works
sidebar_position: 2
---

As a decentralized credit protocol, the Goldfinch Protocol is a medium through which lenders and borrowers come together and exchange value across time. This guide explains how the set of smart contracts[^1] that comprise the Protocol work together to accomplish this.

The nexus through which lending and borrowing occurs is the **[TranchedPool](./contracts/core/TranchedPool)** contract. Every loan in the Protocol exists as an instance of this contract, deployed on the blockchain. At a high level, the lifecycle of a loan modeled by the TranchedPool contract is:
1. lenders supply capital to the contract;
2. the borrower draws down (i.e. borrows) this capital, as the principal of the loan;
3. the borrower periodically pays interest on this borrowed principal;
4. the borrower eventually repays the principal;
5. lenders withdraw their portion of the supplied capital, plus their portion of the interest paid by the borrower.

The TranchedPool contract is called "tranched" because it distinguishes two classes of lender capital: **senior** and **junior**.

Junior capital is first-loss capital, in the event of a writedown by the borrower of the value of the loan. Junior capital is supplied by **Backers**, who provide their capital by interacting directly with the contract.

Senior capital is supplied to the TranchedPool contract by the **[SeniorPool](./contracts/core/SeniorPool)** contract. The amount supplied to the tranched pool by the SeniorPool contract is equal to the amount of junior capital supplied to the tranched pool, multiplied by a Protocol-maintained value called the **leverage ratio**, which defines the proportion of senior vs. junior capital in the tranched pool. Currently, the Protocol uses the [**FixedLeverageRatioStrategy**](./contracts/core/FixedLeverageRatioStrategy) contract to provide this leverage ratio value: it is a value set by Governance.[^2]

TranchedPool and SeniorPool are the essence of the Protocol. The remaining contracts in the Protocol exist to support them, in one way or another. Let's explore those other contracts.

Each instance of the TranchedPool contract has its own instance of the [**CreditLine**](./contracts/core/CreditLine) contract. CreditLine models the terms of the loan and is the workhorse for loan mechanics (e.g. calculating interest due, receiving borrower payments).

Supplying to the TranchedPool contract mints, via the [**PoolTokens**](./contracts/core/PoolTokens) contract, an ERC721 token representing the lender's position in the tranched pool. This token confers the ability to withdraw the lender's principal plus their share of interest repaid by the borrower.

[**Fidu**](./contracts/core/Fidu) is an ERC20 contract (ticker: FIDU) for representing user positions in the SeniorPool. FIDU is minted upon supplying USDC to, and burned upon withdrawing USDC from, the SeniorPool. The exchange rate between FIDU and USDC is the `sharePrice` in the Fidu contract. `sharePrice` is incremented upon interest repayments and decremented upon writedowns.

The [**UniqueIdentity**](./contracts/core/UniqueIdentity) and [**Go**](./contracts/core/Go) contracts provide a means for permissioning the actions that a user of the Protocol may take with the TranchedPool and SeniorPool contracts. UniqueIdentity mints and burns UID tokens, ownership of which is required by supplying to and withdrawing from TranchedPool and SeniorPool. The Go contract provides a convenient interface for reading the UniqueIdentity contract.

The [**Zapper**](./contracts/core/Zapper) contract improves Protocol UX by enabling users to move their funds in the Protocol in certain ways without incurring the costs they otherwise would (for example, eliminating the withdrawal fee when moving funds between a TranchedPool and the SeniorPool).

Lastly, the Protocol's governance token provides the foundation from which the Protocol is able to operate in a decentralized fashion. The [**GFI**](./contracts/core/GFI) contract is the non-upgradeable ERC20 contract that provides this governance token (ticker: GFI). GFI is disbursed to Protocol participants in three ways:
- via airdrop
  - [**MerkleDistributor**](./contracts/rewards/MerkleDistributor), [**MerkleDirectDistributor**](./contracts/rewards/MerkleDirectDistributor), [**BackerMerkleDistributor**](./contracts/rewards/BackerMerkleDistributor), [**BackerMerkleDirectDistributor**](./contracts/rewards/BackerMerkleDirectDistributor), and [**CommunityRewards**](./contracts/rewards/CommunityRewards) are the Protocol's contracts for distributing GFI via Merkle trees.
- via the [**StakingRewards**](./contracts/rewards/StakingRewards) contract
  - StakingRewards manages the disbursement of GFI for providers of SeniorPool liquidity. Capital providers earn GFI for staking their FIDU or staking their [Curve LP](https://curve.fi/factory-crypto/23) tokens.
- via the [**BackerRewards**](./contracts/rewards/BackerRewards) contract
  - BackerRewards manages the disbursement of GFI for Backers, i.e. suppliers of junior capital to a TranchedPool. Over the loan term of a TranchedPool, Backers earn GFI upon interest payments by the borrower. Backers earn this GFI at the same rate as disbursed by StakingRewards for staking FIDU, plus an additional amount that depends on the amount of interest repaid. See [here](https://docs.goldfinch.finance/goldfinch/protocol-mechanics/backer-incentives) for further discussion.

[^1]: This guide describes the Protocol's operation as of the time of writing (May 2022). It does not describe legacy / deprecated Protocol functionality.

[^2]: The [DynamicLeverageRatioStrategy](./contracts/core/DynamicLeverageRatioStrategy) contract affords the option that, in future, the Protocol could use for this leverage ratio a value that is verifiably calculated off-chain and that dynamically adjusts to the composition of Backers in a given TranchedPool.
