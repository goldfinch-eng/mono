import {RelayerParams} from "defender-relay-client"

export interface Request {
  body: {[key: string]: any}
  headers: {[header: string]: any}
  queryParameters: {[key: string]: any}
}
export type HandlerParams = {request?: Request} & RelayerParams
