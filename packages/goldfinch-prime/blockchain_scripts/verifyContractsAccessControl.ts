import {constants as ethersConstants, Contract} from "ethers"
import {deployments, ethers} from "hardhat"
import difference from "lodash/difference"
import every from "lodash/every"
import intersection from "lodash/intersection"
import mapKeys from "lodash/mapKeys"
import some from "lodash/some"

import {assertNonNullable, isNonEmptyString, isPlainObject} from "../../utils/src/type"
import {getDeployedContract, OWNER_ROLE} from "./deployHelpers"
import {MAINNET_GF_DEPLOYER, MAINNET_GOVERNANCE_MULTISIG, MAINNET_WARBLER_LABS_MULTISIG} from "./mainnetForkingHelpers"

const ZERO_BYTES32 = ethersConstants.HashZero

const expectedProtocolContractNamesWithoutAnyOwnership = new Set([
  "Accountant",
  "ConfigOptions",
  "TestForwarder",
  "TranchingLogic",
])

const _protocolAddressDescriptionByLowercaseAddress = {
  [MAINNET_GOVERNANCE_MULTISIG.toLowerCase()]: "Governance multi-sig",
  [MAINNET_WARBLER_LABS_MULTISIG.toLowerCase()]: "Warbler Labs multi-sig",
}
const getProtocolAddressDescription = (address: string): string =>
  _protocolAddressDescriptionByLowercaseAddress[address.toLowerCase()] || address

type MemberVerificationConfig = {
  roleDescription: string
  role: string
  expectedMembers: string[]
}
type VerificationResult = {
  ok: boolean
}

/**
 * Verifies that the `contract` has an explicit `owner()`, whose value is equal to `expectedOwner`.
 */
async function _contractExplicitOwnerVerifier(contract: Contract, expectedOwner: string): Promise<VerificationResult> {
  console.log("")
  let contractIssue = false

  const owner = (await contract.owner()).toLowerCase()
  if (owner === expectedOwner.toLowerCase()) {
    console.log(`Contract has explicit \`owner\` as expected: ${getProtocolAddressDescription(expectedOwner)}`)
  } else {
    contractIssue = true
    console.error(
      `[CRITICAL] Expected contract to have explicit \`owner\` (${getProtocolAddressDescription(
        expectedOwner
      )}), but found: ${owner}`
    )
  }

  return {ok: !contractIssue}
}

/**
 * Verifies that the `contract` does not have an explicit `owner()`.
 */
async function _contractNoExplicitOwnerVerifier(contract: Contract): Promise<VerificationResult> {
  console.log("")
  let contractHasExplicitOwner = false

  let owner: string | undefined
  try {
    owner = await contract.owner()
    contractHasExplicitOwner = true
  } catch (err: unknown) {
    if ((err as any).message !== "contract.owner is not a function") {
      throw new Error("Unexpected error reading `owner`.")
    }
  }

  if (contractHasExplicitOwner) {
    console.error(`[CRITICAL] Expected contract not to have explicit \`owner\`, but it does: ${owner}`)
  } else {
    console.log("Contract has no explicit `owner`, as expected.")
  }

  return {ok: !contractHasExplicitOwner}
}

/**
 * Verifies that the provided `role` is configured such that its admin role is the contract's `OWNER_ROLE` or its
 * `DEFAULT_ADMIN_ROLE`, and in case of the latter, that this `DEFAULT_ADMIN_ROLE` is not held by anyone.
 */
