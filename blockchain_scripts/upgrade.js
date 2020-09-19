/*
This is a simple script to upgrade a given contract.
*/
async function upgrade(bre, contractName, deployOptions) {
  console.log("-------------- Upgrade begins --------------");
  const { deployments, ethers, getNamedAccounts } = bre;
  const { deploy } = deployments;
  const { protocol_owner, proxy_owner } = await getNamedAccounts();

  deployOptions.from = protocol_owner;

  const signers = await ethers.getSigners();
  const proxyOwnerSigner = signers[1];

  console.log("About to deploy implementation");
  const implementationReceipt = await deploy(contractName, deployOptions);
  console.log("Implementation deployed to", implementationReceipt.address);

  const proxyVersion = await deployments.get(contractName + "_Proxy");
  const proxy = await ethers.getContractAt(proxyVersion.abi, proxyVersion.address, proxyOwnerSigner);

  // If we want to run any post upgrade functions or initializations or anything after the implementation deployment, 
  // then we would need to actually populate the data here. See https://github.com/wighawag/buidler-deploy/blob/e534fcdc7ffffe2511a48c04def54ae1acf532bc/src/helpers.ts#L854 for more
  const data = "0x";
  console.log("About to change implementation");
  await proxy.changeImplementation(implementationReceipt.address, data);
  console.log("Upgrade complete");
}

module.exports = upgrade;
  