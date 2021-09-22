import "tsconfig-paths/register"
import "@nomiclabs/hardhat-truffle5"
import "@nomiclabs/hardhat-ethers"
import "hardhat-deploy"

// eslint-disable-next-line @typescript-eslint/no-var-requires
let config = require("@goldfinch-eng/protocol/hardhat.config.base")

config = {
  ...config,
  paths: {
    artifacts: "../protocol/artifacts",
    cache: "../protocol/cache",
  },
  external: {
    contracts: [
      {
        artifacts: "../protocol/artifacts",
        deploy: "../protocol/deploy",
      },
    ],
    deployments: {
      localhost: ["../protocol/deployments/localhost"],
      mainnet: ["../protocol/deployments/mainnet"],
      rinkeby: ["../protocol/deployments/rinkeby"],
    },
  },
}

module.exports = config