async function _contractRoleBasedAccessControlConfiguredVerifier(
  contract: Contract,
  roleDescription: string,
  role: string
): Promise<VerificationResult> {
  console.log("")
  let contractIssue = false

  const OWNER_ROLE = await contract.OWNER_ROLE()
  const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE()

  const adminRoleOfRole = await contract.getRoleAdmin(role)
  if (adminRoleOfRole === OWNER_ROLE) {
    console.log(`Admin role of ${roleDescription} is ${role === OWNER_ROLE ? "itself" : "OWNER_ROLE"}.`)
  } else if (adminRoleOfRole === DEFAULT_ADMIN_ROLE) {
    if (DEFAULT_ADMIN_ROLE === ZERO_BYTES32) {
      console.log(`Admin role of ${roleDescription} is zero-bytes DEFAULT_ADMIN_ROLE.`)
    } else {
      contractIssue = true
      console.error(
        `[CRITICAL] Admin role of ${roleDescription} is some non-zero-bytes DEFAULT_ADMIN_ROLE: ${DEFAULT_ADMIN_ROLE}`
      )
    }

    const defaultAdminRoleMemberCount = Number((await contract.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).toString())
    if (defaultAdminRoleMemberCount) {
      contractIssue = true

      const defaultAdminRoleMembers = await Promise.all(
        Array(defaultAdminRoleMemberCount)
          .fill("")
          .map((_, i) => contract.getRoleMember(DEFAULT_ADMIN_ROLE, i))
      )

      console.error(`[CRITICAL] DEFAULT_ADMIN_ROLE unexpectedly has non-zero members: ${defaultAdminRoleMembers}`)
    } else {
      console.log(`No one has the DEFAULT_ADMIN_ROLE.`)
    }
  } else {
    contractIssue = true
    console.error(`[CRITICAL] Admin role of ${roleDescription} is a different role: ${adminRoleOfRole}`)
  }

  return {ok: !contractIssue}
}

/**
 * Verifies that the `contract` does not have `OWNER_ROLE()` or `DEFAULT_ADMIN_ROLE()`, from which we infer that
 * it does not use roles-based access control.
 */
async function _contractRoleBasedAccessControlNotConfiguredVerifier(contract: Contract): Promise<VerificationResult> {
  console.log("")

  let hasOwnerRole = false
  try {
    await contract.OWNER_ROLE()
    hasOwnerRole = true
  } catch (err: unknown) {
    if ((err as any).message !== "contract.OWNER_ROLE is not a function") {
      throw new Error("Unexpected error reading OWNER_ROLE.")
    }
  }

  let hasDefaultAdminRole = false
  try {
    await contract.DEFAULT_ADMIN_ROLE()
    hasDefaultAdminRole = true
  } catch (err: unknown) {
    if ((err as any).message !== "contract.DEFAULT_ADMIN_ROLE is not a function") {
      throw new Error("Unexpected error reading DEFAULT_ADMIN_ROLE.")
    }
  }

  const hasRoleBasedAccessControlIndicators = [hasOwnerRole, hasDefaultAdminRole]
  const hasRoleBasedAccessControl = some(hasRoleBasedAccessControlIndicators)
  if (hasRoleBasedAccessControl) {
    if (!every(hasRoleBasedAccessControlIndicators)) {
      throw new Error("Expected contract to have all or none of indicators of role-based access control.")
    }

    console.error("[CRITICAL] Expected contract not to have role-based access control, but it does.")
  } else {
    console.log("Contract has no role-based access control, as expected.")
  }

  return {ok: !hasRoleBasedAccessControl}
}

/**
 * Verifies that the `contract` has role-based access control configured for the provided `config` -- that is,
 * that the `config.role` has all and only the `config.expectedMembers` as its members (i.e. the addresses that
 * hold that role).
 */
async function _contractRoleMemberVerifier(
  contract: Contract,
  config: MemberVerificationConfig,
  describeExpectedMember: (expectedMember: string) => string
): Promise<VerificationResult> {
  console.log("")
  let contractIssue = false

  const memberCount = Number((await contract.getRoleMemberCount(config.role)).toString())
  const members = (
    await Promise.all(
      Array(memberCount)
        .fill("")
        .map((_, i) => contract.getRoleMember(config.role, i))
    )
  ).map((member: string) => member.toLowerCase())
  const expectedMembers = config.expectedMembers.map((expectedMember: string) => expectedMember.toLowerCase())

  const membersAsExpected = intersection(expectedMembers, members)
  const missingMembers = difference(expectedMembers, members)
  const unexpectedMembers = difference(members, expectedMembers)

  if (membersAsExpected.length) {
    console.log(
      `Contract role ${config.roleDescription} has expected members: ${membersAsExpected.map(describeExpectedMember)}`
    )
  } else {
    console.log(`Contract role ${config.roleDescription} has no expected members.`)
  }
  if (missingMembers.length) {
    contractIssue = true
    console.error(
      `[CRITICAL] Contract role ${config.roleDescription} lacks expected members: ${missingMembers.map(
        describeExpectedMember
      )}`
    )
  } else {
    console.log(`Contract role ${config.roleDescription} lacks no expected members.`)
  }
  if (unexpectedMembers.length) {
    contractIssue = true
    console.error(
      `[CRITICAL] Contract role ${config.roleDescription} has unexpected members: ${unexpectedMembers.map(
        describeExpectedMember
      )}`
    )
  } else {
    console.log(`Contract role ${config.roleDescription} has no unexpected members.`)
  }

  return {ok: !contractIssue}
}

