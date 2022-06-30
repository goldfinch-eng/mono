import {
  ProxyImplementationUpdated
} from "../../generated/PoolProxy/Pool_Proxy"
import { Pool as PoolTemplate } from '../../generated/templates';

export function handleProxyImplementationUpdated(
  event: ProxyImplementationUpdated
): void {
  PoolTemplate.create(event.address);
}
