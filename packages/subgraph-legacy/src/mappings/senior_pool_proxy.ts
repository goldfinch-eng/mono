import {
  ProxyImplementationUpdated
} from "../../generated/SeniorPoolProxy/SeniorPool_Proxy"
import { SeniorPool as SeniorPoolTemplate } from '../../generated/templates';
import { getOrInitSeniorPool } from "../entities/senior_pool";

export function handleProxyImplementationUpdated(
  event: ProxyImplementationUpdated
): void {
  SeniorPoolTemplate.create(event.address);
  getOrInitSeniorPool(event.address)
}