function _getRoleBasedAccessControlledContractExpectedOwners(name: string): string[] {
  if (name.endsWith("_Implementation")) {
    return []
  } else {
    switch (name) {
      case "UniqueIdentity":
        return [MAINNET_GOVERNANCE_MULTISIG, MAINNET_WARBLER_LABS_MULTISIG]
      case "TranchedPool":
        return [MAINNET_GOVERNANCE_MULTISIG, MAINNET_GF_DEPLOYER]
      default:
        return [MAINNET_GOVERNANCE_MULTISIG]
    }
  }
}

async function verifyProtocolContractsOwnership(): Promise<VerificationResult> {
  const allDeployedContractNames = Object.keys(await deployments.all())

  return _verifyContractsAccessControl(
    "ownership of protocol contracts",
    allDeployedContractNames,
    async (name: string): Promise<VerificationResult> => {
      const contract = await getDeployedContract(deployments, name)

      if (expectedProtocolContractNamesWithoutAnyOwnership.has(name)) {
        // Confirm that contract has no explicit `owner`.
        const noExplicitOwnerResult = await _contractNoExplicitOwnerVerifier(contract)

        // Confirm that contract does not have role-based access control.
        const rolesBasedNotConfiguredResult = await _contractRoleBasedAccessControlNotConfiguredVerifier(contract)

        return {ok: noExplicitOwnerResult.ok && rolesBasedNotConfiguredResult.ok}
      } else if (name.endsWith("_Proxy")) {
        // Confirm that contract has expected explicit `owner`.
        const explicitOwnerResult = await _contractExplicitOwnerVerifier(
          contract,
          name === "UniqueIdentity_Proxy" ? MAINNET_WARBLER_LABS_MULTISIG : MAINNET_GOVERNANCE_MULTISIG
        )

        // Confirm that contract does not have role-based access control.
        const rolesBasedNotConfiguredResult = await _contractRoleBasedAccessControlNotConfiguredVerifier(contract)

        return {ok: explicitOwnerResult.ok && rolesBasedNotConfiguredResult.ok}
      } else {
        // Confirm that contract has no explicit `owner`.
        const noExplicitOwnerResult = await _contractNoExplicitOwnerVerifier(contract)

        // Confirm that the roles-based access control has been configured so that OWNER_ROLE does
        // indeed "own" the contract, in the sense that the role is not owned / controlled by some
        // other role.
        const OWNER_ROLE = await contract.OWNER_ROLE()
        const rolesBaseConfiguredResult = await _contractRoleBasedAccessControlConfiguredVerifier(
          contract,
          "OWNER_ROLE",
          OWNER_ROLE
        )

        // Confirm who has the OWNER_ROLE.
        const expectedOwners = _getRoleBasedAccessControlledContractExpectedOwners(name)
        const ownerRoleResult = await _contractRoleMemberVerifier(
          contract,
          {roleDescription: "OWNER_ROLE", role: OWNER_ROLE, expectedMembers: expectedOwners},
          getProtocolAddressDescription
        )

        return {ok: noExplicitOwnerResult.ok && rolesBaseConfiguredResult.ok && ownerRoleResult.ok}
      }
    },
    (name: string): string => name
  )
}

type MainnetTranchedPoolsJson = {
  [address: string]: {
    name: string
  }
}
const isMainnetTranchedPoolsJson = (json: unknown): json is MainnetTranchedPoolsJson => {
  return (
    isPlainObject(json) &&
    every(json, (val: unknown, key: unknown): boolean => {
      return isNonEmptyString(key) && isPlainObject(val) && isNonEmptyString(val.name)
    })
  )
}

