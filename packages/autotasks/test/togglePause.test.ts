import {hardhat, deployAllContracts, toEthers} from "@goldfinch-eng/protocol/test/testHelpers"
const {deployments} = hardhat
import {togglePause} from "../senior-pool-pauser/index"
let seniorPool
describe("togglePause", () => {
  const setupTest = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    const {seniorPool} = await deployAllContracts(deployments)
    return {seniorPool}
  })

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({seniorPool} = await setupTest())
  })

  describe("toggle pausing", async () => {
    let seniorPoolAsEthers

    beforeEach(async () => {
      seniorPoolAsEthers = await toEthers(seniorPool)
    })

    context("when the pool is not already paused", async () => {
      it("should pause the pool", async () => {
        expect(await seniorPoolAsEthers.paused()).to.be.false
        await togglePause(seniorPoolAsEthers)
        expect(await seniorPoolAsEthers.paused()).to.be.true
      })
    })

    context("when the pool is already paused", async () => {
      it("should pause the pool", async () => {
        await togglePause(seniorPoolAsEthers)
        expect(await seniorPoolAsEthers.paused()).to.be.true
        await togglePause(seniorPoolAsEthers)
        expect(await seniorPoolAsEthers.paused()).to.be.false
      })
    })
  })
})
