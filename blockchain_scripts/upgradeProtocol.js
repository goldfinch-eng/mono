/*
Due to issues with our deploy library, we can't simply re-run our baseDeploy script when we want to upgrade.
Instead, we need to run this separate script, which is very similar to the base deploy, but calls slightly different functions
*/
const baseDeploy = require('../blockchain_scripts/baseDeploy');
const bre = require("@nomiclabs/buidler");

async function main() {
  baseDeploy(bre, {shouldUpgrade: true});
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });