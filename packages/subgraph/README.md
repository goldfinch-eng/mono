Subgraphs related to the Goldfinch Protocol

## Schema
The schema is defined under: [schema.graphql](./schema.graphql)

## Assumptions
- The SeniorPool is updated every time when the following events are called:
  - DepositMade
  - InterestCollected
  - PrincipalCollected
  - ReserveFundsCollected
  - WithdrawalMade
  - PrincipalWrittenDown
  - InvestmentMadeInJunior
  - InvestmentMadeInSenior
- All the capital providers from the Senior Pool are updated on the following events:
  - InterestCollected
  - PrincipalCollected
  - PrincipalWrittenDown

## Patterns
- Build the graphQL schema as close as possible to the frontend requirements
- When designing contracts, write events with data retrieval in mind, think about the data you need to avoid doing extra queries on the subgraph
- The mappings that transform the Ethereum into entities are written in a subset of TypeScript called [AssemblyScript](https://thegraph.com/docs/developer/assemblyscript-api)

#### Create vs Update pattern

```js
let id = seniorPoolAddress.toHex()
let seniorPool = SeniorPool.load(id)

if (seniorPool === null) {
  seniorPool = new SeniorPool(id)
  seniorPool.createdAt = event.block.timestamp
}
```

#### Fetching data from smart contracts
If you have the ABIs on the contracts defined on `subgraph.yaml` you can call public methods from smart contracts:


```js
let contract = SeniorPoolContract.bind(seniorPoolAddress)
let sharePrice = contract.sharePrice()
let compoundBalance = contract.compoundBalance()
let totalLoansOutstanding = contract.totalLoansOutstanding()
let totalSupply = fidu_contract.totalSupply()
let totalPoolAssets = totalSupply.times(sharePrice)
```

#### Updating array properties
```js
// This won't work
entity.numbers.push(BigInt.fromI32(1))
entity.save()

// This will work
let numbers = entity.numbers
numbers.push(BigInt.fromI32(1))
entity.numbers = numbers
entity.save()
```

## Debugging
Debugging on the graph should be done through logs and checking the subgraph logs:
- [Logging and Debugging](https://thegraph.com/docs/developer/assemblyscript-api#logging-and-debugging)

In practical terms, logs should be added to monitor the progress of the application.

## Local run
- Make sure you have docker and docker-compose installed
- Start the frontend with npm run start to start the hardhat node
- On another terminal, clone the subgraph and go to the subgraph folder
- Run: `./reset-local.sh && ./start-local.sh` or `./start-local.sh`
  - If you are on linux, the Graph Node Docker Compose setup uses host.docker.internal as the alias for the host machine. On Linux, this is not supported yet. The detault script already replaces the host name with the host IP address. If you have issues, run `ifconfig -a` and get the address of the docker0
- The indexing of the subgraph should start immediately.
- Urls available are:
  - JSON-RPC admin server at: http://localhost:8020
  - GraphQL HTTP server at: http://localhost:8000
  - Index node server at: http://localhost:8030
  - Metrics server at: http://localhost:8040

### Quick Runs
- A quick run script is available: `packages/subgraph/quick-start.sh`. This requires a test dump to be restored to the postgres container.
  - This only works for mainnet forking
  - The network on metamask should be http://localhost:8545

### Creating local backups
- If you already have a running db and want to save it for future runs use:
  - docker exec -t <postgres-container-id> pg_dumpall -c -U graph-node > ~/dump.sql

## Validating data from the subgraph
1. Change the network to be mainnet
2. Change on App.tsx the currentBlock. eg:
```
- const currentBlock = getBlockInfo(await getCurrentBlock())
+ const currentBlock = {
+   number: 13845148,
+   timestamp: 1637262806,
+ }
```
- Add the block number on the graphql/queries.ts. eg:
```
_meta(block: {number: 13845148}) {
  ...
}
seniorPools(first: 1, block: {number: 13845148}) {
  ...
}
tranchedPools(block: {number: 13845148}) {
  ...
}
```
- On `usePoolsData`, disable the skip flag from web3 and add the validation scripts
```
  // Fetch data from subgraph
  const {error, backers: backersSubgraph, seniorPoolStatus, data} = useTranchedPoolSubgraphData(..., false)

  // Fetch data from web3 provider
  const {backers: backersWeb3, poolsAddresses} = usePoolBackersWeb3({skip: false})
  const {seniorPoolStatus: seniorPoolStatusWeb3} = useSeniorPoolStatusWeb3(capitalProvider)

  if (backersSubgraph.loaded && backersWeb3.loaded && currentBlock && goldfinchProtocol) {
    generalTranchedPoolsValidationByBackers(backersWeb3.value, backersSubgraph.value)
    generalBackerValidation(goldfinchProtocol, data, currentBlock)
  }
```
  - Beaware that running `generalBackerValidation` will run the validations for all backers which is subject to rate limit of the web3 provider
- On `src/graphql/client.ts` change the `API_URLS` for the url of the subgraph you want to validate

## Resources
- [The Graph Academy](https://thegraph.academy/developers/)
- [The Graph Academy Hub](https://github.com/TheGraphAcademy/Graph-Academy-Hub)
- [The Graph Explorer](https://thegraph.com/explorer/)
- [Subgraph Monitor](https://github.com/gnosis/thegraph-subgraphs-monitor)
- [Subgraph Toolkit](https://github.com/protofire/subgraph-toolkit)
- [Create Subgraph](https://thegraph.com/docs/developer/create-subgraph-hosted)
