import {isPlainObject, PlainObject} from "@goldfinch-eng/utils/src/type"

export const blockchain = "ethereum"
export const recipient = "0x0000000000000000000000000000000000000001"
export const network = {name: "localhost", supported: true}
export const blockInfo = {number: 94, timestamp: 1640783491}

let _deploymentsJson: PlainObject

const getDeploymentsJson = async () => {
  if (!_deploymentsJson) {
    _deploymentsJson = await import("@goldfinch-eng/protocol/deployments/all_client_test.json")
  }
  return _deploymentsJson
}

const getAbi = async (contractName: string): Promise<PlainObject> => {
  const deploymentsJson = await getDeploymentsJson()
  const contract = (deploymentsJson as any)["31337"].hardhat.contracts[contractName]
  if (contract && isPlainObject(contract.abi)) {
    return contract.abi
  } else {
    throw new Error(`Failed to identify deployment info for contract: ${contractName}`)
  }
}

export const stakingRewardsAbiPromise = getAbi("StakingRewards")

export const merkleDistributorAbiPromise = getAbi("MerkleDistributor")

export const communityRewardsAbiPromise = getAbi("CommunityRewards")

export const gfiAbiPromise = getAbi("GFI")

export const seniorPoolAbiPromise = getAbi("SeniorPool")

export const fiduAbiPromise = getAbi("Fidu")

export const poolAbiPromise = getAbi("Pool")

export const erc20AbiPromise = getAbi("TestERC20")

export const getDeployments = async () => ({
  contracts: {
    StakingRewards: {address: "0x0000000000000000000000000000000000000009", abi: await stakingRewardsAbiPromise},
    CommunityRewards: {address: "0x0000000000000000000000000000000000000008", abi: await communityRewardsAbiPromise},
    MerkleDistributor: {address: "0x0000000000000000000000000000000000000007", abi: await merkleDistributorAbiPromise},
    GFI: {address: "0x0000000000000000000000000000000000000006", abi: await gfiAbiPromise},
    SeniorPool: {address: "0x0000000000000000000000000000000000000005", abi: await seniorPoolAbiPromise},
    Fidu: {address: "0x0000000000000000000000000000000000000004", abi: await fiduAbiPromise},
    Pool: {address: "0x0000000000000000000000000000000000000003", abi: await poolAbiPromise},
    TestERC20: {address: "0x0000000000000000000000000000000000000002", abi: await erc20AbiPromise},
  },
})
