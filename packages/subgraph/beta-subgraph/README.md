# beta-subgraph

This subdirectory contains info related to provisioning and deploying a version of our subgraph on AWS ECS, using the [Docker Compose integration with ECS](https://docs.docker.com/cloud/ecs-integration/). We call this the "beta" subgraph as it's intended to support the https://beta.app.goldfinch.finance app. This subgraph is configured to index from the Tenderly fork whose RPC url is defined in `.env.beta-subgraph`.

## Deploying to ECS

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

To take down the deployed cluster, run:

```
docker compose --env-file beta-subgraph/.env.beta-subgraph down
```
