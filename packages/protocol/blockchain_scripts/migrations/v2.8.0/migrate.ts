import hre, {ethers} from "hardhat"
import {
  ContractDeployer,
  getEthersContract,
  getPauserAdmin,
  getProtocolOwner,
  populateTxAndLog,
} from "../../deployHelpers"
import {getDeployEffects} from "../deployEffects"
import {AccessControl} from "@goldfinch-eng/protocol/typechain/ethers/contracts/cake"
import {
  Context,
  MembershipOrchestrator,
  Router,
  CapitalLedger,
  GFILedger,
  MembershipVault,
  MembershipDirector,
  ERC20Splitter,
  MembershipLedger,
  MembershipCollector,
  StakingRewards,
  SeniorPool,
  PoolTokens,
  GFI,
  Fidu,
  GoldfinchConfig,
  Go,
} from "@goldfinch-eng/protocol/typechain/ethers"
import {CONFIG_KEYS} from "../../configKeys"
import {PopulatedTransaction} from "ethers/lib/ethers"
import {routingIdOf} from "../../deployHelpers/routingIdOf"

const CONTRACT_IDS = {
  AccessControl: routingIdOf("AccessControl"),
  Router: routingIdOf("Router"),
  MembershipVault: routingIdOf("MembershipVault"),
  CapitalLedger: routingIdOf("CapitalLedger"),
  GFILedger: routingIdOf("GFILedger"),
  GFI: routingIdOf("GFI"),
  MembershipDirector: routingIdOf("MembershipDirector"),
  MembershipLedger: routingIdOf("MembershipLedger"),
  MembershipCollector: routingIdOf("MembershipCollector"),
  MembershipOrchestrator: routingIdOf("MembershipOrchestrator"),
  PoolTokens: routingIdOf("PoolTokens"),
  SeniorPool: routingIdOf("SeniorPool"),
  StakingRewards: routingIdOf("StakingRewards"),
  FIDU: routingIdOf("FIDU"),
  USDC: routingIdOf("USDC"),
  ReserveSplitter: routingIdOf("ReserveSplitter"),
  ProtocolAdmin: routingIdOf("ProtocolAdmin"),
  PauserAdmin: routingIdOf("PauserAdmin"),
} as const

/// NOTE: See Epochs.sol for source of truth
/// 7 days * 24 hours * 60 minutes * 60 seconds
const EPOCH_SECONDS = 7 * 24 * 60 * 60

