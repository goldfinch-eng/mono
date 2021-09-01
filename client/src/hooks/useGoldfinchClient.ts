import {SessionData} from "../types/session"
import {AuthenticatedSession} from "./useSignIn"

const API_URLS = {
  mainnet: "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net",
  localhost: "https://us-central1-goldfinch-frontends-dev.cloudfunctions.net",
}

type OkResponse = {
  ok: true
  response: Response
  json: any
}
type NotOkResponse = {
  ok: false
  response: Response
  json: any
}
type HandledResponse = OkResponse | NotOkResponse

interface GoldfinchClient {
  fetchKYCStatus(address: string): Promise<any>
  signAgreement(address: string, fullName: string, pool: string): Promise<any>
}

export class GoldfinchClientError extends Error {
  response: NotOkResponse

  constructor(response: NotOkResponse) {
    const message = `Request failed: ${response.response.status} ${response.json}`
    super(message)

    this.response = response
  }
}

class DefaultGoldfinchClient implements GoldfinchClient {
  private readonly baseURL: string
  private readonly session: AuthenticatedSession
  private readonly setSessionData: (data: SessionData | undefined) => void

  constructor(
    networkName: string,
    session: AuthenticatedSession,
    setSessionData: (data: SessionData | undefined) => void,
  ) {
    this.baseURL = process.env.REACT_APP_GCLOUD_FUNCTIONS_URL || API_URLS[networkName]
    this.session = session
    this.setSessionData = setSessionData
  }

  async _handleResponse(fetched: Promise<Response>): Promise<HandledResponse> {
    const response = await fetched
    const json = await response.json()
    if (response.ok) {
      return {
        ok: response.ok,
        response,
        json,
      }
    } else {
      if (response.status === 401) {
        this.setSessionData(undefined)
      }

      throw new GoldfinchClientError({
        ok: response.ok,
        response,
        json,
      })
    }
  }

  _getAuthHeaders(address: string) {
    const signature = this.session.signature === "pending" ? "" : this.session.signature
    return {
      "x-goldfinch-address": address,
      "x-goldfinch-signature": signature,
      "x-goldfinch-signature-block-num": this.session.signatureBlockNum.toString(),
    }
  }

  _getKYCStatusRequestInit(address: string): RequestInit {
    return {
      headers: this._getAuthHeaders(address),
    }
  }

  _getKYCStatusURL(): string {
    return `${this.baseURL}/kycStatus`
  }

  async fetchKYCStatus(address: string): Promise<HandledResponse> {
    return this._handleResponse(fetch(this._getKYCStatusURL(), this._getKYCStatusRequestInit(address)))
  }

  _getSignAgreementRequestInit(address: string, body: {fullName: string; pool: string}): RequestInit {
    return {
      method: "POST",
      headers: {
        ...this._getAuthHeaders(address),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  }

  _getSignAgreementURL(): string {
    return `${this.baseURL}/signAgreement`
  }

  async signAgreement(address: string, fullName: string, pool: string): Promise<HandledResponse> {
    return this._handleResponse(
      fetch(this._getSignAgreementURL(), this._getSignAgreementRequestInit(address, {fullName, pool})),
    )
  }
}

export default DefaultGoldfinchClient
