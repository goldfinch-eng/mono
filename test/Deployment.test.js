const {chai, BN, expect } = require('./testHelpers.js');
const bre = require("@nomiclabs/buidler");
const { deployments, getNamedAccounts } = bre;
const upgrade = require('../blockchain_scripts/upgrade');

describe("Base Deployment", () => {
  beforeEach(async () => {
    await deployments.run("base_deploy");
  });
  it("deploys the pool", async function() {
    const pool = await deployments.get("Pool");
    expect(pool.address).to.exist;
  });
  it("deploys the credit desk", async function() {
    const creditDesk = await deployments.get("CreditDesk");
    expect(creditDesk.address).to.exist;
  });
  it("sets the credit desk as the owner of the pool", async function() {
    const poolDeployment = await deployments.get("Pool");
    const pool = await ethers.getContractAt(poolDeployment.abi, poolDeployment.address);
    const creditDesk = await deployments.get("CreditDesk"); 
    expect(await pool.owner()).to.equal(creditDesk.address);
  });
});

describe("Setup for Testing", () => {
  it("should not fail", async () => {
    return expect(deployments.run("setup_for_testing")).to.eventually.fulfilled;
  });
});

describe("Upgrading", () => {
  beforeEach(async () => {
    await deployments.run();
  });
  it("should allow for transparent upgrades", async () => {
    const { protocol_owner } = await getNamedAccounts();
    const deployment = await deployments.get("CreditDesk");
    const creditDesk = await ethers.getContractAt(deployment.abi, deployment.address);
    expect(await creditDesk.getUnderwriterCreditLines(protocol_owner)).not.to.equal(5);

    await upgrade(bre, "CreditDesk", {contract: "FakeV2CreditDesk"});

    const newDeployment = await deployments.get("CreditDesk");
    const newCreditDesk = await ethers.getContractAt(newDeployment.abi, newDeployment.address);

    const result = await newCreditDesk.getUnderwriterCreditLines(protocol_owner);
    expect(String(result)).to.bignumber.equal(new BN(5));
  });
});