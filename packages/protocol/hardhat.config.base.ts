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
import "hardhat-contract-sizer"
import "@openzeppelin/hardhat-upgrades"
import "solidity-docgen"

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
      mining: {
        mempool: {
          order: "fifo",
        },
      },
      allowUnlimitedContractSize: true,
      timeout: 1800000,
      accounts: {mnemonic: "test test test test test test test test test test test junk"},
      chainId: process.env.HARDHAT_FORK === "mainnet" ? 1 : 31337,
      forking: process.env.HARDHAT_FORK
        ? {
            url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
            blockNumber: 14887921, // Jun-02-2022 12:30:03 AM +UTC
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
  mocha: {
    reporter: "list",
  },
  namedAccounts: {
    protocol_owner: {
      default: 0,
      1: "0xc840B3e21FF0EBA77468AD450d868D4362cF67fE",
      4: "0x12B82166fd044aC854D3Fc15C48B5719Ca8Dfb94",
    },
    gf_deployer: {
      default: 1,
      1: "0xa083880F7a5df37Bf00a25380C3eB9AF9cD92D8f",
      4: "0x12B82166fd044aC854D3Fc15C48B5719Ca8Dfb94",
    },
    temp_multisig: {
      1: "0x60d2be34bce277f5f5889adfd4991baefa17461c",
      4: "0x80B9823A6D12Cc00d70E184b2b310d360220E792",
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
  tenderly: {
    project: "goldfinch-protocol",
    username: "goldfinch",
    forkNetwork: "1", //Network id of the network we want to fork
  },
  contractSizer: {
    runOnCompile: true,
    strict: process.env.CI !== undefined,
    except: [":Test.*", ":MigratedTranchedPool$"],
  },
  docgen: {
    // Cf. https://github.com/OpenZeppelin/solidity-docgen/blob/master/src/config.ts
    outputDir: "solidity-docgen-docs",
    pages: "files",
    templates: "docs-templates",
  },
}
