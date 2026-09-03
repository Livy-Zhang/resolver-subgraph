import { BigInt } from "@graphprotocol/graph-ts";

import {
  MinSelfStakeUpdated as MinSelfStakeUpdatedContractEvent,
  SetOperator as SetOperatorContractEvent,
  Staked as StakedContractEvent,
  StakedWithdrawn as StakedWithdrawnContractEvent,
  ThawingPeriodUpdated as ThawingPeriodUpdatedContractEvent,
  Unstaked as UnstakedContractEvent,
} from "../generated/StakingManager/StakingManager";
import {
  MinSelfStakeUpdatedEvent,
  OperatorAuthorization,
  OperatorUpdatedEvent,
  Protocol,
  Resolver,
  StakedEvent,
  StakedWithdrawnEvent,
  ThawingPeriodUpdatedEvent,
  UnstakedEvent,
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

export function handleStaked(event: StakedContractEvent): void {
  const resolver = getOrCreateResolver(event.params.resolver.toHexString());
  resolver.activeSelfStake = resolver.activeSelfStake.plus(event.params.amount);
  resolver.updatedAt = event.block.timestamp;
  resolver.updatedBlock = event.block.number;
  resolver.save();

  const history = new StakedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
  history.resolver = event.params.resolver;
  history.amount = event.params.amount;
  history.timestamp = event.block.timestamp;
  history.blockNumber = event.block.number;
  history.transactionHash = event.transaction.hash;
  history.logIndex = event.logIndex;
  history.save();
}

export function handleUnstaked(event: UnstakedContractEvent): void {
  const resolver = getOrCreateResolver(event.params.resolver.toHexString());
  resolver.activeSelfStake = resolver.activeSelfStake.minus(event.params.amount);
  resolver.unstakingAmount = resolver.unstakingAmount.plus(event.params.amount);
  resolver.updatedAt = event.block.timestamp;
  resolver.updatedBlock = event.block.number;
  resolver.save();

  const history = new UnstakedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
  history.resolver = event.params.resolver;
  history.amount = event.params.amount;
  history.timestamp = event.block.timestamp;
  history.blockNumber = event.block.number;
  history.transactionHash = event.transaction.hash;
  history.logIndex = event.logIndex;
  history.save();
}

export function handleStakedWithdrawn(event: StakedWithdrawnContractEvent): void {
  const resolver = getOrCreateResolver(event.params.resolver.toHexString());
  resolver.unstakingAmount = resolver.unstakingAmount.minus(event.params.amount);
  resolver.updatedAt = event.block.timestamp;
  resolver.updatedBlock = event.block.number;
  resolver.save();

  const history = new StakedWithdrawnEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
  history.resolver = event.params.resolver;
  history.to = event.params.to;
  history.amount = event.params.amount;
  history.timestamp = event.block.timestamp;
  history.blockNumber = event.block.number;
  history.transactionHash = event.transaction.hash;
  history.logIndex = event.logIndex;
  history.save();
}

export function handleSetOperator(event: SetOperatorContractEvent): void {
  const resolver = getOrCreateResolver(event.params.resolver.toHexString());
  const operatorId = event.params.operator.toHexString();
  const authorizationId = resolver.id + "-" + operatorId;
  let authorization = OperatorAuthorization.load(authorizationId);
  if (authorization == null) {
    authorization = new OperatorAuthorization(authorizationId);
    authorization.resolver = resolver.id;
    authorization.operator = event.params.operator;
  }
  authorization.allowed = event.params.allowed;
  authorization.updatedAt = event.block.timestamp;
  authorization.updatedBlock = event.block.number;
  authorization.save();

  resolver.updatedAt = event.block.timestamp;
  resolver.updatedBlock = event.block.number;
  resolver.save();

  const history = new OperatorUpdatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
  history.resolver = event.params.resolver;
  history.operator = event.params.operator;
  history.allowed = event.params.allowed;
  history.timestamp = event.block.timestamp;
  history.blockNumber = event.block.number;
  history.transactionHash = event.transaction.hash;
  history.logIndex = event.logIndex;
  history.save();
}

export function handleMinSelfStakeUpdated(event: MinSelfStakeUpdatedContractEvent): void {
  const protocol = getOrCreateProtocol();
  protocol.minSelfStake = event.params.minSelfStake;
  protocol.updatedAt = event.block.timestamp;
  protocol.updatedBlock = event.block.number;
  protocol.save();

  const history = new MinSelfStakeUpdatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
  history.minSelfStake = event.params.minSelfStake;
  history.timestamp = event.block.timestamp;
  history.blockNumber = event.block.number;
  history.transactionHash = event.transaction.hash;
  history.logIndex = event.logIndex;
  history.save();
}

export function handleThawingPeriodUpdated(event: ThawingPeriodUpdatedContractEvent): void {
  const protocol = getOrCreateProtocol();
  protocol.thawingPeriod = event.params.thawingPeriod;
  protocol.updatedAt = event.block.timestamp;
  protocol.updatedBlock = event.block.number;
  protocol.save();

  const history = new ThawingPeriodUpdatedEvent(eventId(event.transaction.hash.toHexString(), event.logIndex));
  history.thawingPeriod = event.params.thawingPeriod;
  history.timestamp = event.block.timestamp;
  history.blockNumber = event.block.number;
  history.transactionHash = event.transaction.hash;
  history.logIndex = event.logIndex;
  history.save();
}
