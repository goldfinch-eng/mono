const { accounts, contract } = require('@openzeppelin/test-environment');
const [ owner ] = accounts;

const { expect } = require('chai');

const GoldfinchPool = contract.fromArtifact('GoldfinchPool');

describe('GoldfinchPool', function () {
  it('deployer is owner', async function () {
    const pool = await GoldfinchPool.new({ from: owner });
    expect(await pool.owner()).to.equal(owner);
  });
});