/* global web3 */
import {expect, toTruffle} from "./testHelpers"
import {ContractDeployer} from "../blockchain_scripts/deployHelpers"
import hre from "hardhat"
import {assertNonNullable} from "@goldfinch-eng/utils"
const {deployments} = hre
import {TestHasAdminInstance} from "../typechain/truffle/contracts/test/TestHasAdmin"
import {HasAdminInstance} from "../typechain/truffle/contracts/protocol/core/HasAdmin"
import {TestHasAdmin} from "../typechain/ethers/contracts/test/TestHasAdmin"

const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
  const [owner, anotherUser] = await web3.eth.getAccounts()
  assertNonNullable(owner)
  assertNonNullable(anotherUser)

  const deployer = new ContractDeployer(console.log, hre)

  const hasAdmin = await toTruffle<TestHasAdminInstance>(
    await deployer.deploy<TestHasAdmin>("TestHasAdmin", {
      from: owner,
      args: [owner],
    }),
    "TestHasAdmin"
  )

  return {
    owner,
    anotherUser,
    hasAdmin,
  }
})

export function behavesLikeHasAdmin(
  params: () => {owner: string; anotherUser: string; contract: Pick<HasAdminInstance, "isAdmin">}
) {
  describe("behaves like HasAdmin", () => {
    let owner: string
    let anotherUser: string
    let contract: Pick<HasAdminInstance, "isAdmin">

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({owner, anotherUser, contract} = params())
    })

    describe("isAdmin", async () => {
      it("returns true when sender is OWNER_ROLE", async () => {
        expect(await contract.isAdmin({from: owner})).to.be.true
      })

      it("returns false when sender is not OWNER_ROLE", async () => {
        expect(await contract.isAdmin({from: anotherUser})).to.be.false
      })
    })
  })
}

describe("HasAdmin", () => {
  let owner: string
  let anotherUser: string
  let contract: TestHasAdminInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({owner, anotherUser, hasAdmin: contract} = await testSetup())
  })

  behavesLikeHasAdmin(() => ({
    contract: contract as HasAdminInstance,
    owner,
    anotherUser,
  }))

  context("adminFunction with onlyAdmin modifier", async () => {
    it("succeeds when sender is OWNER_ROLE", async () => {
      await expect(contract.adminFunction({from: owner})).to.not.be.rejected
    })

    it("reverts when sender is not OWNER_ROLE", async () => {
      await expect(contract.adminFunction({from: anotherUser})).to.be.rejectedWith(/AD/)
    })
  })
})
