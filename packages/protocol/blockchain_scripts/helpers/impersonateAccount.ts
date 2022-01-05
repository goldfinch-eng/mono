import {HardhatRuntimeEnvironment} from "hardhat/types"

export async function impersonateAccount(hre: HardhatRuntimeEnvironment, account: string) {
  return await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [account],
  })
}
