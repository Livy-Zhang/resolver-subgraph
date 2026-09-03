import {
  afterEach,
  assert,
  clearStore,
  newTypedMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

import {
  SetOperator,
  Staked,
  StakedWithdrawn,
  MinSelfStakeUpdated,
  ThawingPeriodUpdated,
  Unstaked,
} from "../generated/StakingManager/StakingManager";
import {
  handleSetOperator,
  handleStaked,
  handleStakedWithdrawn,
  handleMinSelfStakeUpdated,
  handleThawingPeriodUpdated,
  handleUnstaked,
} from "../src/staking-manager";

const MANAGER = Address.fromString("0x0000000000000000000000000000000000000002");
const RESOLVER = Address.fromString("0x00000000000000000000000000000000000000b2");
const OPERATOR_ONE = Address.fromString("0x00000000000000000000000000000000000000d4");
const OPERATOR_TWO = Address.fromString("0x00000000000000000000000000000000000000e5");
const RECIPIENT = Address.fromString("0x00000000000000000000000000000000000000f6");

function setEventMetadata(event: ethereum.Event, logIndex: i32): void {
  event.address = MANAGER;
  event.logIndex = BigInt.fromI32(logIndex);
  event.block.timestamp = BigInt.fromI32(1_700_000_000 + logIndex);
  event.block.number = BigInt.fromI32(100 + logIndex);
  event.transaction.hash = Bytes.fromHexString(
    "0x0000000000000000000000000000000000000000000000000000000000000002",
  );
}

function createStakedEvent(amount: i32, logIndex: i32): Staked {
  const event = newTypedMockEvent<Staked>();
  setEventMetadata(event, logIndex);
  event.parameters = [
    new ethereum.EventParam("resolver", ethereum.Value.fromAddress(RESOLVER)),
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  ];
  return event;
}

function createUnstakedEvent(amount: i32, logIndex: i32): Unstaked {
  const event = newTypedMockEvent<Unstaked>();
  setEventMetadata(event, logIndex);
  event.parameters = [
    new ethereum.EventParam("resolver", ethereum.Value.fromAddress(RESOLVER)),
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  ];
  return event;
}

function createWithdrawnEvent(amount: i32, logIndex: i32): StakedWithdrawn {
  const event = newTypedMockEvent<StakedWithdrawn>();
  setEventMetadata(event, logIndex);
  event.parameters = [
    new ethereum.EventParam("resolver", ethereum.Value.fromAddress(RESOLVER)),
    new ethereum.EventParam("to", ethereum.Value.fromAddress(RECIPIENT)),
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  ];
  return event;
}

function createSetOperatorEvent(operator: Address, allowed: boolean, logIndex: i32): SetOperator {
  const event = newTypedMockEvent<SetOperator>();
  setEventMetadata(event, logIndex);
  event.parameters = [
    new ethereum.EventParam("resolver", ethereum.Value.fromAddress(RESOLVER)),
    new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator)),
    new ethereum.EventParam("allowed", ethereum.Value.fromBoolean(allowed)),
  ];
  return event;
}

function createMinSelfStakeUpdatedEvent(value: i32, logIndex: i32): MinSelfStakeUpdated {
  const event = newTypedMockEvent<MinSelfStakeUpdated>();
  setEventMetadata(event, logIndex);
  event.parameters = [
    new ethereum.EventParam("minSelfStake", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(value))),
  ];
  return event;
}

function createThawingPeriodUpdatedEvent(value: i32, logIndex: i32): ThawingPeriodUpdated {
  const event = newTypedMockEvent<ThawingPeriodUpdated>();
  setEventMetadata(event, logIndex);
  event.parameters = [
    new ethereum.EventParam("thawingPeriod", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(value))),
  ];
  return event;
}

afterEach(() => {
  clearStore();
});

test("tracks active and locked self-stake through stake, unstake, and withdrawal", () => {
  handleStaked(createStakedEvent(200, 1));
  handleUnstaked(createUnstakedEvent(70, 2));
  handleStakedWithdrawn(createWithdrawnEvent(70, 3));

  assert.fieldEquals("Resolver", RESOLVER.toHexString(), "activeSelfStake", "130");
  assert.fieldEquals("Resolver", RESOLVER.toHexString(), "unstakingAmount", "0");
  assert.entityCount("StakedEvent", 1);
  assert.entityCount("UnstakedEvent", 1);
  assert.entityCount("StakedWithdrawnEvent", 1);
});

test("tracks each resolver-operator authorization independently", () => {
  handleSetOperator(createSetOperatorEvent(OPERATOR_ONE, true, 1));
  handleSetOperator(createSetOperatorEvent(OPERATOR_TWO, true, 2));
  handleSetOperator(createSetOperatorEvent(OPERATOR_ONE, false, 3));

  const authorizationOne = RESOLVER.toHexString() + "-" + OPERATOR_ONE.toHexString();
  const authorizationTwo = RESOLVER.toHexString() + "-" + OPERATOR_TWO.toHexString();

  assert.fieldEquals("OperatorAuthorization", authorizationOne, "allowed", "false");
  assert.fieldEquals("OperatorAuthorization", authorizationTwo, "allowed", "true");
  assert.entityCount("OperatorAuthorization", 2);
  assert.entityCount("OperatorUpdatedEvent", 3);
});

test("updates current staking parameters and preserves their history", () => {
  handleMinSelfStakeUpdated(createMinSelfStakeUpdatedEvent(500, 1));
  handleThawingPeriodUpdated(createThawingPeriodUpdatedEvent(86_400, 2));

  assert.fieldEquals("Protocol", "global", "minSelfStake", "500");
  assert.fieldEquals("Protocol", "global", "thawingPeriod", "86400");
  assert.entityCount("MinSelfStakeUpdatedEvent", 1);
  assert.entityCount("ThawingPeriodUpdatedEvent", 1);
});
