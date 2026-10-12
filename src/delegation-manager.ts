import { Address, BigInt, log, store } from "@graphprotocol/graph-ts";

import {
  Delegated as DelegatedContractEvent,
  FreezingPeriodUpdated as FreezingPeriodUpdatedContractEvent,
  Redelegated as RedelegatedContractEvent,
  Undelegated as UndelegatedContractEvent,
} from "../generated/DelegationManager/DelegationManager";
import {
  Delegation,
  DelegatedEvent,
  FreezingPeriodUpdatedEvent,
  Protocol,
  RedelegatedEvent,
  Resolver,
  UndelegatedEvent,
} from "../generated/schema";

const PROTOCOL_ID = "global";

function eventId(hash: string, logIndex: BigInt): string {
  return hash + "-" + logIndex.toString();
}

function getOrCreateProtocol(): Protocol {
  let protocol = Protocol.load(PROTOCOL_ID);
  if (protocol == null) {
    protocol = new Protocol(PROTOCOL_ID);
    protocol.totalDelegated = BigInt.zero();
    protocol.freezingPeriod = BigInt.zero();
    protocol.minSelfStake = BigInt.zero();
    protocol.thawingPeriod = BigInt.zero();
    protocol.updatedAt = BigInt.zero();
    protocol.updatedBlock = BigInt.zero();
  }
  return protocol;
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

export function handleDelegated(event: DelegatedContractEvent): void {
  const delegatorId = event.params.delegator.toHexString();
  const resolver = getOrCreateResolver(event.params.resolver.toHexString());
  const protocol = getOrCreateProtocol();
  let delegation = Delegation.load(delegatorId);

  if (delegation == null) {
    delegation = new Delegation(delegatorId);
    delegation.delegator = event.params.delegator;
    delegation.amount = BigInt.zero();
  }

  delegation.resolver = resolver.id;
  delegation.amount = delegation.amount.plus(event.params.amount);
  delegation.updatedAt = event.block.timestamp;
  delegation.updatedBlock = event.block.number;
  delegation.save();

  resolver.delegatedAmount = resolver.delegatedAmount.plus(event.params.amount);
  resolver.updatedAt = event.block.timestamp;
  resolver.updatedBlock = event.block.number;
  resolver.save();

  protocol.totalDelegated = protocol.totalDelegated.plus(event.params.amount);
  protocol.updatedAt = event.block.timestamp;
  protocol.updatedBlock = event.block.number;
  protocol.save();

  const history = new DelegatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
  history.delegator = event.params.delegator;
  history.resolver = event.params.resolver;
  history.amount = event.params.amount;
  history.timestamp = event.block.timestamp;
  history.blockNumber = event.block.number;
  history.transactionHash = event.transaction.hash;
  history.logIndex = event.logIndex;
  history.save();
}

export function handleUndelegated(event: UndelegatedContractEvent): void {
  const delegatorId = event.params.delegator.toHexString();
  let delegation = Delegation.load(delegatorId);
  if (delegation == null) {
    log.warning("Undelegated event has no delegation: tx={}, delegator={}", [
      event.transaction.hash.toHexString(),
      delegatorId,
    ]);
    const history = new UndelegatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
    history.delegator = event.params.delegator;
    history.amount = event.params.amount;
    history.anomaly = "MISSING_DELEGATION";
    history.timestamp = event.block.timestamp;
    history.blockNumber = event.block.number;
    history.transactionHash = event.transaction.hash;
    history.logIndex = event.logIndex;
    history.save();
    return;
  }

  const resolverId = delegation.resolver;
  let resolver = Resolver.load(resolverId);
  if (resolver == null) {
    log.warning("Undelegated event has no resolver: tx={}, resolver={}", [
      event.transaction.hash.toHexString(),
      resolverId,
    ]);
    const history = new UndelegatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
    history.delegator = event.params.delegator;
    history.resolver = Address.fromString(resolverId);
    history.amount = event.params.amount;
    history.anomaly = "MISSING_RESOLVER";
    history.timestamp = event.block.timestamp;
    history.blockNumber = event.block.number;
    history.transactionHash = event.transaction.hash;
    history.logIndex = event.logIndex;
    history.save();
    return;
  }

  const protocol = getOrCreateProtocol();
  const remainingAmount = delegation.amount.minus(event.params.amount);
  if (remainingAmount.equals(BigInt.zero())) {
    store.remove("Delegation", delegatorId);
  } else {
    delegation.amount = remainingAmount;
    delegation.updatedAt = event.block.timestamp;
    delegation.updatedBlock = event.block.number;
    delegation.save();
  }

  resolver.delegatedAmount = resolver.delegatedAmount.minus(event.params.amount);
  resolver.updatedAt = event.block.timestamp;
  resolver.updatedBlock = event.block.number;
  resolver.save();

  protocol.totalDelegated = protocol.totalDelegated.minus(event.params.amount);
  protocol.updatedAt = event.block.timestamp;
  protocol.updatedBlock = event.block.number;
  protocol.save();

  const history = new UndelegatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
  history.delegator = event.params.delegator;
  history.resolver = Address.fromString(resolverId);
  history.amount = event.params.amount;
  history.timestamp = event.block.timestamp;
  history.blockNumber = event.block.number;
  history.transactionHash = event.transaction.hash;
  history.logIndex = event.logIndex;
  history.save();
}

export function handleRedelegated(event: RedelegatedContractEvent): void {
  const delegatorId = event.params.delegator.toHexString();
  let delegation = Delegation.load(delegatorId);
  if (delegation == null) {
    log.warning("Redelegated event has no delegation: tx={}, delegator={}", [
      event.transaction.hash.toHexString(),
      delegatorId,
    ]);
    const history = new RedelegatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
    history.delegator = event.params.delegator;
    history.oldResolver = event.params.oldResolver;
    history.newResolver = event.params.newResolver;
    history.anomaly = "MISSING_DELEGATION";
    history.timestamp = event.block.timestamp;
    history.blockNumber = event.block.number;
    history.transactionHash = event.transaction.hash;
    history.logIndex = event.logIndex;
    history.save();
    return;
  }

  let oldResolver = Resolver.load(event.params.oldResolver.toHexString());
  if (oldResolver == null) {
    log.warning("Redelegated event has no old resolver: tx={}, resolver={}", [
      event.transaction.hash.toHexString(),
      event.params.oldResolver.toHexString(),
    ]);
    const history = new RedelegatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
    history.delegator = event.params.delegator;
    history.oldResolver = event.params.oldResolver;
    history.newResolver = event.params.newResolver;
    history.amount = delegation.amount;
    history.anomaly = "MISSING_OLD_RESOLVER";
    history.timestamp = event.block.timestamp;
    history.blockNumber = event.block.number;
    history.transactionHash = event.transaction.hash;
    history.logIndex = event.logIndex;
    history.save();
    return;
  }

  const newResolver = getOrCreateResolver(event.params.newResolver.toHexString());
  const amount = delegation.amount;
  delegation.resolver = newResolver.id;
  delegation.updatedAt = event.block.timestamp;
  delegation.updatedBlock = event.block.number;
  delegation.save();

  oldResolver.delegatedAmount = oldResolver.delegatedAmount.minus(amount);
  oldResolver.updatedAt = event.block.timestamp;
  oldResolver.updatedBlock = event.block.number;
  oldResolver.save();

  newResolver.delegatedAmount = newResolver.delegatedAmount.plus(amount);
  newResolver.updatedAt = event.block.timestamp;
  newResolver.updatedBlock = event.block.number;
  newResolver.save();

  const history = new RedelegatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
  history.delegator = event.params.delegator;
  history.oldResolver = event.params.oldResolver;
  history.newResolver = event.params.newResolver;
  history.amount = amount;
  history.timestamp = event.block.timestamp;
  history.blockNumber = event.block.number;
  history.transactionHash = event.transaction.hash;
  history.logIndex = event.logIndex;
  history.save();
}

export function handleFreezingPeriodUpdated(event: FreezingPeriodUpdatedContractEvent): void {
  const protocol = getOrCreateProtocol();
  protocol.freezingPeriod = event.params.freezingPeriod;
  protocol.updatedAt = event.block.timestamp;
  protocol.updatedBlock = event.block.number;
  protocol.save();

  const history = new FreezingPeriodUpdatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
  history.freezingPeriod = event.params.freezingPeriod;
  history.timestamp = event.block.timestamp;
  history.blockNumber = event.block.number;
  history.transactionHash = event.transaction.hash;
  history.logIndex = event.logIndex;
  history.save();
}
