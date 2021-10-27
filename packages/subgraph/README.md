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
- Start the frontend with `npm run start` to start the hardhat node and create a local subgraph node.
  - It will also execute `npm run kill-containers` to kill all containers and prevent connection issues.
  - To see how the local graph node is created, check `./start-local.sh` or `reset-start-local.sh`.
  - If you are on linux, the Graph Node Docker Compose setup uses host.docker.internal as the alias for the host machine. On Linux, this is not supported yet. The detault script already replaces the host name with the host IP address. If you have issues, run `ifconfig -a` and get the address of the docker0
- The indexing of the subgraph should start immediately.
- Urls available are:
  - JSON-RPC admin server at: http://localhost:8020
  - GraphQL HTTP server at: http://localhost:8000
  - Index node server at: http://localhost:8030
  - Metrics server at: http://localhost:8040

## Resources
- [The Graph Academy](https://thegraph.academy/developers/)
- [The Graph Academy Hub](https://github.com/TheGraphAcademy/Graph-Academy-Hub)
- [The Graph Explorer](https://thegraph.com/explorer/)
- [Subgraph Monitor](https://github.com/gnosis/thegraph-subgraphs-monitor)
- [Subgraph Toolkit](https://github.com/protofire/subgraph-toolkit)
- [Create Subgraph](https://thegraph.com/docs/developer/create-subgraph-hosted)
