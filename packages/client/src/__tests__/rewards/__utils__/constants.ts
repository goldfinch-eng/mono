import deployments from "@goldfinch-eng/protocol/deployments/all_dev.json"

export const blockchain = "ethereum"
export const recipient = "0x0000000000000000000000000000000000000001"
export const network = {name: "localhost", supported: true}
export const blockInfo = {number: 94, timestamp: 1640783491}

const getAbi = (contractName: string) => deployments["31337"].localhost.contracts[contractName].abi

export const stakingRewardsABI = getAbi("StakingRewards")

export const merkleDistributorABI = getAbi("MerkleDistributor")

export const communityRewardsABI = getAbi("CommunityRewards")

export const gfiABI = getAbi("GFI")

export const seniorPoolABI = getAbi("SeniorPool")

export const fiduABI = getAbi("Fidu")

export const poolABI = getAbi("Pool")

export const erc20ABI = getAbi("TestERC20")

export const DEPLOYMENTS = {
  contracts: {
    StakingRewards: {address: "0x0000000000000000000000000000000000000009", abi: stakingRewardsABI},
    CommunityRewards: {address: "0x0000000000000000000000000000000000000008", abi: communityRewardsABI},
    MerkleDistributor: {address: "0x0000000000000000000000000000000000000007", abi: merkleDistributorABI},
    GFI: {address: "0x0000000000000000000000000000000000000006", abi: gfiABI},
    SeniorPool: {address: "0x0000000000000000000000000000000000000005", abi: seniorPoolABI},
    Fidu: {address: "0x0000000000000000000000000000000000000004", abi: fiduABI},
    Pool: {address: "0x0000000000000000000000000000000000000003", abi: poolABI},
    TestERC20: {address: "0x0000000000000000000000000000000000000002", abi: erc20ABI},
  },
}
