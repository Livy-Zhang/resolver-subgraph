import { BigInt } from "@graphprotocol/graph-ts";

import {
  DistributorCreated as DistributorCreatedContractEvent,
  RewardsDistributorFactory,
} from "../generated/RewardsDistributorFactory/RewardsDistributorFactory";
import { RewardsDistributor as RewardsDistributorContract } from "../generated/RewardsDistributorFactory/RewardsDistributor";
import { RewardsDistributor as RewardsDistributorTemplate } from "../generated/templates";
import { DistributorCreatedEvent, Resolver, RewardsDistributor } from "../generated/schema";

function eventId(hash: string, logIndex: BigInt): string {
  return hash + "-" + logIndex.toString();
}

function getOrCreateResolver(id: string): Resolver {
  let resolver = Resolver.load(id);
  if (resolver == null) {
    resolver = new Resolver(id);
    resolver.activeSelfStake = BigInt.zero();
    resolver.unstakingAmount = BigInt.zero();
    resolver.delegatedAmount = BigInt.zero();
    resolver.updatedAt = BigInt.zero();
    resolver.updatedBlock = BigInt.zero();
  }
  return resolver;
}

export function handleDistributorCreated(event: DistributorCreatedContractEvent): void {
  const resolver = getOrCreateResolver(event.params.resolver.toHexString());
  const distributorId = event.params.distributor.toHexString();
  const rewardAddress = event.params.rewardToken;
  const rewardRate = event.params.rewardRate;

  const distributor = new RewardsDistributor(distributorId);
  distributor.resolver = resolver.id;
  distributor.distributor = event.params.distributor;
  distributor.rewardAddress = rewardAddress;
  distributor.rewardsUpdater = event.params.rootPublisher;
  distributor.rewardRate = rewardRate;
  distributor.createdAt = event.block.timestamp;
  distributor.createdBlock = event.block.number;
  distributor.updatedAt = event.block.timestamp;
  distributor.updatedBlock = event.block.number;
  distributor.save();

  resolver.updatedAt = event.block.timestamp;
  resolver.updatedBlock = event.block.number;
  resolver.save();

  const history = new DistributorCreatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
  history.resolver = event.params.resolver;
  history.distributor = event.params.distributor;
  history.rewardsUpdater = event.params.rootPublisher;
  history.rewardAddress = rewardAddress;
  history.rewardRate = rewardRate;
  history.timestamp = event.block.timestamp;
  history.blockNumber = event.block.number;
  history.transactionHash = event.transaction.hash;
  history.logIndex = event.logIndex;
  history.save();

  // Future RewardRateUpdated events originate from this clone, not the Factory.
  RewardsDistributorTemplate.create(event.params.distributor);
}
