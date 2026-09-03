import { BigInt, Bytes } from "@graphprotocol/graph-ts";

import { RewardRateUpdated as RewardRateUpdatedContractEvent } from "../generated/templates/RewardsDistributor/RewardsDistributor";
import { RewardRateUpdatedEvent, RewardsDistributor } from "../generated/schema";

function eventId(hash: string, logIndex: BigInt): string {
  return hash + "-" + logIndex.toString();
}

export function handleRewardRateUpdated(event: RewardRateUpdatedContractEvent): void {
  const distributorId = event.address.toHexString();
  const distributor = RewardsDistributor.load(distributorId);
  if (distributor == null) return;

  distributor.rewardRate = event.params.newRewardRate;
  distributor.updatedAt = event.block.timestamp;
  distributor.updatedBlock = event.block.number;
  distributor.save();

  const history = new RewardRateUpdatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
  history.resolver = Bytes.fromHexString(distributor.resolver) as Bytes;
  history.distributor = event.address;
  history.rewardAddress = distributor.rewardAddress;
  history.previousRewardRate = event.params.previousRewardRate;
  history.newRewardRate = event.params.newRewardRate;
  history.timestamp = event.block.timestamp;
  history.blockNumber = event.block.number;
  history.transactionHash = event.transaction.hash;
  history.logIndex = event.logIndex;
  history.save();
}
