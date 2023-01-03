import hre from "hardhat"
const {deployments, ethers} = hre
import {getSignerForAddress} from "../blockchain_scripts/deployHelpers"
import {CONFIG_KEYS_BY_TYPE} from "./configKeys"

async function main() {
  const configAddress = process.env.CONFIG_ADDRESS || (await deployments.get("GoldfinchConfig")).address
  const {gf_deployer} = await hre.getNamedAccounts()
  const signer = await getSignerForAddress(gf_deployer)
  const config = await ethers.getContractAt("GoldfinchConfig", configAddress, signer)

  console.log(`GoldfinchConfig (${config.address})`)
  console.log("------------------------------------------------------------")

  for (const configKey of Object.keys(CONFIG_KEYS_BY_TYPE.numbers)) {
    console.log(`${configKey} =`, String(await config.getNumber(CONFIG_KEYS_BY_TYPE.numbers[configKey])))
  }

  for (const configKey of Object.keys(CONFIG_KEYS_BY_TYPE.addresses)) {
    console.log(`${configKey} =`, String(await config.getAddress(CONFIG_KEYS_BY_TYPE.addresses[configKey])))
  }
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default main
