/* eslint-disable prettier/prettier */
import "tsconfig-paths/register"
import "@typechain/hardhat"
import "@nomiclabs/hardhat-truffle5"
import "@nomiclabs/hardhat-ethers"
import "hardhat-deploy"
import "hardhat-gas-reporter"
import "hardhat-contract-sizer" // npx hardhat size-contracts
import "@tenderly/hardhat-tenderly"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("./hardhat.config.base")

module.exports = config
