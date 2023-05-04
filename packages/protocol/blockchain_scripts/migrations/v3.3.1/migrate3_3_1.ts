import {bigVal, BN} from "@goldfinch-eng/protocol/test/testHelpers"
import {BackerRewards, ERC20, StakingRewards} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertNonNullable} from "@goldfinch-eng/utils"
// import { BigNumber } from "ethers/lib/ethers"
import hre, {ethers} from "hardhat"
import _ from "lodash"
import {ContractDeployer, ContractUpgrader, getEthersContract, populateTxAndLog} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import {BigNumber} from "bignumber.js"

export const rewardsToRemoveFromStakingRewards = bigVal(1_200_000) // 1.2m GFI
export const maxInterestDollarsEllibile = bigVal(34_000_000) // 34m 1e18
export const rewardsMargin = bigVal(30_000) // 1 month of rewards

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const deployEffects = await getDeployEffects({
    title: "v3.3.1 Upgrade",
    description: "https://github.com/warbler-labs/mono/pull/1522/files",
  })

  const stakingRewards = await getEthersContract<StakingRewards>("StakingRewards")
  const gfi = await getEthersContract<ERC20>("GFI")
  const backerRewards = await getEthersContract<BackerRewards>("BackerRewards")

  // wanted effects
  // 1. call setRewardsParams
  // 2. Add sweepRewards function from stakingRewards contract
  // 3. call sweepRewards for 1.2m GFI
  // 4. transfer 1.2m GFI to the backer rewards contract
  // 5. update total rewards and max interest dollars eligible params

  const {gf_deployer} = await deployer.getNamedAccounts()
  assertNonNullable(gf_deployer)

  const upgrader = new ContractUpgrader(deployer)
  const upgradedContracts = await upgrader.upgrade({contracts: ["StakingRewards"]})

  // This is fetched by running the script below. This was originally invoking that function, but doing it
  // during testing was way too slow.
  const backerRewardsAvailable = new BigNumber("305612779706584027805181")
  const newBackerRewardsAvailable = backerRewardsAvailable
    .plus(rewardsToRemoveFromStakingRewards.toString())
    .minus(rewardsMargin.toString())

  const newTotalRewardsParam = calculateTotalRewards({
    rewardsAvailable: newBackerRewardsAvailable,
    interestReceived: new BigNumber((await backerRewards.totalInterestReceived()).toString()),
    // we need to divide this by 1e12 because backer rewards maxInterestDollars
    // is saved as a 1e18 value, not a 1e6 value. So we need to make sure the
    // bases of interestReceived and maxInterest are the same
    maxInterest: new BigNumber(maxInterestDollarsEllibile.div(new BN("1000000000000")).toString()),
  })

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))
  await deployEffects.add({
    deferred: [
      await populateTxAndLog(
        stakingRewards.populateTransaction.removeRewards(rewardsToRemoveFromStakingRewards.toString()),
        `Populated tx to remove ${rewardsToRemoveFromStakingRewards.toString()} rewards from StakingRewards`
      ),
      await populateTxAndLog(
        gfi.populateTransaction.transfer(backerRewards.address, rewardsToRemoveFromStakingRewards.toString()),
        `Populated tx to transfer ${rewardsToRemoveFromStakingRewards.toString()} to BackerRewards`
      ),
      await populateTxAndLog(
        backerRewards.populateTransaction.setMaxInterestDollarsEligible(maxInterestDollarsEllibile.toString()),
        `Populated tx to set BackerRewards.maxInterestDollarsEligibleTo ${maxInterestDollarsEllibile.toString()}`
      ),
      await populateTxAndLog(
        backerRewards.populateTransaction.setTotalRewards(newTotalRewardsParam.toFixed(0)),
        `Populated tx to set BackerRewards.totalRewards to ${newTotalRewardsParam.toFixed(0)}`
      ),
    ],
  })

  await deployEffects.executeDeferred()

  console.log("Finished deploy 3.3.1")
  return {
    newTotalRewardsParam: ethers.BigNumber.from(newTotalRewardsParam.toFixed(0)),
  }
}

// Calculates a new total rewards parameter
function calculateTotalRewards({
  rewardsAvailable: r,
  interestReceived: i,
  maxInterest: m,
}: {
  rewardsAvailable: BigNumber
  interestReceived: BigNumber
  maxInterest: BigNumber
}): BigNumber {
  /*
  Equation for calculating the total rewards parameter to

  M = maxInterest
  R = rewardsAvailable
  I = InterestReceived

  totalRewards = R * sqrt(M) / (sqrt(M) - sqrt(I))
  */

  return r.multipliedBy(m.sqrt()).div(m.sqrt().minus(i.sqrt()))
}

/*
run this with to get the current amount of backer rewards available in the backer rewards contract

```
HARDHAT_NETWORK=mainnet npx hardhat console
```

```
async function getRemainingGfi() {
  let backerRewards = await ethers.getContractAt("BackerRewards", "0x384860F14B39CcD9C89A73519c70cD5f5394D0a6")  
  let poolTokens = await ethers.getContractAt("PoolTokens", "0x57686612C601Cb5213b01AA8e80AfEb24BBd01df")
  let gfi = await ethers.getContractAt("ERC20", "0xdab396cCF3d84Cf2D07C4454e10C8A6F5b008D2b")
  let maxPoolTokenId = await poolTokens._tokenIdTracker()

  let rewards = ethers.BigNumber.from(0)


  // unfortunately couldn't figure out how to parallelize this and not trigger rate limiting, so sequential it is
  for (let i = 1; i < maxPoolTokenId.toNumber(); i++) {
    console.log(`processing pool token ${i}`)
    const [interestRewardsClaimable, principalRewardsClaimable] = await Promise.all([
      backerRewards.poolTokenClaimableRewards(i),
      backerRewards.stakingRewardsEarnedSinceLastWithdraw(i),
    ])

    console.log(`done processing ${i} (${(i / maxPoolTokenId.toNumber()) * 100}%)`)
    rewards = rewards.add(interestRewardsClaimable).add(principalRewardsClaimable)
  }

  let gfiBalance = await gfi.balanceOf(backerRewards.address)
  return gfiBalance.sub(rewards)
}

await getRemainingGfi()
```
*/

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
