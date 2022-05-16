---
sidebar_position: 7
---

# Flashloans

As a technique for manipulating the state of smart contracts, flashloans are a possibility inherent in the design of Ethereum. The Goldfinch Protocol is designed with this possibility in mind, which is to say, it is designed so that flashloans can't adversely affect the Protocol.

Consider the levers that a user of the Protocol can pull, so to speak. A user can:
- as a lender
  - supply into the [SeniorPool](./contracts/core/SeniorPool)
  - withdraw their supplied capital (plus interest) from the SeniorPool
  - supply into a [TranchedPool](./contracts/core/TranchedPool)
  - withdraw their supplied capital (plus interest) from a TranchedPool
  - zap their supplied capital from the SeniorPool into a TranchedPool, and vice versa
  - zap their supplied capital from the SeniorPool into the Curve pool for FIDU/USDC
  - stake FIDU tokens, via [StakingRewards](./contracts/rewards/StakingRewards), to earn GFI
  - unstake FIDU tokens
  - stake Curve LP tokens, via StakingRewards, to earn GFI
  - unstake Curve LP tokens
- as a borrower
  - drawdown from their TranchedPool
  - repay to their TranchedPool
- as a lender or borrower
  - claim GFI they have earned from participating in the Protocol

Flashloans aim to use the borrowed amount to accomplish some desired side-effect, before the loan is repaid at the end of the transaction (or in the short term, in keeping with the word "flash"). To understand whether flashloans can adversely affect the Protocol, we must answer: are any of the "levers" listed above vulnerable to side-effects that could be accomplished by a flashloan?

This question can be explored by considering these possible user actions in terms of dependencies. What are their dependencies that could be a fruitful target of manipulation? Are they such a dependency of something else?

There are only two known scenarios in which a flashloan might manipulate dependencies. Both are mitigated by the design of the Protocol.

The first scenario is the one noted in the discussion of [Front-running](./front-running), in which a front-runner would supply into the SeniorPool just before a borrower repays interest. The front-runner might try to combine this strategy with a flashloan, to achieve an outsized position in the SeniorPool, thereby enabling them to claim an outsized portion of the repaid interest. (Considered in terms of "dependencies", the flashloan here is used to manipulate the size of the user's position in the SeniorPool, which is a logical dependency of how much interest they can claim.) As noted in that discussion, though, because of the Protocol's 0.5% withdrawal fee, this strategy is unprofitable so long as the interest payment is not greater than 0.5% of the amount in the SeniorPool. This is so, regardless of how large a position in the SeniorPool the front-runner manages to achieve via their flashloan.

The second scenario involves the staking of Curve LP tokens, to earn GFI. Stakers of Curve LP tokens earn an amount of GFI calculated by first converting their amount of staked Curve LP tokens into an "effective amount" of FIDU, and then multiplying by the amount of GFI earned per FIDU (see [StakingRewards](./contracts/rewards/StakingRewards)). Curve LP tokens are converted to an effective amount of FIDU by calculating the ratio of FIDU vs. LP tokens in the Curve pool, as this represents the implicit price at which one LP token trades against FIDU. A flashloan might seek to manipulate this conversion rate (by affecting either the numerator (i.e. amount of FIDU in the pool) or denominator (i.e. amount of LP tokens)) at the time of staking the user's Curve LP tokens, to artifically boost the user's effective amount of FIDU and therefore the amount of GFI earned thereafter. This possibility is mitigated by imposing an upper bound on the conversion rate that the Protocol respects.
