import {
  ProxyImplementationUpdated
} from "../../generated/PoolTokensProxy/PoolTokens_Proxy"
import { PoolTokens as PoolTokensTemplate } from '../../generated/templates';

export function handleProxyImplementationUpdated(
  event: ProxyImplementationUpdated
): void {
  PoolTokensTemplate.create(event.address);
}
