![Warbler-Logo](../../warbler-logo.png)

# Pool Token Splitting Audit 01/26/23

Auditors: [Carter](https://github.com/carterappleton)

## Overview

Pool Token Splitting is a new feature to allow participants to split their pool tokens into two new, differently sized pool tokens. This enables more complex protocol features.

## Scope

The audit's focus is on these contracts

- PoolTokens.sol
- BackerRewards.sol

## Summary of findings

Nothing serious found.

There is a future risk if a maintainer changes `_mint` to `_safeMint`. This is called out in the PoolTokens contract sub-audit.