const MEMBERSHIP_NFT_BASE_URI =
  "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net/membershipTokenMetadata/"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const deployEffects = await getDeployEffects({title: "v2.8.0 upgrade"})

  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocolOwner = await getProtocolOwner()

  console.log("About to deploy AccessControl...")
  const provider = ethers.getDefaultProvider()
  const gasPrice = await provider.getGasPrice()
  const gasPriceToUse = gasPrice.mul("12").div("10")
  if (!gf_deployer) {
    throw new Error("gf_deployer not found")
  }

  const gfiContract = await getEthersContract<GFI>("GFI")
  const poolTokensContract = await getEthersContract<PoolTokens>("PoolTokens")
  const seniorPoolContract = await getEthersContract<SeniorPool>("SeniorPool")
  const stakingRewardsContract = await getEthersContract<StakingRewards>("StakingRewards")
  const fiduContract = await getEthersContract<Fidu>("Fidu")
  const goldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")
  const usdcAddress = await goldfinchConfig.addresses(CONFIG_KEYS.USDC)
  const go = await getEthersContract<Go>("Go")
  const legacyGoListAddress = await go.legacyGoList()

  const legacyGoListGoldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
    at: legacyGoListAddress,
  })

  const accessControl = await deployer.deploy<AccessControl>("AccessControl", {
    contract: "contracts/cake/AccessControl.sol:AccessControl",
    from: gf_deployer,
    gasLimit: 2000000,
    gasPrice: gasPriceToUse,
    proxy: {
      owner: protocolOwner,
      execute: {
        init: {
          methodName: "initialize",
          args: [protocolOwner],
        },
      },
    },
  })
  const router = await deployer.deploy<Router>("Router", {
    from: gf_deployer,
    gasLimit: 2000000,
    gasPrice: gasPriceToUse,
    proxy: {
      owner: protocolOwner,
      execute: {
        init: {
          methodName: "initialize",
          args: [accessControl.address],
        },
      },
    },
  })
  const context = await deployer.deploy<Context>("Context", {
    contract: "contracts/cake/Context.sol:Context",
    from: gf_deployer,
    gasPrice: gasPriceToUse,
    args: [router.address],
    proxy: {
      owner: protocolOwner,
    },
  })
  const membershipOrchestrator = await deployer.deploy<MembershipOrchestrator>("MembershipOrchestrator", {
    from: gf_deployer,
    args: [context.address],
    proxy: {
      owner: protocolOwner,
      execute: {
        init: {
          methodName: "initialize",
          args: [],
        },
      },
    },
  })
  const membershipDirector = await deployer.deploy<MembershipDirector>("MembershipDirector", {
    from: gf_deployer,
    gasPrice: gasPriceToUse,
    args: [context.address],
  })
  const membershipVault = await deployer.deploy<MembershipVault>("MembershipVault", {
    from: gf_deployer,
    gasPrice: gasPriceToUse,
    args: [context.address],
    proxy: {
      owner: protocolOwner,
      execute: {
        init: {
          methodName: "initialize",
          args: [],
        },
      },
    },
  })
  const capitalLedger = await deployer.deploy<CapitalLedger>("CapitalLedger", {
    from: gf_deployer,
    gasPrice: gasPriceToUse,
    args: [context.address],
    proxy: {
      owner: protocolOwner,
    },
  })
  const gfiLedger = await deployer.deploy<GFILedger>("GFILedger", {
    from: gf_deployer,
    gasPrice: gasPriceToUse,
    args: [context.address],
    proxy: {
      owner: protocolOwner,
    },
  })
  const membershipLedger = await deployer.deploy<MembershipLedger>("MembershipLedger", {
    from: gf_deployer,
    gasPrice: gasPriceToUse,
    args: [context.address],
    proxy: {
      owner: protocolOwner,
      execute: {
        init: {
          methodName: "initialize",
          args: [],
        },
      },
    },
  })

  // Set the first epoch that should be rewarded to the next epoch (not the current one)
  // This way, rewards accumulated in the current epoch will be claimable by everyone depositing
  // in this epoch. Otherwise, they would be lost as no one would have valid positions.
  const firstRewardEpoch = Math.floor(Math.floor(Date.now() / 1000) / EPOCH_SECONDS) + 1
  const membershipCollector = await deployer.deploy<MembershipCollector>("MembershipCollector", {
    from: gf_deployer,
    gasPrice: gasPriceToUse,
    args: [context.address, firstRewardEpoch],
    proxy: {
      owner: protocolOwner,
    },
  })

  const reserveSplitter = await deployer.deploy<ERC20Splitter>("ERC20Splitter", {
    from: gf_deployer,
    gasPrice: gasPriceToUse,
    args: [context.address, usdcAddress],
    proxy: {
      owner: protocolOwner,
      execute: {
        init: {
          methodName: "initialize",
          args: [],
        },
      },
    },
  })

  const routerMap: Record<keyof typeof CONTRACT_IDS, string> = {
    AccessControl: accessControl.address,
    Router: router.address,
    MembershipVault: membershipVault.address,
    CapitalLedger: capitalLedger.address,
    GFILedger: gfiLedger.address,
    GFI: gfiContract.address,
    MembershipDirector: membershipDirector.address,
    MembershipOrchestrator: membershipOrchestrator.address,
    PoolTokens: poolTokensContract.address,
    SeniorPool: seniorPoolContract.address,
    StakingRewards: stakingRewardsContract.address,
    FIDU: fiduContract.address,
    USDC: usdcAddress,
    ReserveSplitter: reserveSplitter.address,
    MembershipLedger: membershipLedger.address,
    MembershipCollector: membershipCollector.address,
    ProtocolAdmin: protocolOwner,
    PauserAdmin: await getPauserAdmin(),
  }

  const needsAdmin: Partial<Record<keyof typeof CONTRACT_IDS, boolean>> = {
    // For setting membership's alpha param
    MembershipLedger: true,
    // For setting the base uri of the token
    MembershipVault: true,
    // For setting the payees of the reserve splitter
    ReserveSplitter: true,
    // For setting the router mappings
    Router: true,
  }

  const deferredDeployEffects: PopulatedTransaction[] = [
    // Allow collector to interact with senior pool
    await populateTxAndLog(
      legacyGoListGoldfinchConfig.populateTransaction.addToGoList(membershipCollector.address),
      "Populated tx to add MembershipCollecter to GoList"
    ),
    // Set protocol revenue recipients and shares
    await populateTxAndLog(
      reserveSplitter.populateTransaction.replacePayees([membershipCollector.address, protocolOwner], [10000, 10000]),
      "Populated tx to set payees for reserve splitter"
    ),
    // Set membership NFT base URI
    await populateTxAndLog(
      membershipVault.populateTransaction.setBaseURI(MEMBERSHIP_NFT_BASE_URI),
      `Populated tx to set the membership NFT base URI to ${MEMBERSHIP_NFT_BASE_URI}`
    ),
    // Set treasury reserve address
    await populateTxAndLog(
      goldfinchConfig.populateTransaction.setTreasuryReserve(reserveSplitter.address),
      `Populated tx to set Goldfinch treasury reserve address to the reserve splitter`
    ),
    // Distribute rewards so firstRewardEpoch is guaranteed to be set up properly in membership collector
    await populateTxAndLog(
      reserveSplitter.populateTransaction.distribute(),
      `Populated tx to distribute funds in reserve splitter (expected to be 0)`
    ),
  ]

  const routerMapTxs: PopulatedTransaction[] = await Promise.all(
    Object.keys(routerMap).map((key) =>
      populateTxAndLog(
        router.populateTransaction.setContract(CONTRACT_IDS[key], routerMap[key]),
        `Populated tx to set ${key} (${CONTRACT_IDS[key]}) to ${routerMap[key]}!`
      )
    )
  )

  const protocolOwnerAdminTxs = await Promise.all(
    Object.keys(needsAdmin).map((key) =>
      populateTxAndLog(
        accessControl.populateTransaction.setAdmin(routerMap[key], protocolOwner),
        `Populated tx to set admin of Router entry at address: ${routerMap[key]} with key: ${key} (${CONTRACT_IDS[key]}) to protocol owner at address ${protocolOwner}!`
      )
    )
  )

  deployEffects.add({
    // 1. Set all the contract admins
    // 2. Set all the contract mappings
    // 3. Perform all of the deploy effects
    deferred: protocolOwnerAdminTxs.concat(routerMapTxs).concat(deferredDeployEffects),
  })

  console.log("Going to execute deferred deploy effects.")
  await deployEffects.executeDeferred()
  console.log("Executed deferred deploy effects.")
  return {}
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
