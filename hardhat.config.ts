/* eslint-disable prettier/prettier */
import "@typechain/hardhat"
import "@nomiclabs/hardhat-truffle5"
import "@nomiclabs/hardhat-ethers"
import "hardhat-deploy"
import "hardhat-gas-reporter"
import "hardhat-contract-sizer" // npx hardhat size-contracts

const INFURA_PROJECT_ID = "d8e13fc4893e4be5aae875d94fee67b7"
// Note this came from a new instance of Metamask that Blake set up
const TEST_PROTOCOL_OWNER_KEY = "1774a8ac43395488c6856114659042665ee7267293744d7dc1411d31253e642b"
const TEST_PROXY_OWNER_KEY = "f0dd5813eeba1588f31cb0f129cd3b42b3ad6646689f52b051bdd5d4b57e929e"

// UNCOMMENT WHEN YOU ACTUALLY WANT TO RUN ON MAINNET
// const MAINNET_PROTOCOL_OWNER_KEY = process.env.MAINNET_PROTOCOL_OWNER_KEY
// const MAINNET_PROXY_OWNER_KEY = process.env.MAINNET_PROXY_OWNER_KEY
if (process.env.HARDHAT_FORK) {
  process.env['HARDHAT_DEPLOY_FORK'] = process.env.HARDHAT_FORK;
}

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      timeout: 1800000,
      accounts: {mnemonic: "test test test test test test test test test test test junk"},
      forking: process.env.HARDHAT_FORK
        ? {
            url: "https://eth-mainnet.alchemyapi.io/v2/EG9mAEw6e3sYDZ6h6oevoe1IaR42B72b",
            blockNumber: 12454297, // Roughly May 17, 2021, 21:18 UTC
          }
        : undefined,
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${TEST_PROTOCOL_OWNER_KEY}`, `0x${TEST_PROXY_OWNER_KEY}`],
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${TEST_PROTOCOL_OWNER_KEY}`, `0x${TEST_PROXY_OWNER_KEY}`],
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      // Uncomment when you actually want to run mainnet. Hardhat freaks out otherwise because the private keys are undefined in the default case
      // accounts: [`${MAINNET_PROTOCOL_OWNER_KEY}`, `${MAINNET_PROXY_OWNER_KEY}`],
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  namedAccounts: {
    protocol_owner: {
      default: 0,
      1: "0xc840B3e21FF0EBA77468AD450d868D4362cF67fE",
      3: "0x83CB0ec2f0013a9641654b344D34615f95b7D7FC",
      4: "0x83CB0ec2f0013a9641654b344D34615f95b7D7FC",
    },
    gf_deployer: {
      default: 1,
      1: "0xa083880F7a5df37Bf00a25380C3eB9AF9cD92D8f",
      3: "0xf3c9B38c155410456b5A98fD8bBf5E35B87F6d96",
      4: "0xf3c9B38c155410456b5A98fD8bBf5E35B87F6d96",
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    currency: "USD",
    src: "contracts/protocol",
  },
  typechain: {
    outDir: "typechain/truffle",
    target: "truffle-v5",
  },
}
