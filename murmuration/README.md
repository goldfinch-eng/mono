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

# How to configure Google Cloud

1. Create a Compute Engine instance group template.
    - From this directory, run:
    ```
    gcloud compute instance-templates create-with-container \
      murmuration-goldfinch-finance-3 \
      --custom-cpu=2 \
      --custom-memory=4GB \
      --boot-disk-size=30GB \
      --metadata-from-file user-data=cloud-init.yaml \
      --tags=murmuration-goldfinch-finance-3 \
      --container-image us.gcr.io/goldfinch-frontends-dev/goldfinch-protocol/murmuration-goldfinch-finance:latest \
      --project=goldfinch-frontends-dev
    ```
1. In the Google Cloud console, create a Compute Engine instance group using the template from the previous step.
    - Configure the min number and max number of instances to `1`. There's no point to having more than one instance, because the blockchain served by hardhat lives in memory on an instance.
1. Create a firewall rule that will allow the load balancer's health checking and request forwarding. The firewall rule's target tags should be the tags of the instance group template.
    ```
    gcloud compute firewall-rules create \
    murmuration-goldfinch-finance-3 \
    --network=default \
    --action=allow \
    --direction=ingress \
    --source-ranges=130.211.0.0/22,35.191.0.0/16 \
    --target-tags=murmuration-goldfinch-finance-3 \
    --rules=tcp:80 \
    --project=goldfinch-frontends-dev
    ```
    - This command assumes that the health check you created in creating the instance group uses port 80.
1. In the Google Cloud console, create an HTTPS load balancer that uses the health check you created when creating the instance group.
    - In doing this, create an SSL certificate for `murmuration.goldfinch.finance` and use that as the load balancer's certificate.
    - Be sure to specify that the load balancer have a static IP address, rather than ephemeral IP address.
1. For continuous deployment, the deploy command in `cloudbuild.yaml` should use the appropriate instance group name and template name (NOTE: over time these names might diverge, due to creating new instance templates but continuing to use the same instance group).
1. Wherever DNS records are maintained, create an `A` record and an `AAAA` record for `murmuration.goldfinch.finance`, where the value is the static IP address that was assigned to the load balancer.

# Debugging

## Remote

When viewing the Compute Engine instance group in the Google Cloud console (i.e. https://console.cloud.google.com/compute/instanceGroups/list?project=goldfinch-frontends-dev), you can SSH into an instance, from within your web browser.

Once you've SSH'ed into an instance, you can see what Docker processes are running via `docker ps`. You can view the logs for a Docker process via `docker logs $CONTAINER_ID`, where `$CONTAINER_ID` is the container id value for the `us.gcr.io/goldfinch-frontends-dev/goldfinch-protocol/murmuration-goldfinch-finance:latest` image shown in the `docker ps` output. These logs are essential for understanding the outcome of the `npm run start:murmuration` command!

### Copying `all_dev.json` from the Murmuration instance to your local machine

```
gcloud --project=goldfinch-frontends-dev compute ssh $INSTANCE_NAME --zone=us-central1-a --command="docker cp $CONTAINER_ID:/goldfinch-protocol/packages/protocol/deployments/all_dev.json ."

gcloud --project=goldfinch-frontends-dev compute scp --zone=us-central1-a $YOUR_USERNAME@$INSTANCE_NAME:~/all_dev.json .
```
where you can obtain $CONTAINER_ID by SSHing into the instance and running `docker ps`.

## Local

To build the Docker image locally, run this command from the repo root: `docker build . -f ./murmuration/Dockerfile -t murmuration:latest`