if (!isMainnetTranchedPoolsJson(_mainnetTranchedPoolsJson)) {
  throw new Error("Unexpected mainnet tranched pools json.")
}

const mainnetTranchedPoolsJson: MainnetTranchedPoolsJson = mapKeys(_mainnetTranchedPoolsJson, (val, key) =>
  key.toLowerCase()
)

const expectedLockersBesidesBorrowerContractByTranchedPoolAddress = {}

async function verifyTranchedPoolContractsLocker() {
  const tranchedPoolAddresses = Object.keys(mainnetTranchedPoolsJson)

  return _verifyContractsAccessControl(
    "locker of tranched pools",
    tranchedPoolAddresses,
    async (tranchedPoolAddress: string): Promise<VerificationResult> => {
      const tranchedPoolContract = await ethers.getContractAt("TranchedPool", tranchedPoolAddress)

      // Verify that Governance has the TranchedPool contract's OWNER_ROLE.
      const expectedOwners = [MAINNET_GOVERNANCE_MULTISIG]
      const ownerRoleResult = await _contractRoleMemberVerifier(
        tranchedPoolContract,
        {
          roleDescription: "OWNER_ROLE",
          role: OWNER_ROLE,
          expectedMembers: expectedOwners,
        },
        (expectedOwner): string => {
          return getProtocolAddressDescription(expectedOwner)
        }
      )

      // Verify that the TranchedPool contract's LOCKER_ROLE has as its admin role the OWNER_ROLE (or
      // else the DEFAULT_ADMIN_ROLE and that no one has this).
      const LOCKER_ROLE = await tranchedPoolContract.LOCKER_ROLE()
      const rolesBasedConfiguredResult = await _contractRoleBasedAccessControlConfiguredVerifier(
        tranchedPoolContract,
        "LOCKER_ROLE",
        LOCKER_ROLE
      )

      // Verify who holds the LOCKER_ROLE on the TranchedPool contract.

      const otherExpectedLockers = expectedLockersBesidesBorrowerContractByTranchedPoolAddress[tranchedPoolAddress]
      assertNonNullable(otherExpectedLockers)

      const expectedLockers = [...otherExpectedLockers]
      const lockerRoleResult = await _contractRoleMemberVerifier(
        tranchedPoolContract,
        {
          roleDescription: "LOCKER_ROLE",
          role: LOCKER_ROLE,
          expectedMembers: expectedLockers,
        },
        (expectedLocker): string => {
          return getProtocolAddressDescription(expectedLocker)
        }
      )

      return {ok: rolesBasedConfiguredResult.ok && ownerRoleResult.ok && lockerRoleResult.ok}
    },
    (tranchedPoolAddress: string): string => {
      const info = mainnetTranchedPoolsJson[tranchedPoolAddress]
      assertNonNullable(info)
      return info.name
    }
  )
}

async function _verifyContractsAccessControl(
  description: string,
  keys: string[],
  verifier: (key: string) => Promise<VerificationResult>,
  getVerifierHeading: (key: string) => string
): Promise<VerificationResult> {
  console.log("")
  console.log("#########################################")
  console.log(`Verifying ${description}`)
  console.log("#########################################")

  let anyIssue = false
  for (const key of keys) {
    const heading = getVerifierHeading(key)
    console.log("")
    console.log("**********************")
    console.log(heading)
    console.log("**********************")

    const result = await verifier(key)

    console.log("")
    if (result.ok) {
      console.log("OK")
    } else {
      anyIssue = true
      console.error(`${key} HAS ISSUE ^^^`)
    }
  }

  return {ok: !anyIssue}
}

export default async function verifyContractsAccessControl(): Promise<void> {
  const protocolContractsResult = await verifyProtocolContractsOwnership()
  const tranchedPoolContractsResult = await verifyTranchedPoolContractsLocker()

  if (!protocolContractsResult.ok || !tranchedPoolContractsResult.ok) {
    throw new Error("Found access control issues!")
  }
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  verifyContractsAccessControl()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
