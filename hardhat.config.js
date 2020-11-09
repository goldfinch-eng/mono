require("@nomiclabs/hardhat-truffle5")
require("@nomiclabs/hardhat-ethers")
require("hardhat-deploy")

const INFURA_PROJECT_ID = "d8e13fc4893e4be5aae875d94fee67b7"
// Note this came from a new instance of Metamask that Blake set up
const TEST_PROTOCOL_OWNER_KEY = "1774a8ac43395488c6856114659042665ee7267293744d7dc1411d31253e642b"
const TEST_PROXY_OWNER_KEY = "f0dd5813eeba1588f31cb0f129cd3b42b3ad6646689f52b051bdd5d4b57e929e"
const MAINNET_PROTOCOL_OWNER_KEY = process.env.MAINNET_PROTOCOL_OWNER_KEY
const MAINNET_PROXY_OWNER_KEY = process.env.MAINNET_PROXY_OWNER_KEY

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      timeout: 1800000,
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
    version: "0.6.8",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  namedAccounts: {
    protocol_owner: {
      default: 0,
      1: "0xc840B3e21FF0EBA77468AD450d868D4362cF67fE",
      3: "0x83CB0ec2f0013a9641654b344D34615f95b7D7FC",
      4: "0x83CB0ec2f0013a9641654b344D34615f95b7D7FC",
    },
    proxy_owner: {
      default: 1,
      1: "0xa083880F7a5df37Bf00a25380C3eB9AF9cD92D8f",
      3: "0xf3c9B38c155410456b5A98fD8bBf5E35B87F6d96",
      4: "0xf3c9B38c155410456b5A98fD8bBf5E35B87F6d96",
    },
  },
}
