import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {ContractDeployer, getProtocolOwner} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

export async function deployConfigProxy(
  deployer: ContractDeployer,
  {deployEffects}: {deployEffects: DeployEffects}
): Promise<GoldfinchConfig> {
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertNonNullable(gf_deployer)
  const protocolOwner = await getProtocolOwner()
  const config = await deployer.deploy<GoldfinchConfig>("GoldfinchConfig", {
    from: gf_deployer,
    proxy: {
      owner: protocolOwner,
      proxyContract: "EIP173Proxy",
      execute: {
        // We use onUpgrade in addition to init because there was a previous (non-proxy) deployment.
        // hardhat-deploy's default behavior is to use onUpgrade instead of init in this case.
        // (see https://github.com/wighawag/hardhat-deploy/blob/df59005b68a829729ec39b3888929a02bd172867/src/helpers.ts#L1079-L1082)
        // init isn't actually used, but required for the typecheck.
        onUpgrade: {
          methodName: "initialize",
          args: [protocolOwner],
        },
        init: {
          methodName: "initialize",
          args: [protocolOwner],
        },
      },
    },
  })
  return config
}
