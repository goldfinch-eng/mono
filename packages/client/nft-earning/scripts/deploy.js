const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const tokens = require('./tokens.json');

function hashToken(tokenId, account) {
  return Buffer.from(ethers.utils.solidityKeccak256(['uint256', 'address'], [tokenId, account]).slice(2), 'hex')
}

async function main() {
  const merkleTree = new MerkleTree(Object.entries(tokens).map(token => hashToken(...token)), keccak256, { sortPairs: true });
  const MyNFT = await ethers.getContractFactory("GoldFinchAcademyParticipantNFT");

  // Start deployment, returning a promise that resolves to a contract object
  const myNFT = await MyNFT.deploy('GoldFinch Academy Participant', 'GFAP', merkleTree.getHexRoot());
  console.log("Contract deployed to address:", myNFT.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
