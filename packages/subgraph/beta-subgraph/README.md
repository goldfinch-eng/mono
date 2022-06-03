# beta-subgraph

This subdirectory contains info related to provisioning and deploying a version of our subgraph on AWS ECS, using the [Docker Compose integration with ECS](https://docs.docker.com/cloud/ecs-integration/). We call this the "beta" subgraph as it's intended to support the https://beta.app.goldfinch.finance app. This subgraph is configured to index from the Tenderly fork whose RPC url is defined in `.env.beta-subgraph`.

## Deployment on ECS

### Creating a cluster

From the `packages/subgraph` dir:

1. First, create an ECS context. This requires having already configured an AWS CLI profile:
  ```
  docker context create ecs myecscontext
  ```
2. Use the ECS context you created:
  ```
  docker context use myecscontext
  ```

3. Deploy:
  ```
  docker compose --env-file beta-subgraph/.env.beta-subgraph up
  ```

**NOTE:** By default, the deployed cluster will be open to all IP addresses on the internet, on all ports exposed by the Docker containers defined in `docker-compose.yml`. If you care about more security than this -- which we would if we were running this as a production service -- we'd want to use [overlays](https://docs.docker.com/cloud/ecs-integration/#tuning-the-cloudformation-template) in our `docker-compose.yml` file to configure the rules of the security groups created by AWS CloudFormation.

### Destroying a cluster

From the `packages/subgraph` dir:

1. Use your ECS context:
  ```
  docker context use myecscontext
  ```

2. Destroy the cluster:
  ```
  docker compose --env-file beta-subgraph/.env.beta-subgraph down
  ```
