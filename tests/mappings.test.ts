import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { afterEach, assert, clearStore, describe, test, newTypedMockEventWithParams } from "matchstick-as/assembly/index";
import { Delegated, Undelegated, Redelegated } from "../generated/DelegationManager/DelegationManager";
import { DistributorCreated } from "../generated/RewardsDistributorFactory/RewardsDistributorFactory";
import { RewardRateUpdated } from "../generated/templates/RewardsDistributor/RewardsDistributor";
import { handleDelegated, handleUndelegated, handleRedelegated } from "../src/delegation-manager";
import { handleDistributorCreated } from "../src/rewards-distributor-factory";
import { handleRewardRateUpdated } from "../src/rewards-distributor";

const A = "0x0000000000000000000000000000000000000001";
const B = "0x0000000000000000000000000000000000000002";
const C = "0x0000000000000000000000000000000000000003";
const D = "0x0000000000000000000000000000000000000004";

function p(name: string, value: ethereum.Value): ethereum.EventParam { return new ethereum.EventParam(name, value); }
function setup<E extends ethereum.Event>(event: E, hash: string, index: i32): E {
  event.transaction.hash = Bytes.fromHexString(hash) as Bytes;
  event.logIndex = BigInt.fromI32(index);
  event.block.number = BigInt.fromI32(index + 1);
  event.block.timestamp = BigInt.fromI32(1000 + index);
  return event;
}

describe("delegation mappings", () => {
  afterEach(() => clearStore());
  test("handles delegated, partial undelegated and redelegated", () => {
    let e = setup(newTypedMockEventWithParams<Delegated>([p("delegator", ethereum.Value.fromAddress(Address.fromString(B))), p("resolver", ethereum.Value.fromAddress(Address.fromString(A))), p("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100)))]), "0x" + "11".repeat(32), 1);
    handleDelegated(e);
    assert.fieldEquals("Delegation", B, "amount", "100");
    let u = setup(newTypedMockEventWithParams<Undelegated>([p("delegator", ethereum.Value.fromAddress(Address.fromString(B))), p("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(40)))]), "0x" + "22".repeat(32), 2);
    handleUndelegated(u);
    assert.fieldEquals("Delegation", B, "amount", "60");
    let r = setup(newTypedMockEventWithParams<Redelegated>([p("delegator", ethereum.Value.fromAddress(Address.fromString(B))), p("oldResolver", ethereum.Value.fromAddress(Address.fromString(A))), p("newResolver", ethereum.Value.fromAddress(Address.fromString(C)))]), "0x" + "33".repeat(32), 3);
    handleRedelegated(r);
    assert.fieldEquals("Delegation", B, "resolver", C);
  });
});

describe("distributor mappings", () => {
  afterEach(() => clearStore());
  test("stores rewardsUpdater and updates reward rate", () => {
    let e = setup(newTypedMockEventWithParams<DistributorCreated>([
      p("resolver", ethereum.Value.fromAddress(Address.fromString(A))), p("distributor", ethereum.Value.fromAddress(Address.fromString(D))), p("rootPublisher", ethereum.Value.fromAddress(Address.fromString(B))), p("rewardToken", ethereum.Value.fromAddress(Address.fromString(C))), p("rewardRate", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10)))
    ]), "0x" + "44".repeat(32), 4);
    handleDistributorCreated(e);
    assert.fieldEquals("RewardsDistributor", D, "rewardsUpdater", B);
    let update = setup(newTypedMockEventWithParams<RewardRateUpdated>([
      p("previousRewardRate", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10))), p("newRewardRate", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(20)))
    ]), "0x" + "55".repeat(32), 5);
    update.address = Address.fromString(D);
    handleRewardRateUpdated(update);
    assert.fieldEquals("RewardsDistributor", D, "rewardRate", "20");
  });
  test("replaying the same event is idempotent", () => {
    let e = setup(newTypedMockEventWithParams<DistributorCreated>([
      p("resolver", ethereum.Value.fromAddress(Address.fromString(A))), p("distributor", ethereum.Value.fromAddress(Address.fromString(D))), p("rootPublisher", ethereum.Value.fromAddress(Address.fromString(B))), p("rewardToken", ethereum.Value.fromAddress(Address.fromString(C))), p("rewardRate", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10)))
    ]), "0x" + "66".repeat(32), 6);
    handleDistributorCreated(e); handleDistributorCreated(e);
    assert.entityCount("DistributorCreatedEvent", 1);
    assert.entityCount("RewardsDistributor", 1);
  });
});
