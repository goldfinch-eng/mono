require('dotenv').config();

const PREFIX = "POLYGON_TEST_";

const API_URL = process.env[`${PREFIX}API_URL`];
const CONTRACT = process.env[`${PREFIX}CONTRACT`];
const PRIVATE_KEY = process.env[`${PREFIX}USER1_PRIVATE_KEY`];
const PUBLIC_KEY = process.env[`${PREFIX}USER1_PUBLIC_KEY`];

const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const web3 = createAlchemyWeb3(API_URL);

const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const tokens = require('./tokens.json');

function hashToken(tokenId, account) {
    return Buffer.from(ethers.utils.solidityKeccak256(['uint256', 'address'], [tokenId, account]).slice(2), 'hex')
}

const contract = require("../artifacts/contracts/GoldFinchAcademyParticipantNFT.sol/GoldFinchAcademyParticipantNFT.json");
const contractAddress = CONTRACT;
const nftContract = new web3.eth.Contract(contract.abi, contractAddress);

async function mintNFT() {
    const TOKEN_ID="2";
    const ACCOUNT=PUBLIC_KEY;
    const merkleTree = new MerkleTree(Object.entries(tokens).map(token => hashToken(...token)), keccak256, { sortPairs: true });
    const proof = merkleTree.getHexProof(hashToken(TOKEN_ID, ACCOUNT));
    const nonce = await web3.eth.getTransactionCount(PUBLIC_KEY, 'latest'); //get latest nonce

    console.log(`Generating transaction for minting NFT. Owner:${ACCOUNT}, Proof:${proof}`);

    //the transaction
    const tx = {
        'from': PUBLIC_KEY,
        'to': contractAddress,
        'nonce': nonce,
        'gas': 500000,
        'data': nftContract.methods.redeem(PUBLIC_KEY, TOKEN_ID, proof).encodeABI()
    };

    const signPromise = web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
    signPromise
        .then((signedTx) => {
            web3.eth.sendSignedTransaction(
                signedTx.rawTransaction,
                function (err, hash) {
                    if (!err) {
                        console.log(
                            "The hash of your transaction is: ",
                            hash,
                            "\nCheck Alchemy's Mempool to view the status of your transaction!"
                        )
                    } else {
                        console.log(
                            "Something went wrong when submitting your transaction:",
                            err
                        )
                    }
                }
            )
        })
        .catch((err) => {
            console.log(" Promise failed:", err)
        })
}

mintNFT()