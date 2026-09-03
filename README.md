# Resolver Subgraph

The Graph indexer for the Resolver staking, delegation, and rewards contracts.

## Initial workflow

1. Set the deployed contract addresses and start blocks in `subgraph.yaml`.
2. Copy the compiled contract ABIs into `abis/`.
3. Run `npm run codegen` and `npm run build`.
4. Deploy to a Graph Node or The Graph service.
