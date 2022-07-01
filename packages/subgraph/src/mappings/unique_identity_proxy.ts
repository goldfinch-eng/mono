import {ProxyImplementationUpdated} from "../../generated/UniqueIdentityProxy/UniqueIdentity_Proxy"
import {UniqueIdentity as UniqueIdentityTemplate} from "../../generated/templates"

export function handleProxyImplementationUpdated(event: ProxyImplementationUpdated): void {
  UniqueIdentityTemplate.create(event.address)
}
