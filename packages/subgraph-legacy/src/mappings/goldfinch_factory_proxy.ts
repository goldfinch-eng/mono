import {
  ProxyImplementationUpdated,
} from "../../generated/GoldfinchFactoryProxy/GoldfinchFactory"
import { GoldfinchFactory as GoldfinchFactoryTemplate } from '../../generated/templates';

export function handleProxyImplementationUpdated(
  event: ProxyImplementationUpdated
): void {
  GoldfinchFactoryTemplate.create(event.address);
}
