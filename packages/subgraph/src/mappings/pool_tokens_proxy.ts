import {
  OwnershipTransferred,
  ProxyImplementationUpdated
} from "../../generated/PoolTokensProxy/PoolTokens_Proxy"
import { PoolTokens as PoolTokensTemplate } from '../../generated/templates';

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handleProxyImplementationUpdated(
  event: ProxyImplementationUpdated
): void {
  PoolTokensTemplate.create(event.address);
}
