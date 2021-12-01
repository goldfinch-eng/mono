import {
  ProxyImplementationUpdated
} from "../../generated/GoldfinchFactoryProxy/GoldfinchFactory_Proxy"
import { GoldfinchFactory as GoldfinchFactoryTemplate } from '../../generated/templates';


export function handleProxyImplementationUpdated(
  event: ProxyImplementationUpdated
): void {
  GoldfinchFactoryTemplate.create(event.address);
}
