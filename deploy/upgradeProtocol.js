const baseDeploy = require("../blockchain_scripts/baseDeploy")
/*
This is a bit janky, due to some idiosyncracies of our deployment library. We want to upgrade, and we want the deployment library to save
the newly implemented contracts in it's standard output. But we also don't want the upgrade thing to run every time we deploy.
So generally speaking, this just skips and never runs. But we can specifically run it when we want by using the "upgrade" tag.
*/
async function main(hre) {
  if (!process.env.SHOULD_UPGRADE) {
    hre.deployments.log(
      "Not in upgrade mode, so skipping the upgrade script. If you want this to run set SHOULD_UPGRADE as an env var at the beginning of your script call"
    )
    return
  }
  hre.deployments.log("Starting the upgrade...")
  await baseDeploy(hre, {shouldUpgrade: true})
}

module.exports = main
module.exports.tags = ["upgrade_protocol"]
