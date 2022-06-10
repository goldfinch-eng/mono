const { ethers } = require('hardhat');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { expect } = require('chai');
const tokens = require('./tokens.json');

const chai = require("chai");
const { solidity } = require( "ethereum-waffle" );

chai.use(solidity);

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then(f => f.deployed());
}

function hashToken(tokenId, account) {
  return Buffer.from(ethers.utils.solidityKeccak256(['uint256', 'address'], [tokenId, account]).slice(2), 'hex')
}


describe('ERC721MerkleDrop', function () {
  before(async function() {
    this.accounts = await ethers.getSigners();
    this.merkleTree = new MerkleTree(Object.entries(tokens).map(token => hashToken(...token)), keccak256, { sortPairs: true });
  });

  describe('Mint all elements', function () {
    before(async function() {
      this.registry = await deploy('GoldFinchAcademyParticipantNFT', 'Name', 'Symbol', this.merkleTree.getHexRoot());
    });

    for (const [tokenId, account] of Object.entries(tokens)) {
      it('element', async function () {
        /**
         * Create merkle proof (anyone with knowledge of the merkle tree)
         */
        const proof = this.merkleTree.getHexProof(hashToken(tokenId, account));
        /**
         * Redeems token using merkle proof (anyone with the proof)
         */
        await expect(this.registry.redeem(account, tokenId, proof))
          .to.emit(this.registry, 'Transfer')
          .withArgs(ethers.constants.AddressZero, account, tokenId);

        expect(await this.registry.tokenURI(tokenId)).to.equal(`https://gateway.pinata.cloud/ipfs/QmTWVxbMgVQfsFvAnJJoEYx52rpDLo3jRN8ALWjV1sbiYJ#${tokenId}`);
      });
    }
  });

  describe('Duplicate mint', function () {
    before(async function() {
      this.registry = await deploy('GoldFinchAcademyParticipantNFT', 'Name', 'Symbol', this.merkleTree.getHexRoot());

      this.token = {};
      [ this.token.tokenId, this.token.account ] = Object.entries(tokens).find(Boolean);
      this.token.proof = this.merkleTree.getHexProof(hashToken(this.token.tokenId, this.token.account));
    });

    it('mint once - success', async function () {
      await expect(this.registry.redeem(this.token.account, this.token.tokenId, this.token.proof))
        .to.emit(this.registry, 'Transfer')
        .withArgs(ethers.constants.AddressZero, this.token.account, this.token.tokenId);
    });

    it('mint twice - failure', async function () {
      await expect(this.registry.redeem(this.token.account, this.token.tokenId, this.token.proof))
        .to.be.revertedWith('ERC721: token already minted');
    });
  });

  describe('Frontrun', function () {
    before(async function() {
      this.registry = await deploy('GoldFinchAcademyParticipantNFT', 'Name', 'Symbol', this.merkleTree.getHexRoot());

      this.token = {};
      [ this.token.tokenId, this.token.account ] = Object.entries(tokens).find(Boolean);
      this.token.proof = this.merkleTree.getHexProof(hashToken(this.token.tokenId, this.token.account));
    });

    it('prevented', async function () {
      await expect(this.registry.redeem(this.accounts[0].address, this.token.tokenId, this.token.proof))
        .to.be.revertedWith('Invalid merkle proof');
    });
  });
});
