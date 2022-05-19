---
sidebar_position: 6
---

# Upgradeability

Many contracts in the Goldfinch Protocol are upgradeable. Upgradeability facilitates extending the Protocol's functionality.

The set of contracts in the Protocol that are upgradeable can be identified as those contracts that inherit from the [BaseUpgradeablePausable](./contracts/core/BaseUpgradeablePausable), [ERC721PresetMinterPauserAutoIdUpgradeSafe](https://github.com/goldfinch-eng/mono/blob/main/packages/protocol/contracts/external/ERC721PresetMinterPauserAutoId.sol), or [ERC1155PresetPauserUpgradeable](https://github.com/goldfinch-eng/mono/blob/main/packages/protocol/contracts/external/ERC1155PresetPauserUpgradeable.sol) contract.

As of this writing (May 2022), the Protocol's upgradeable contracts are:
- [CreditLine](./contracts/core/CreditLine)
- [DynamicLeverageRatioStrategy](./contracts/core/DynamicLeverageRatioStrategy)
- [Fidu](./contracts/core/Fidu)
- [FixedLeverageRatioStrategy](./contracts/core/FixedLeverageRatioStrategy)
- [Go](./contracts/core/Go)
- [GoldfinchConfig](./contracts/core/GoldfinchConfig)
- [GoldfinchFactory](./contracts/core/GoldfinchFactory)
- [PoolTokens](./contracts/core/PoolTokens)
- [SeniorPool](./contracts/core/SeniorPool)
- [TranchedPool](./contracts/core/TranchedPool)
- [UniqueIdentity](./contracts/core/UniqueIdentity)
- [Zapper](./contracts/core/Zapper)

The Protocol's non-upgradeable contracts are:
- [GFI](./contracts/core/GFI)

The Protocol's upgradeable contracts use OpenZeppelin's [proxy upgrade pattern](https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies).

The Protocol's upgradeable contracts are upgradeable only by Governance.
