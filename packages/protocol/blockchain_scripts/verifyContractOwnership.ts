import {deployments} from "hardhat"
import {constants as ethersConstants} from "ethers"
import {getDeployedContract} from "./deployHelpers"
import {MAINNET_MULTISIG} from "./mainnetForkingHelpers"

const ZERO_BYTES32 = ethersConstants.HashZero

const expectedProtocolContractNamesWithoutAccessControl: Record<string, true> = {
  Accountant: true,
  BackerMerkleDirectDistributor_Proxy: true,
  BackerMerkleDistributor: true,
  BackerRewards_Proxy: true,
  CommunityRewards_Proxy: true,
  ConfigOptions: true,
  CreditDesk_Proxy: true,
  Fidu_Proxy: true,
  Go_Proxy: true,
  GoldfinchConfig_Proxy: true,
  GoldfinchFactory_Proxy: true,
  MerkleDirectDistributor_Proxy: true,
  MerkleDistributor: true,
  PoolTokens_Proxy: true,
  Pool_Proxy: true,
  SeniorPool_Proxy: true,
  StakingRewards_Proxy: true,
  TestForwarder: true,
  TranchingLogic: true,
  UniqueIdentity_Proxy: true,
  Zapper_Proxy: true,
}
const expectedProtocolContractNamesWithNoOwners: Record<string, true> = {}

async function verifyProtocolContractsOwnership() {
  console.log("#########################################")
  console.log("Verifying ownership of protocol contracts")
  console.log("#########################################")
  console.log("")

  const allDeployedContractNames = Object.keys(await deployments.all())

  for (const name of allDeployedContractNames) {
    console.log("**********************")
    console.log(name)
    console.log("**********************")

    const contract = await getDeployedContract(deployments, name)
    let issue = false

    if (name in expectedProtocolContractNamesWithoutAccessControl) {
      try {
        await contract.OWNER_ROLE()
      } catch (err: unknown) {
        if ((err as any).message === "contract.OWNER_ROLE is not a function") {
          console.log("Skipping because contract has no OWNER_ROLE-based access control.")
        } else {
          throw new Error("Unexpected error reading OWNER_ROLE.")
        }
      }
      throw new Error("Expected contract supposedly without access control not to have OWNER_ROLE.")
    } else {
      // Confirm that OWNER_ROLE has been setup so as indeed to "own" the contract.
      const OWNER_ROLE = await contract.OWNER_ROLE()
      const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE()
      if (DEFAULT_ADMIN_ROLE === ZERO_BYTES32) {
        console.log(`DEFAULT_ADMIN_ROLE has not been configured.`)
      } else if (DEFAULT_ADMIN_ROLE === OWNER_ROLE) {
        // pass
      } else {
        issue = true
        console.error(`[CRITICAL] DEFAULT_ADMIN_ROLE is a different role than OWNER_ROLE: ${DEFAULT_ADMIN_ROLE}`)
      }
      const adminRoleOfOwnerRole = await contract.getRoleAdmin(OWNER_ROLE)
      if (adminRoleOfOwnerRole !== OWNER_ROLE) {
        if (adminRoleOfOwnerRole === ZERO_BYTES32) {
          console.log(`Admin of OWNER_ROLE is zero address.`)
        } else {
          issue = true
          console.error(`[CRITICAL] Admin of OWNER_ROLE is a different role: ${adminRoleOfOwnerRole}`)
        }
      }

      // Confirm that Governance is the only account with the OWNER_ROLE.
      const governanceIsOwner = await contract.hasRole(OWNER_ROLE, MAINNET_MULTISIG)
      const ownerCount = Number((await contract.getRoleMemberCount(OWNER_ROLE)).toString())
      const onlyOwnerIsGovernance = governanceIsOwner && ownerCount === 1
      if (!onlyOwnerIsGovernance) {
        if (ownerCount === 0) {
          if (name in expectedProtocolContractNamesWithNoOwners) {
            console.log("Contract has no owners, as expected.")
          } else {
            issue = true
            console.error(`[CRITICAL] Contract has no owners.`)
          }
        } else {
          issue = true

          if (name in expectedProtocolContractNamesWithNoOwners) {
            console.log(`[CRITICAL] Expected contract to have no owners, but has: ${ownerCount}`)
          }
          if (!governanceIsOwner) {
            console.error(`[CRITICAL] Governance is not an owner`)
          }
          if (ownerCount > 1) {
            console.error(`[CRITICAL] Contract has multiple owners: ${ownerCount}`)
          }
        }
      }
    }

    console.log("")
    if (issue) {
      console.log("ISSUE")
    } else {
      console.log("OK")
    }
    console.log("")
  }
}

type BorrowerContractInfo = {
  address: string
  expectedOwnerAddress: string
}

const borrowerContractsToVerify: BorrowerContractInfo[] = [
  // TODO
]

async function verifyBorrowerContractsOwnership() {
  console.log("#########################################")
  console.log("Verifying ownership of borrower contracts")
  console.log("#########################################")

  for (const info of borrowerContractsToVerify) {
    // TODO
  }
}

async function main() {
  await verifyProtocolContractsOwnership()
  await verifyBorrowerContractsOwnership()
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default main
