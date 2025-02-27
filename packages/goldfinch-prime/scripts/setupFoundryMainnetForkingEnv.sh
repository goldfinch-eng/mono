#!/bin/bash

if ! command -v jq &> /dev/null
then
    echo "jq could not be found"
    exit
fi

if [[ -z "${ETH_RPC_URL}" ]];
then
    echo "required variable \$ETH_RPC_URL not set. Set this to an alchemy or infura node"
    exit
fi


export GOLDFINCH_CONFIG_ADDRESS="$(cat ./deployments/mainnet/GoldfinchConfig.json | jq .address --raw-output)"
export GOLDFINCH_FACTORY_ADDRESS="$(cat ./deployments/mainnet/GoldfinchFactory.json | jq .address --raw-output)"
export GO_ADDRESS=$(cat ./deployments/mainnet/Go.json | jq .address --raw-output)
export SENIOR_POOL_ADDRESS="$(cat ./deployments/mainnet/SeniorPool.json | jq .address --raw-output)"
export UID_ADDRESS=$(cat ./deployments/mainnet/UniqueIdentity.json | jq .address --raw-output)
export FIDU_ADDRESS=$(cat ./deployments/mainnet/Fidu.json | jq .address --raw-output)
export GFI_ADDRESS=$(cat ./deployments/mainnet/GFI.json | jq .address --raw-output)
export BACKER_REWARDS_ADDRESS=$(cat ./deployments/mainnet/BackerRewards.json | jq .address --raw-output)
export STAKING_REWARDS_ADDRESS=$(cat ./deployments/mainnet/StakingRewards.json | jq .address --raw-output)
