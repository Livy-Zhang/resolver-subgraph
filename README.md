# Resolver Subgraph

This subgraph is the public GraphQL read model for the Resolver staking,
delegation, and rewards protocol. It indexes the deployment and exposes
both the latest protocol state and an immutable event history.

## Indexed contracts

| Contract | Sepolia address | Start block | Indexed events |
| --- | --- | ---: | --- |
| `StakingManager` | `0x46F173816ACA426ba1110517f45c6cbbbc38fDaa` | 11,627,430 | `Staked`, `Unstaked`, `StakedWithdrawn`, `SetOperator`, `MinSelfStakeUpdated`, `ThawingPeriodUpdated` |
| `DelegationManager` | `0x64E8E0051DA7991142911376865f9Ec1f5E33e4f` | 11,627,441 | `Delegated`, `Undelegated`, `Redelegated`, `FreezingPeriodUpdated` |
| `RewardsDistributorFactory` | `0x7A9CE1F71c8ca1D4A7fA350D5dA8fd629EFe1e00` | 11,627,443 | `DistributorCreated` |
| Dynamic `RewardsDistributor` clones | Created from the factory event | N/A | `RewardRateUpdated` |

The canonical addresses, blocks, ABI bindings, and event handlers are defined in
[`subgraph.yaml`](./subgraph.yaml). Update this table and the manifest together
when deploying to another network.

## Data model

The schema deliberately has two layers.

### Mutable state

These entities answer “what is true now?”

| Entity | ID | Purpose |
| --- | --- | --- |
| `Protocol` | Always `global` | Total delegated amount and protocol parameters. |
| `Resolver` | Resolver address | Active/unstaking self-stake, delegated amount, and related operator/distributor state. |
| `Delegation` | Delegator address | Current delegated amount and selected resolver. |
| `OperatorAuthorization` | `<resolver>-<operator>` | Current operator permission for a resolver. |
| `RewardsDistributor` | Distributor address | Current reward token, updater, and reward rate for a resolver’s distributor. |

### Immutable history

Every history record uses `<transactionHash>-<logIndex>` as its ID and includes
the source block, timestamp, transaction hash, and log index. This layer is
intended for replay, audit, and time-bounded accounting.

| Domain | History entities |
| --- | --- |
| Delegation | `DelegatedEvent`, `UndelegatedEvent`, `RedelegatedEvent`, `FreezingPeriodUpdatedEvent` |
| Staking | `StakedEvent`, `UnstakedEvent`, `StakedWithdrawnEvent`, `OperatorUpdatedEvent`, `MinSelfStakeUpdatedEvent`, `ThawingPeriodUpdatedEvent` |
| Rewards | `DistributorCreatedEvent`, `RewardRateUpdatedEvent` |

`UndelegatedEvent`, `RedelegatedEvent`, and `RewardRateUpdatedEvent` have an
optional `anomaly` field. A non-null value means the event was received but a
required prior state entity was missing, so the mapping retained all recoverable
raw event data rather than silently dropping it. Fields that cannot be recovered
are `null`; consumers must not use anomalous records for accounting.

## Backend usage

`resolver-network` uses this subgraph as its accounting data source. It queries:

- `_meta { block { number } hasIndexingErrors }` before processing a snapshot;
- non-zero `Delegation` records at a pinned block for current delegation
  snapshots;
- `DelegatedEvent`, `UndelegatedEvent`, and `RedelegatedEvent` in a time range
  to replay delegation weights;
- `DistributorCreatedEvent` and `RewardRateUpdatedEvent` to determine each
  resolver’s monthly reward-rate configuration.

Consumers should paginate by `id`, pin multi-query reads to the same block, and
reject records with a non-null `anomaly`. `hasIndexingErrors: false` is necessary
but does not by itself prove that no business-level anomaly occurred.

## Querying the API

Deploy the subgraph to Subgraph Studio/The Graph Network or a Graph Node, then
replace `$GRAPH_ENDPOINT` below with its GraphQL query URL. Keep provider API
keys in a secret manager or environment variable; do not commit them.

### Current resolver and delegation state

```bash
curl "$GRAPH_ENDPOINT" \
  -H 'content-type: application/json' \
  --data '{
    "query": "query CurrentState { protocol(id: \"global\") { totalDelegated minSelfStake thawingPeriod freezingPeriod updatedBlock } resolvers(first: 100, orderBy: delegatedAmount, orderDirection: desc) { id activeSelfStake unstakingAmount delegatedAmount rewardsDistributor { id rewardAddress rewardRate rewardsUpdater } } delegations(first: 100, where: { amount_gt: \"0\" }) { id delegator amount resolver { id } } }"
  }'
```

### Delegation events for an accounting period

Use Unix timestamps. The `anomaly` field is intentionally requested so an
accounting client can reject incomplete records.

```graphql
query DelegationHistory($from: BigInt!, $to: BigInt!) {
  delegatedEvents(first: 1000, orderBy: id, orderDirection: asc, where: { timestamp_gte: $from, timestamp_lt: $to }) {
    id delegator resolver amount timestamp blockNumber transactionHash logIndex
  }
  undelegatedEvents(first: 1000, orderBy: id, orderDirection: asc, where: { timestamp_gte: $from, timestamp_lt: $to }) {
    id delegator resolver amount anomaly timestamp blockNumber transactionHash logIndex
  }
  redelegatedEvents(first: 1000, orderBy: id, orderDirection: asc, where: { timestamp_gte: $from, timestamp_lt: $to }) {
    id delegator oldResolver newResolver amount anomaly timestamp blockNumber transactionHash logIndex
  }
}
```

For more than 1,000 rows, repeat each query with an `id_gt` cursor using the
largest returned ID. For a consistent multi-page accounting run, query a pinned
block (`block: { number: ... }`) after first reading `_meta`.

### Reward-rate history

```graphql
query RewardRateHistory($from: BigInt!, $to: BigInt!) {
  distributorCreatedEvents(first: 1000, where: { timestamp_gte: $from, timestamp_lt: $to }) {
    resolver distributor rewardAddress rewardsUpdater rewardRate timestamp
  }
  rewardRateUpdatedEvents(first: 1000, where: { timestamp_gte: $from, timestamp_lt: $to }) {
    resolver distributor rewardAddress previousRewardRate newRewardRate anomaly timestamp
  }
}
```

## Development

```bash
npm ci
npm run codegen
npm run build
npx graph test -r
```

`graph test -r` forces Matchstick to recompile the tests. Generated files,
build output, Matchstick WASM files, and Docker test cache are ignored by Git.

The CI workflow runs code generation, build, and the same forced-recompile test
command on pull requests and pushes to `main`.
