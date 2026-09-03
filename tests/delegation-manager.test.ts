import {
  afterEach,
  assert,
  clearStore,
  newTypedMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

import {
  Delegated,
  FreezingPeriodUpdated,
  Redelegated,
  Undelegated,
} from "../generated/DelegationManager/DelegationManager";
import {
  handleDelegated,
  handleFreezingPeriodUpdated,
  handleRedelegated,
  handleUndelegated,
} from "../src/delegation-manager";

const MANAGER = Address.fromString("0x0000000000000000000000000000000000000001");
const ALICE = Address.fromString("0x00000000000000000000000000000000000000a1");
const BOB = Address.fromString("0x00000000000000000000000000000000000000b2");
const CAROL = Address.fromString("0x00000000000000000000000000000000000000c3");

function setEventMetadata(event: ethereum.Event, logIndex: i32): void {
  event.address = MANAGER;
  event.logIndex = BigInt.fromI32(logIndex);
  event.block.timestamp = BigInt.fromI32(1_700_000_000 + logIndex);
  event.block.number = BigInt.fromI32(100 + logIndex);
  event.transaction.hash = Bytes.fromHexString(
    "0x0000000000000000000000000000000000000000000000000000000000000001",
  );
}

function createDelegatedEvent(amount: i32, logIndex: i32): Delegated {
  const event = newTypedMockEvent<Delegated>();
  setEventMetadata(event, logIndex);
  event.parameters = [
    new ethereum.EventParam("delegator", ethereum.Value.fromAddress(ALICE)),
    new ethereum.EventParam("resolver", ethereum.Value.fromAddress(BOB)),
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  ];
  return event;
}

function createUndelegatedEvent(amount: i32, logIndex: i32): Undelegated {
  const event = newTypedMockEvent<Undelegated>();
  setEventMetadata(event, logIndex);
  event.parameters = [
    new ethereum.EventParam("delegator", ethereum.Value.fromAddress(ALICE)),
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  ];
  return event;
}

function createRedelegatedEvent(logIndex: i32): Redelegated {
  const event = newTypedMockEvent<Redelegated>();
  setEventMetadata(event, logIndex);
  event.parameters = [
    new ethereum.EventParam("delegator", ethereum.Value.fromAddress(ALICE)),
    new ethereum.EventParam("oldResolver", ethereum.Value.fromAddress(BOB)),
    new ethereum.EventParam("newResolver", ethereum.Value.fromAddress(CAROL)),
  ];
  return event;
}

function createFreezingPeriodUpdatedEvent(value: i32, logIndex: i32): FreezingPeriodUpdated {
  const event = newTypedMockEvent<FreezingPeriodUpdated>();
  setEventMetadata(event, logIndex);
  event.parameters = [
    new ethereum.EventParam("freezingPeriod", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(value))),
  ];
  return event;
}

afterEach(() => {
  clearStore();
});

test("accumulates repeated delegations in the current state and keeps event history", () => {
  handleDelegated(createDelegatedEvent(100, 1));
  handleDelegated(createDelegatedEvent(50, 2));

  assert.fieldEquals("Delegation", ALICE.toHexString(), "amount", "150");
  assert.fieldEquals("Delegation", ALICE.toHexString(), "resolver", BOB.toHexString());
  assert.fieldEquals("Resolver", BOB.toHexString(), "delegatedAmount", "150");
  assert.fieldEquals("Protocol", "global", "totalDelegated", "150");
  assert.entityCount("DelegatedEvent", 2);
});

test("removes a fully undelegated current position but retains its history", () => {
  handleDelegated(createDelegatedEvent(100, 1));
  handleUndelegated(createUndelegatedEvent(100, 2));

  assert.notInStore("Delegation", ALICE.toHexString());
  assert.fieldEquals("Resolver", BOB.toHexString(), "delegatedAmount", "0");
  assert.fieldEquals("Protocol", "global", "totalDelegated", "0");
  assert.entityCount("DelegatedEvent", 1);
  assert.entityCount("UndelegatedEvent", 1);
});

test("decreases a partially undelegated position without removing it", () => {
  handleDelegated(createDelegatedEvent(100, 1));
  handleUndelegated(createUndelegatedEvent(40, 2));

  assert.fieldEquals("Delegation", ALICE.toHexString(), "amount", "60");
  assert.fieldEquals("Resolver", BOB.toHexString(), "delegatedAmount", "60");
  assert.fieldEquals("Protocol", "global", "totalDelegated", "60");
});

test("moves the full delegation between resolvers without changing protocol total", () => {
  handleDelegated(createDelegatedEvent(100, 1));
  handleRedelegated(createRedelegatedEvent(2));

  assert.fieldEquals("Delegation", ALICE.toHexString(), "amount", "100");
  assert.fieldEquals("Delegation", ALICE.toHexString(), "resolver", CAROL.toHexString());
  assert.fieldEquals("Resolver", BOB.toHexString(), "delegatedAmount", "0");
  assert.fieldEquals("Resolver", CAROL.toHexString(), "delegatedAmount", "100");
  assert.fieldEquals("Protocol", "global", "totalDelegated", "100");
  assert.entityCount("DelegatedEvent", 1);
  assert.entityCount("RedelegatedEvent", 1);
});

test("records freezing-period updates", () => {
  handleFreezingPeriodUpdated(createFreezingPeriodUpdatedEvent(3_600, 2));

  assert.fieldEquals("Protocol", "global", "freezingPeriod", "3600");
  assert.entityCount("FreezingPeriodUpdatedEvent", 1);
});
