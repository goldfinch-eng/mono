---
id: how-the-protocol-works
title: How the Protocol Works
sidebar_position: 2
---

As a decentralized credit protocol, the Goldfinch Protocol is a medium through with lenders and borrowers come together and exchange value across time. This guide explains how the set of smart contracts[^1] that comprise the Protocol work together to accomplish this.

The nexus through which lending and borrowing occurs is the **[TranchedPool](./contracts/core/TranchedPool)** contract. Every loan in the Protocol exists as an instance of this contract, deployed on the blockchain. At a high level, the lifecycle of a loan modeled by the TranchedPool contract is:
1. lenders supply capital to the contract;
2. the borrower draws down (i.e. borrows) this capital, as the principal of the loan;
3. the borrower periodically pays interest on this borrowed principal;
4. the borrower eventually repays the principal;
5. lenders withdraw their portion of the supplied capital, plus their portion of the interest paid by the borrower.

The TranchedPool contract is called "tranched" because it distinguishes two classes of lender capital: senior and junior.

Junior capital is first-loss capital, in the event of a writedown by the borrower of the value of the loan. Junior capital is supplied by **Backers**, who provide their capital by interacting directly with the contract.

Senior capital is supplied to the tranched pool contract by the **[SeniorPool](./contracts/core/SeniorPool)** contract. The amount supplied to the tranched pool by the SeniorPool contract is equal to the amount of junior capital supplied to the tranched pool, multiplied by a Protocol-maintained value called the **leverage ratio**, which defines the proportion of senior vs. junior capital in the tranched pool. Currently, the Protocol uses the [FixedLeverageRatioStrategy](./contracts/core/FixedLeverageRatioStrategy) contract to provide this leverage ratio value: it is a value set by Governance.[^2]

TranchedPool is really the essence of the Protocol. The remaining contracts in the Protocol exist to support it, in one way or another. Let's explore those other contracts.

TODO[PR]

[^1]: This guide describes the Protocol's operation as of the time of writing (May 2022). It does not describe legacy / deprecated Protocol functionality.

[^2]: The [DynamicLeverageRatioStrategy](./contracts/core/DynamicLeverageRatioStrategy) contract affords the option that, in future, the Protocol could use for this leverage ratio a verifiable, dynamic value calculated off-chain.
