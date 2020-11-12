const baseDeploy = require("../blockchain_scripts/baseDeploy")

async function main(hre) {
  await baseDeploy(hre, {shouldUpgrade: false})
}

module.exports = main
module.exports.tags = ["base_deploy"]
