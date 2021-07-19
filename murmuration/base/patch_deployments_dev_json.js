// `npx hardhat deploy` writes its output under the `"hardhat"` network name by default.
// That does not accord with the deployment config that is output when using the `npx hardhat node`
// command to deploy and serve the network; the `npx hardhat node` command outputs the
// deployment config under the `"localhost"` network name.
//
// Our client code is built around the expectation that the network config is accessible
// under the network name that the blockchain node is running as. In local development,
// and in the murmuration environment, that network name is `"localhost"`.
//
// Thus, the purpose of this script (admittedly a HACK): we overwrite the
// `deployments_dev.json` output by the `npx hardhat deploy` command, replacing the
// `"hardhat"` network name with the `"localhost"` network name expected by the client.

const fs = require("fs")

const path = "client/config/deployments_dev.json"
const rawConfig = fs.readFileSync(path)
const config = JSON.parse(rawConfig)

if (config["31337"]) {
  const conf = config["31337"]
  const confKeys = Object.keys(conf)
  if (confKeys.length === 1 && confKeys[0] === "hardhat") {
    const hardhatConfKeys = Object.keys(conf.hardhat)
    if (
      hardhatConfKeys.length === 3 &&
      hardhatConfKeys.includes("name") &&
      hardhatConfKeys.includes("chainId") &&
      hardhatConfKeys.includes("contracts")
    ) {
      if (conf.hardhat.name === "hardhat") {
        conf.localhost = conf.hardhat
        delete conf.hardhat
        conf.localhost.name = "localhost"

        fs.writeFileSync(path, JSON.stringify(config, null, 2))
      } else {
        throw new Error(`Unexpected name of hardhat network config: ${conf.hardhat.name}`)
      }
    } else {
      throw new Error(`Unexpected keys in hardhat network config: ${hardhatConfKeys}`)
    }
  } else {
    throw new Error(`Unexpected keys in 31337 network config: ${confKeys}`)
  }
} else {
  throw new Error(`Failed to identify network id 31337 among config keys: ${Object.keys(config)}`)
}
