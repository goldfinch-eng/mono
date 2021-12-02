import {findEnvLocal} from "@goldfinch-eng/utils"
import dotenv from "dotenv"
import {
  TEST_MERKLE_DISTRIBUTOR_RECIPIENT_A,
  TEST_MERKLE_DISTRIBUTOR_RECIPIENT_B,
} from "./test/blockchain_scripts/merkle/merkleDistributor/fixtures"
import {
  TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_A,
  TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_B,
} from "./test/blockchain_scripts/merkle/merkleDirectDistributor/fixtures"
import "@openzeppelin/hardhat-upgrades"
import "hardhat-contract-sizer"
dotenv.config({path: findEnvLocal()})
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
const ALCHEMY_RINKEBY_API_KEY = process.env.ALCHEMY_RINKEBY_API_KEY

// *** Uncomment when you actually want to run on mainnet or testnet ****
// const TEST_PROTOCOL_OWNER_KEY = process.env.TESTNET_PROTOCOL_OWNER_KEY
// const TEST_GF_DEPLOYER_KEY = process.env.TESTNET_GF_DEPLOYER_KEY
// const MAINNET_PROTOCOL_OWNER_KEY = process.env.MAINNET_PROTOCOL_OWNER_KEY
// const MAINNET_GF_DEPLOYER_KEY = process.env.MAINNET_GF_DEPLOYER_KEY

if (process.env.HARDHAT_FORK) {
  process.env["HARDHAT_DEPLOY_FORK"] = process.env.HARDHAT_FORK
}

export default {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      timeout: 1800000,
      accounts: {mnemonic: "test test test test test test test test test test test junk"},
      forking: process.env.HARDHAT_FORK
        ? {
            url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
            blockNumber: 13641069, // Nov-18-2021 07:04:36 PM +UTC
          }
        : undefined,
    },
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_RINKEBY_API_KEY}`,
      // accounts: [`${TEST_PROTOCOL_OWNER_KEY}`, `${TEST_GF_DEPLOYER_KEY}`],
    },
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      // Uncomment when you actually want to run mainnet. Hardhat freaks out otherwise because the private keys are undefined in the default case
      // accounts: [`${MAINNET_PROTOCOL_OWNER_KEY}`, `${MAINNET_GF_DEPLOYER_KEY}`],
    },
    murmuration: {
      url: "https://murmuration.goldfinch.finance/_chain",
      chainId: 31337,
      accounts: {mnemonic: "test test test test test test test test test test test junk"},
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
    ],
  },
  namedAccounts: {
    protocol_owner: {
      default: 0,
      1: "0xc840B3e21FF0EBA77468AD450d868D4362cF67fE",
      4: "0x83CB0ec2f0013a9641654b344D34615f95b7D7FC",
    },
    gf_deployer: {
      default: 1,
      1: "0xa083880F7a5df37Bf00a25380C3eB9AF9cD92D8f",
      4: "0xf3c9B38c155410456b5A98fD8bBf5E35B87F6d96",
    },
    temp_multisig: {
      1: "0x60d2be34bce277f5f5889adfd4991baefa17461c",
      31337: "0x60d2be34bce277f5f5889adfd4991baefa17461c",
    },
    test_merkle_distributor_recipient_a: {
      hardhat: TEST_MERKLE_DISTRIBUTOR_RECIPIENT_A,
    },
    test_merkle_distributor_recipient_b: {
      hardhat: TEST_MERKLE_DISTRIBUTOR_RECIPIENT_B,
    },
    test_merkle_direct_distributor_recipient_a: {
      hardhat: TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_A,
    },
    test_merkle_direct_distributor_recipient_b: {
      hardhat: TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_B,
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
  tenderly: {
    project: "goldfinch-protocol",
    username: "goldfinch",
    forkNetwork: "1", //Network id of the network we want to fork
  },
  contractSizer: {
    runOnCompile: true,
  },
}
