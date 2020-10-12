const baseDeploy = require("../blockchain_scripts/baseDeploy")

async function main(bre) {
  await baseDeploy(bre, {shouldUpgrade: false})
}

module.exports = main
module.exports.tags = ["base_deploy"]
