---
sidebar_position: 8
---

# Upgradeability

Many contracts in the Goldfinch Protocol are upgradeable. Upgradeability facilitates extending the Protocol's functionality.

The set of contracts in the Protocol that are upgradeable can be identified as those contracts that inherit from either the [BaseUpgradeablePausable](TODO[PR]), [ERC721PresetMinterPauserAutoIdUpgradeSafe](https://github.com/goldfinch-eng/mono/blob/main/packages/protocol/contracts/external/ERC721PresetMinterPauserAutoId.sol), or [ERC1155PresetPauserUpgradeable](https://github.com/goldfinch-eng/mono/blob/main/packages/protocol/contracts/external/ERC1155PresetPauserUpgradeable.sol) contract.

The Protocol's upgradeable contracts use OpenZeppelin's [proxy upgrade pattern](https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies). The Protocol's upgradeable contracts are upgradeable only by Governance.
