import {genIsArrayOf, isPlainObject, PlainObject} from "@goldfinch-eng/utils/src/type"

export const blockchain = "ethereum"
export const recipient = "0x0000000000000000000000000000000000000001"
export const network = {name: "localhost", supported: true}

export const defaultCurrentBlock = {number: 94, timestamp: 1640783491}

let _deploymentsJson: PlainObject

const getDeploymentsJson = async () => {
  if (!_deploymentsJson) {
    const json = (await import("@goldfinch-eng/protocol/deployments/all_client_test.json" as any)) as unknown
    if (isPlainObject(json)) {
      _deploymentsJson = json
    } else {
      throw new Error("Failed to import deployments json.")
    }
  }
  return _deploymentsJson
}

const isArrayOfPlainObject = genIsArrayOf(isPlainObject)
const getAbi = async (contractName: string): Promise<PlainObject[]> => {
  const deploymentsJson = await getDeploymentsJson()
  const contract = (deploymentsJson as any)["31337"].hardhat.contracts[contractName]
  if (contract && isArrayOfPlainObject(contract.abi)) {
    return contract.abi
  } else {
    throw new Error(`Failed to identify deployment info for contract: ${contractName}`)
  }
}

let _legacyDeploymentsJson: PlainObject

const getLegacyDeploymentsJson = async () => {
  if (!_legacyDeploymentsJson) {
    const json = (await import("@goldfinch-eng/protocol/deployments/legacy-all.json" as any)) as unknown
    if (isPlainObject(json)) {
      _legacyDeploymentsJson = json
    } else {
      throw new Error("Failed to import deployments json.")
    }
  }
  return _legacyDeploymentsJson
}

const getLegacyAbi = async (contractName: string): Promise<PlainObject[]> => {
  const legacyDeploymentsJson = await getLegacyDeploymentsJson()
  const contract = (legacyDeploymentsJson as any)["31337"].hardhat.contracts[contractName]
  if (contract && isArrayOfPlainObject(contract.abi)) {
    return contract.abi
  } else {
    throw new Error(`Failed to identify deployment info for contract: ${contractName}`)
  }
}

export const getStakingRewardsAbi = () => getAbi("StakingRewards")

export const getMerkleDistributorAbi = () => getAbi("MerkleDistributor")

export const getBackerMerkleDistributorAbi = () => getAbi("BackerMerkleDistributor")

export const getMerkleDirectDistributorAbi = () => getAbi("MerkleDirectDistributor")

export const getBackerMerkleDirectDistributorAbi = () => getAbi("BackerMerkleDirectDistributor")

export const getBackerRewardsAbi = () => getAbi("BackerRewards")

export const getCommunityRewardsAbi = () => getAbi("CommunityRewards")

export const getGfiAbi = () => getAbi("GFI")

export const getSeniorPoolAbi = () => getAbi("SeniorPool")

export const getFiduAbi = () => getAbi("Fidu")

export const getPoolAbi = () => getLegacyAbi("Pool")

export const getErc20Abi = () => getAbi("TestERC20")

export const getTranchedPoolAbi = () => getAbi("TranchedPool")

export const getCreditLineAbi = () => getAbi("CreditLine")

export const getFiduUSDCCurveLPAbi = () => getAbi("TestFiduUSDCCurveLP")

type ContractName =
  | "StakingRewards"
  | "CommunityRewards"
  | "MerkleDistributor"
  | "MerkleDirectDistributor"
  | "GFI"
  | "SeniorPool"
  | "Fidu"
  | "Pool"
  | "TestERC20"
  | "BackerMerkleDistributor"
  | "BackerMerkleDirectDistributor"
  | "BackerRewards"
  | "TranchedPool"
  | "CreditLine"
  | "TestFiduUSDCCurveLP"

type Deployments = {
  contracts: Record<ContractName, {address: string; abi: PlainObject[]}>
}

let _deployments: Deployments

export const getDeployments = async () => {
  if (!_deployments) {
    _deployments = {
      contracts: {
        TestFiduUSDCCurveLP: {
          address: "0x0000000000000000000000000000000000000016",
          abi: await getFiduUSDCCurveLPAbi(),
        },
        CreditLine: {
          address: "0x0000000000000000000000000000000000000015",
          abi: await getCreditLineAbi(),
        },
        TranchedPool: {
          address: "0x0000000000000000000000000000000000000014",
          abi: await getTranchedPoolAbi(),
        },
        BackerRewards: {
          address: "0x0000000000000000000000000000000000000013",
          abi: await getBackerRewardsAbi(),
        },
        BackerMerkleDirectDistributor: {
          address: "0x0000000000000000000000000000000000000012",
          abi: await getBackerMerkleDirectDistributorAbi(),
        },
        BackerMerkleDistributor: {
          address: "0x0000000000000000000000000000000000000011",
          abi: await getBackerMerkleDistributorAbi(),
        },
        MerkleDirectDistributor: {
          address: "0x0000000000000000000000000000000000000010",
          abi: await getMerkleDirectDistributorAbi(),
        },
        StakingRewards: {address: "0x0000000000000000000000000000000000000009", abi: await getStakingRewardsAbi()},
        CommunityRewards: {address: "0x0000000000000000000000000000000000000008", abi: await getCommunityRewardsAbi()},
        MerkleDistributor: {
          address: "0x0000000000000000000000000000000000000007",
          abi: await getMerkleDistributorAbi(),
        },
        GFI: {address: "0x0000000000000000000000000000000000000006", abi: await getGfiAbi()},
        SeniorPool: {address: "0x0000000000000000000000000000000000000005", abi: await getSeniorPoolAbi()},
        Fidu: {address: "0x0000000000000000000000000000000000000004", abi: await getFiduAbi()},
        Pool: {address: "0x0000000000000000000000000000000000000003", abi: await getPoolAbi()},
        TestERC20: {address: "0x0000000000000000000000000000000000000002", abi: await getErc20Abi()},
      },
    }
  }
  return _deployments
}
