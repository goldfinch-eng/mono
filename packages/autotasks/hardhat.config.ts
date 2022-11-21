import "tsconfig-paths/register"
import "@nomiclabs/hardhat-truffle5"
import "@nomiclabs/hardhat-ethers"
import "hardhat-deploy"
import baseConfig from "@goldfinch-eng/protocol/hardhat.config.base"

const config = {
  ...baseConfig,
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
    },
  },
}

export default config
