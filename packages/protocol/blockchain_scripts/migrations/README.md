## Migration documentation

The migration process usually consists of the following steps:

```tsx
export async function main() {
  const effects = await getDeployEffects()
  const {deployedContracts, upgradedContracts} = await deploy(effects)
  await effects.executeDeferred()
  return {deployedContracts, upgradedContracts}
}
```

There are two types of tests: trivial and mainnet_forking tests. Check this .circleci code (see, `-v` for grep):

```tsx
- tests
  tests=$(circleci tests glob "test/**/*.test.ts"| grep -v mainnet_forking | circleci tests split --split-by=timings)
- mainnet_forking
  tests=$(circleci tests glob "test/**/*.test.ts"| grep mainnet_forking | circleci tests split --split-by=timings)
```

If you need to do something specific to the logic

Looks like GF uses this: [Upgrading smart contracts - OpenZeppelin Docs](https://docs.openzeppelin.com/learn/upgrading-smart-contracts)

If I get it right, the first thing is to generate a manifest file `.openzeppelin/ethereum.json` which stores your current state of the deployment (where are proxies etc.). This is handled by [openzeppelin-upgrades/manifest.ts at master · OpenZeppelin/openzeppelin-upgrades (github.com)](https://github.com/OpenZeppelin/openzeppelin-upgrades/blob/master/packages/core/src/manifest.ts)

## Deploy Effects

Deoloy effect got simple interface (but can be like Enum, mb)

```tsx
export interfaceDeployEffects{
  add(effects?:Effects):Promise<void>
  executeDeferred():Promise<void>
}
```

**"immediate"** effects are executed immediately when added using `DeployEffects.add`

effects are collected and executed, possibly in bulk, when `DeployEffects.executeDeferred` is called

Where **PopulatedTransaction** - [https://www.npmjs.com/package/@ethersproject/contracts](https://www.npmjs.com/package/@ethersproject/contracts)

```tsx
export typeEffects= {
immediate?: PopulatedTransaction[]
deferred?: PopulatedTransaction[]
}
```

**functionchangeImplementations** change implementations when they are updated

```tsx
export async functionchangeImplementations({contracts}: {contracts:UpgradedContracts}):Promise<Effects> {
constpartialTxs =awaitPromise.all(
    Object.keys(contracts).map(async(contractName) => {
constcontractHolder = contracts[contractName]
assertNonNullable(contractHolder, "contractHolder is undefined")
constproxy = contractHolder.ProxyContract.connect(awaitgetProtocolOwner())
// hardhat-deploy changed the method name in newer versions
constupgradeMethod =
        proxy.populateTransaction["changeImplementation"] || proxy.populateTransaction["upgradeToAndCall"]
assertNonNullable(upgradeMethod, `upgradeMethod is undefined for ${contractName}`)
constunsignedTx =awaitupgradeMethod(contractHolder.UpgradedImplAddress, "0x")
returnunsignedTx
    })
  )

return{
    deferred: partialTxs,
  }
}
```

Getting deployment effects like this. Checking if our mainnet is different

```tsx
export async functiongetDeployEffects(params?: {
  via?:string
title?:string
description?:string
}):Promise<DeployEffects> {
constvia = params?.via

if(isMainnetForking()) {
constsafe =awaitgetSafe({via})
return newMainnetForkingMultisendEffects({safe})
  }else if((awaitcurrentChainId()) === LOCAL_CHAIN_ID) {
return newIndividualTxEffects()
  }else{
constchainId =awaithre.getChainId()
assertIsChainId(chainId)
return newDefenderMultisendEffects({chainId, via, title: params?.title, description: params?.description})
  }
}
```

## Deploy

deploy.ts

1. Deploy a proxied GoldfinchConfig so we don't need to keep calling updateGoldfinchConfig on an increasing number of contracts
2. Deploy liquidity mining + airdrop contracts
3. Deploy GFI and set staking rewards parameters *and setting additional params*
4. Pause deployed contracts CommunityRewards, MerkleDirectDistributor, StakingRewards

The deploy is just a hardhat script (executable with `npx hardhat run /path/to/migrate.ts`)

## Deferred Execution
