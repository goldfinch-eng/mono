#!/bin/bash

rm -rf .openzeppelin/unknown-31337.json
rm -rf deployments/localhost/
rm -rf deployments/all_dev.json
rm -rf ../client/config/pool-metadata/localhost.json
git checkout ../client2/constants/metadata/localhost.json
