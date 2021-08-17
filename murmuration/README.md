# Overview

`https://murmuration.goldfinch.finance` is a manual-testing environment that can be used by the entire team. In essence, it uses the same architecture as we use in local development, it's just running in the cloud.

It runs on a Google Compute Engine instance, and is deployed to continuously via Google Cloud Build upon pushing to the `murmuration-goldfinch-finance` branch. (This Google Cloud Build trigger was configured manually in the Cloud Build console.) It runs using the same services that we use in local development:
- the client is served by the Webpack dev server
- the blockchain is run via `npx hardhat node`
- the autotasks server runs via `npx hardhat run`
- it uses the `goldfinch-frontends-dev` Google Cloud functions, by default

Note: every deploy creates a new, mainnet-forked blockchain. So any blockchain state you might have created in using `https://murmuration.goldfinch.finance` will not persist across deploys.

# How to use

You can access the client at `https://murmuration.goldfinch.finance`.

To use the client with the murmuration blockchain, you will need to add a custom network in Metamask. The url of the custom network must be `https://murmuration.goldfinch.finance/_chain`. The chain id for the custom network must be 31337.

# How to configure in Google Cloud

1. Create a Compute Engine instance group template.
    ```
    gcloud compute instance-templates create-with-container \
      murmuration-goldfinch-finance-2 \
      --custom-cpu=2 \
      --custom-memory=4GB \
      --boot-disk-size=20GB \
      --tags=murmuration-goldfinch-finance-2 \
      --container-image us.gcr.io/goldfinch-frontends-dev/goldfinch-protocol/murmuration-goldfinch-finance:latest \
      --project=goldfinch-frontends-dev
    ```
1. In the Google Cloud console, create a Compute Engine instance group using the template from the previous step.
1. Create a firewall rule allowing the load balancer's health checking and request forwarding. The firewall rule's target tags should be the tags of the instance group template.
    ```
    gcloud compute firewall-rules create \
    murmuration-goldfinch-finance-2 \
    --network=default \
    --action=allow \
    --direction=ingress \
    --source-ranges=130.211.0.0/22,35.191.0.0/16     --target-tags=murmuration-goldfinch-finance-2 \
    --rules=tcp:80 \
    --project=goldfinch-frontends-dev
    ```
1. In the Google Cloud console, create a load balancer that uses the health check you created when creating the instance group.
1. For continuous deployment, the deploy command in `cloudbuild.yaml` should use the appropriate instance group and template name, i.e. `murmuration-goldfinch-finance-2`.
