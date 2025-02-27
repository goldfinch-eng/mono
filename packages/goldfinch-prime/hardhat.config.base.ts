import * as process from "process"

import "@nomicfoundation/hardhat-verify"

import dotenv from "dotenv"
import "hardhat-contract-sizer"
import "@openzeppelin/hardhat-upgrades"
import "solidity-docgen"
import "solidity-coverage"
import {TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS} from "hardhat/builtin-tasks/task-names"
import {subtask} from "hardhat/config"

import {getAttributeForNetwork} from "./blockchain_scripts/deployHelpers/getAttributeForNetwork"
import {getNetworkNameByChainId} from "./blockchain_scripts/deployHelpers/getNetworkNameByChainId"
import {getResourceAddressForNetwork} from "./blockchain_scripts/deployHelpers/getResourceForNetwork"
import {findEnvLocal} from "./blockchain_scripts/helpers/findEnvLocal"
import {TEST_MNEMONIC, TEST_MNEMONIC_ACCOUNTS, TEST_PRIVATE_KEY} from "./config/testMnemonic"

dotenv.config({path: findEnvLocal()})

const forkedChainId = process.env.HARDHAT_FORK_CHAIN_ID ? parseInt(process.env.HARDHAT_FORK_CHAIN_ID) : null

let forkedChainJsonRpcUrl

let forkedBlockNum
const isForking = !!forkedChainId

if (isForking) {
  const networkName = getNetworkNameByChainId(forkedChainId)
  process.env.HARDHAT_DEPLOY_FORK = networkName
  forkedBlockNum = getAttributeForNetwork("Fork Block Number", networkName)
  forkedChainJsonRpcUrl = getAttributeForNetwork("Rpc Url", networkName)
}

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, __, runSuper) => {
  const paths = await runSuper()
  // to make foundry and hardhat co-exist, we are excluding solidity files meant to be
  // be used as foundry tests.
  //
  // Specifically: foundry uses git submodules to pull in dependencies, but hardhat requires
  // any imported dependency to have a corresponding node module. We are explicitly making
  // hardhat not import any foundry file to avoid this issue.
  return paths.filter((p: any) => !p.endsWith(".t.sol") && !p.includes("test/lib"))
})

