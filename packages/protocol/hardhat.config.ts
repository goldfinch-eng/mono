/* eslint-disable prettier/prettier */
import "tsconfig-paths/register"
import "@typechain/hardhat"
import "@nomiclabs/hardhat-truffle5"
import "@nomiclabs/hardhat-ethers"
import "hardhat-deploy"
import "hardhat-gas-reporter"
import "hardhat-contract-sizer" // npx hardhat size-contracts
import "@tenderly/hardhat-tenderly"

import config from "./hardhat.config.base"

export default config
