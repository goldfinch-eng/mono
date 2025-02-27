// Mapping of supported chain ID's to Alchemy API Url's

import {ChainId} from "./chainId"
import {TEST_MNEMONIC_ACCOUNTS} from "./testMnemonic"
export type ChainConfig = {
  alchemyApiBaseUrl?: string
  defaultHardhatForkBlockNum?: number
  governanceAddress: string
  warblerLabsAddress: string
  trustedSignerAddress: string
  governanceMultisigExecutor?: string
}

/*
 Only used for Mainnet Forking
*/
export const CHAIN_CONFIG_BY_CHAIN_ID: {[key: ChainId]: ChainConfig} = {
  10: {
    alchemyApiBaseUrl: "https://opt-mainnet.g.alchemy.com/v2/",
    defaultHardhatForkBlockNum: 798860, //May-18-2023 09:59:59 PM +UTC
    governanceAddress: TEST_MNEMONIC_ACCOUNTS[0],
    warblerLabsAddress: TEST_MNEMONIC_ACCOUNTS[1],
    trustedSignerAddress: TEST_MNEMONIC_ACCOUNTS[2],
  },
  420: {
    alchemyApiBaseUrl: "https://opt-goerli.g.alchemy.com/v2/",
    defaultHardhatForkBlockNum: 9509643, // May-18-2023 10:02:34 PM +UTC
    governanceAddress: TEST_MNEMONIC_ACCOUNTS[0],
    warblerLabsAddress: TEST_MNEMONIC_ACCOUNTS[1],
    trustedSignerAddress: TEST_MNEMONIC_ACCOUNTS[2],
  },
  31337: {
    defaultHardhatForkBlockNum: 92076157, // May-18-2023 10:03:04 PM +UTC
    governanceAddress: TEST_MNEMONIC_ACCOUNTS[0],
    warblerLabsAddress: TEST_MNEMONIC_ACCOUNTS[1],
    trustedSignerAddress: TEST_MNEMONIC_ACCOUNTS[2],
  },
  42161: {
    alchemyApiBaseUrl: "https://arb-mainnet.g.alchemy.com/v2/",
    defaultHardhatForkBlockNum: 92413176, //  May-19-2023 10:43:32 PM +UTC
    governanceAddress: TEST_MNEMONIC_ACCOUNTS[0],
    warblerLabsAddress: TEST_MNEMONIC_ACCOUNTS[1],
    trustedSignerAddress: TEST_MNEMONIC_ACCOUNTS[2],
  },
  421613: {
    alchemyApiBaseUrl: "https://arb-goerli.g.alchemy.com/v2/",
    defaultHardhatForkBlockNum: 20583614, // May-19-2023 10:05:37 PM +UTC
    governanceAddress: TEST_MNEMONIC_ACCOUNTS[0],
    warblerLabsAddress: TEST_MNEMONIC_ACCOUNTS[1],
    trustedSignerAddress: TEST_MNEMONIC_ACCOUNTS[2],
  },
  // 31337: "Localhost not supported",
  // Base Mainnet
  8453: {
    alchemyApiBaseUrl: "https://base-mainnet.g.alchemy.com/v2/",
    defaultHardhatForkBlockNum: 25050787,
    governanceAddress: TEST_MNEMONIC_ACCOUNTS[0],
    warblerLabsAddress: TEST_MNEMONIC_ACCOUNTS[1],
    governanceMultisigExecutor: TEST_MNEMONIC_ACCOUNTS[2],
    trustedSignerAddress: TEST_MNEMONIC_ACCOUNTS[2],
  },
  // Base Sepolia
  84532: {
    alchemyApiBaseUrl: "https://base-sepolia.g.alchemy.com/v2/",
    defaultHardhatForkBlockNum: 20568094,
    governanceAddress: TEST_MNEMONIC_ACCOUNTS[0],
    warblerLabsAddress: TEST_MNEMONIC_ACCOUNTS[1],
    trustedSignerAddress: TEST_MNEMONIC_ACCOUNTS[2],
  },
}

export const CHAIN_CONFIGS = Object.values(CHAIN_CONFIG_BY_CHAIN_ID)