const config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      mining: {
        mempool: {
          order: "fifo",
        },
      },
      allowUnlimitedContractSize: true,
      accounts: {mnemonic: TEST_MNEMONIC},
      chainId: isForking ? forkedChainId : 31337,
      forking: isForking
        ? {
            url: forkedChainJsonRpcUrl,
            blockNumber: forkedBlockNum,
          }
        : undefined,
    },
    ngrok: {
      url: "https://chain.warbler.ngrok.io",
      chainId: 31337,
    },
    mainnet: {
      url: process.env.MAINNET_JSON_RPC_PROVIDER_URL ?? "http://example.com",
      accounts: [process.env.MAINNET_GF_DEPLOYER_KEY ?? TEST_PRIVATE_KEY],
    },
    arbitrum: {
      url: process.env.ARBITRUM_JSON_RPC_PROVIDER_URL ?? "http://example.com",
      accounts: [process.env.ARBITRUM_GF_DEPLOYER_KEY ?? TEST_PRIVATE_KEY],
      chainId: 42161,
    },
    base: {
      url: getAttributeForNetwork("Rpc Url", "base", ""),
      accounts: [process.env.BASE_GF_DEPLOYER_KEY ?? TEST_PRIVATE_KEY],
      chainId: 8453,
    },
    arbitrumgoerli: {
      url: process.env.ARBITRUMGOERLI_CHAINPROVIDER_URL ?? "http://example.com",
      accounts: [process.env.ARBITRUMGOERLI_GF_DEPLOYER_KEY ?? TEST_PRIVATE_KEY],
    },
    baseSepolia: {
      url: getAttributeForNetwork("Rpc Url", "baseSepolia", ""),
      accounts: [process.env.BASE_SEPOLIA_GF_DEPLOYER_KEY ?? TEST_PRIVATE_KEY],
      chainId: 84532,
    },
    basegoerli: {
      url: process.env.BASEGOERLI_CHAINPROVIDER_URL ?? "http://example.com",
      accounts: [process.env.BASEGOERLI_GF_DEPLOYER_KEY ?? TEST_PRIVATE_KEY],
    },
    goerli: {
      url: process.env.GOERLI_CHAINPROVIDER_URL ?? "http://example.com",
      accounts: [process.env.GOERLI_GF_DEPLOYER_KEY ?? TEST_PRIVATE_KEY],
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.26",
        settings: {
          evmVersion: "shanghai",
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true,
            },
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
      5: "0xb9e34909788be673d1796270f89Db0ab93e7B2a0",
      10: TEST_MNEMONIC_ACCOUNTS[0],
      420: TEST_MNEMONIC_ACCOUNTS[0],
      31337: TEST_MNEMONIC_ACCOUNTS[0],
      42161: TEST_MNEMONIC_ACCOUNTS[0],
      8453: getResourceAddressForNetwork("Protocol Owner", "base"),
      84532: getResourceAddressForNetwork("Protocol Owner", "baseSepolia"),
      84531: TEST_MNEMONIC_ACCOUNTS[0],
      421613: TEST_MNEMONIC_ACCOUNTS[0],
    },
    gf_deployer: {
      5: "0xa01EA9Aaf878D8106062e95A249121E74Bef5132",
      10: TEST_MNEMONIC_ACCOUNTS[0],
      420: TEST_MNEMONIC_ACCOUNTS[0],
      31337: TEST_MNEMONIC_ACCOUNTS[0],
      42161: TEST_MNEMONIC_ACCOUNTS[0],
      8453: "0xD07e6477663c9C8668a9759a59e72B4eaB9Ff3A4",
      84532: TEST_MNEMONIC_ACCOUNTS[0],
      84531: TEST_MNEMONIC_ACCOUNTS[0],
      421613: TEST_MNEMONIC_ACCOUNTS[0],
    },
    warblerLabsAddress: {
      5: TEST_MNEMONIC_ACCOUNTS[0],
      10: TEST_MNEMONIC_ACCOUNTS[0],
      420: TEST_MNEMONIC_ACCOUNTS[0],
      31337: TEST_MNEMONIC_ACCOUNTS[0],
      42161: TEST_MNEMONIC_ACCOUNTS[0],
      8453: getResourceAddressForNetwork("Warbler Labs Operational Multisig", "base"),
      84532: getResourceAddressForNetwork("Warbler Labs Operational Multisig", "baseSepolia"),
      84531: TEST_MNEMONIC_ACCOUNTS[0],
      421613: TEST_MNEMONIC_ACCOUNTS[0],
    },
  },
  gasReporter: {
    enabled: !!process.env.REPORT_GAS,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    currency: "USD",
    src: "contracts/protocol",
  },
  tenderly: {
    project: "goldfinch-protocol",
    username: "goldfinch",
    forkNetwork: forkedChainId?.toString(), //Network id of the network we want to fork
  },
  contractSizer: {
    runOnCompile: true,
    // strict: process.env.CI !== undefined,
    // TODO: uncomment this when size decrease is merged
    strict: false,
    except: [":Test.*", ":MigratedTranchedPool$"],
  },
  docgen: {
    // Cf. https://github.com/OpenZeppelin/solidity-docgen/blob/master/src/config.ts
    outputDir: "solidity-docgen-docs",
    pages: "files",
    templates: "docs-templates",
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: {
      base: process.env.ETHERSCAN_API_KEY,
    },
  },
  customChains: [
    {
      network: "base",
      chainId: 8453,
      urls: {
        apiURL: "https://basescan.org/",
        browserURL: "https://basescan.org",
      },
    },
  ],
  // Cf. https://book.getfoundry.sh/config/hardhat
}

export default config
