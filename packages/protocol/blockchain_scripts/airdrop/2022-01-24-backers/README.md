### Backers Airdrop

This folder contains scripts for generating everything for
[this](https://gov.goldfinch.finance/t/retroactive-backer-distribution-proposal-4-same-as-3-with-ammendment/505) airdrop proposal.

The file with data is this [Google Sheet](https://docs.google.com/spreadsheets/d/1zYEHLx1lOQSEfBSyCp1WFWIPKon4PD5kF4dod7Bhl4I/edit#gid=645166810), downloaded as CSV.

Follow the installation instructions in the root folder, and then run:

```shell
$ (cd packages/protocol/blockchain_scripts/airdrop/2022-01-24-backers/ && \
     node --require hardhat/register calculation.ts \
        -i 'Backer Airdrop & Distributions - Backer Data.csv' \
        -a grants.no_vesting.json \
        -v grants.vesting.json)
```

to generate data about the airdrop.

After that run

```shell
$ cd ../../.. && node --require hardhat/register ./blockchain_scripts/merkle/merkleDistributor/generateMerkleRoot.ts \
    -i blockchain_scripts/airdrop/2022-01-24-backers/grants.vesting.json \
     > blockchain_scripts/merkle/backerMerkleDistributor/merkleDistributorInfo.json

$ node --require hardhat/register ./blockchain_scripts/merkle/merkleDirectDistributor/generateMerkleRoot.ts \
    -i blockchain_scripts/airdrop/2022-01-24-backers/grants.no_vesting.json \
    > blockchain_scripts/merkle/backerMerkleDirectDistributor/merkleDirectDistributorInfo.json
```
