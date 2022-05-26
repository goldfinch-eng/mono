---
sidebar_position: 4
---

# Oracles

The Goldfinch Protocol does not use oracles -- understood as on-chain "sources of truth" about off-chain data -- operated by untrusted third parties.

The Goldfinch Protocol does use an oracle operated by Warbler Labs, in the form of the UID tokens minted by the [UniqueIdentity](./contracts/core/UniqueIdentity) contract. UID tokens are non-transferrable and describe the off-chain identity to which the chain address that owns the token corresponds. Warbler Labs possesses the permission required by the UniqueIdentity contract to mint and burn UID tokens. Warbler Labs allows a user of the Protocol to mint their UID token after satisfying the identity verification requirements corresponding to their identity type (e.g. non-U.S. individual).

The Goldfinch Protocol does make use of on-chain data sources that are external to the Protocol but which are not oracles. For example, the Protocol integrates with the Curve pool for FIDU/USDC.

