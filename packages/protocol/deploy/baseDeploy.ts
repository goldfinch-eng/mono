import {baseDeploy} from "../blockchain_scripts/baseDeploy"

async function main(hre) {
  await baseDeploy(hre)
}

module.exports = main
module.exports.tags = ["base_deploy"]
