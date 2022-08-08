import {RelayerParams} from "defender-relay-client"

export interface Request {
  body: {[key: string]: any}
  headers: {[header: string]: any}
  queryParameters: {[key: string]: any}
}

export interface Env {
  // https://docs.openzeppelin.com/defender/autotasks#secrets
  secrets: {[key: string]: any}
}

export type HandlerParams = {request?: Request} & RelayerParams & Env
