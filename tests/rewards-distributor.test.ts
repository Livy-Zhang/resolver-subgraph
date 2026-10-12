import {
  afterEach,
  assert,
  clearStore,
  newTypedMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

import { DistributorCreated } from "../generated/RewardsDistributorFactory/RewardsDistributorFactory";
import { RewardRateUpdated } from "../generated/templates/RewardsDistributor/RewardsDistributor";
import { handleDistributorCreated } from "../src/rewards-distributor-factory";
import { handleRewardRateUpdated } from "../src/rewards-distributor";

const FACTORY = Address.fromString("0x00000000000000000000000000000000000000f1");
const RESOLVER = Address.fromString("0x00000000000000000000000000000000000000a1");
const DISTRIBUTOR = Address.fromString("0x00000000000000000000000000000000000000d1");
const REWARD_TOKEN = Address.fromString("0x00000000000000000000000000000000000000e1");
const ROOT_PUBLISHER = Address.fromString("0x00000000000000000000000000000000000000b1");

function setMetadata(event: ethereum.Event, address: Address, logIndex: i32): void {
  event.address = address;
  event.logIndex = BigInt.fromI32(logIndex);
  event.block.timestamp = BigInt.fromI32(1_700_000_000 + logIndex);
  event.block.number = BigInt.fromI32(100 + logIndex);
  event.transaction.hash = Bytes.fromHexString(
    "0x00000000000000000000000000000000000000000000000000000000000000f1",
  );
}

function createDistributorCreatedEvent(): DistributorCreated {
  const event = newTypedMockEvent<DistributorCreated>();
  setMetadata(event, FACTORY, 1);
  event.parameters = [
    new ethereum.EventParam("resolver", ethereum.Value.fromAddress(RESOLVER)),
    new ethereum.EventParam("distributor", ethereum.Value.fromAddress(DISTRIBUTOR)),
    new ethereum.EventParam("rootPublisher", ethereum.Value.fromAddress(ROOT_PUBLISHER)),
    new ethereum.EventParam("rewardToken", ethereum.Value.fromAddress(REWARD_TOKEN)),
    new ethereum.EventParam("rewardRate", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1_000))),
  ];
  return event;
}

function createRateUpdatedEvent(previousRate: i32, newRate: i32): RewardRateUpdated {
  const event = newTypedMockEvent<RewardRateUpdated>();
  setMetadata(event, DISTRIBUTOR, 2);
  event.parameters = [
    new ethereum.EventParam("previousRewardRate", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(previousRate))),
    new ethereum.EventParam("newRewardRate", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(newRate))),
  ];
  return event;
}

afterEach(() => {
  clearStore();
});

test("stores the resolver's distributor and its initial reward configuration", () => {
  handleDistributorCreated(createDistributorCreatedEvent());

  assert.fieldEquals("RewardsDistributor", DISTRIBUTOR.toHexString(), "resolver", RESOLVER.toHexString());
  assert.fieldEquals("RewardsDistributor", DISTRIBUTOR.toHexString(), "distributor", DISTRIBUTOR.toHexString());
  assert.fieldEquals("RewardsDistributor", DISTRIBUTOR.toHexString(), "rewardAddress", REWARD_TOKEN.toHexString());
  assert.fieldEquals("RewardsDistributor", DISTRIBUTOR.toHexString(), "rewardRate", "1000");
  assert.entityCount("DistributorCreatedEvent", 1);
});

test("updates the current reward rate and preserves the update event", () => {
  handleDistributorCreated(createDistributorCreatedEvent());
  handleRewardRateUpdated(createRateUpdatedEvent(1_000, 1_500));

  assert.fieldEquals("RewardsDistributor", DISTRIBUTOR.toHexString(), "rewardRate", "1500");
  assert.fieldEquals("RewardRateUpdatedEvent", "0x00000000000000000000000000000000000000000000000000000000000000f1-2", "resolver", RESOLVER.toHexString());
  assert.fieldEquals("RewardRateUpdatedEvent", "0x00000000000000000000000000000000000000000000000000000000000000f1-2", "rewardAddress", REWARD_TOKEN.toHexString());
  assert.entityCount("RewardRateUpdatedEvent", 1);
});

test("records an anomalous reward-rate update when the distributor is missing", () => {
  handleRewardRateUpdated(createRateUpdatedEvent(1_000, 1_500));

  const id = "0x00000000000000000000000000000000000000000000000000000000000000f1-2";
  assert.fieldEquals("RewardRateUpdatedEvent", id, "distributor", DISTRIBUTOR.toHexString());
  assert.fieldEquals("RewardRateUpdatedEvent", id, "previousRewardRate", "1000");
  assert.fieldEquals("RewardRateUpdatedEvent", id, "newRewardRate", "1500");
  assert.fieldEquals("RewardRateUpdatedEvent", id, "anomaly", "MISSING_DISTRIBUTOR");
});
