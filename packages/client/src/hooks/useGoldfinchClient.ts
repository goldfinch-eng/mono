import {SessionData} from "../types/session"
import {AuthenticatedSession} from "./useSignIn"

const API_URLS = {
  mainnet: "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net",
  localhost: "https://us-central1-goldfinch-frontends-dev.cloudfunctions.net",
}

type OkResponse<T = any> = {
  ok: true
  response: Response
  json: T
}
type NotOkResponse<T = any> = {
  ok: false
  response: Response
  json: T
}
type HandledResponse<T = any> = OkResponse<T> | NotOkResponse<T>

export interface KYC {
  status: "unknown" | "approved" | "failed"
  countryCode: string
}

interface GoldfinchAuthenticatedClient {
  fetchKYCStatus(address: string): Promise<any>
  signAgreement(address: string, fullName: string, pool: string): Promise<any>
  signNDA(address: string, fullName: string, pool: string): Promise<any>
}

interface GoldfinchUnauthenticatedClient {
  fetchNDA(address: string, fullName: string, pool: string): Promise<any>
}

export class GoldfinchClientError extends Error {
  response: NotOkResponse

  constructor(response: NotOkResponse) {
    const message = `Request failed: ${response.response.status} ${response.json}`
    super(message)

    this.response = response
  }
}

class DefaultGoldfinchClient implements GoldfinchAuthenticatedClient {
  private readonly baseURL: string
  private readonly session: AuthenticatedSession
  private readonly setSessionData: (data: SessionData | undefined) => void

  constructor(
    networkName: string,
    session: AuthenticatedSession,
    setSessionData: (data: SessionData | undefined) => void
  ) {
    this.baseURL = process.env.REACT_APP_GCLOUD_FUNCTIONS_URL || API_URLS[networkName]
    this.session = session
    this.setSessionData = setSessionData
  }

  async _handleResponse<T = any>(fetched: Promise<Response>): Promise<HandledResponse<T>> {
    const response = await fetched
    const json = (await response.json()) as T
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

  async fetchKYCStatus(address: string): Promise<HandledResponse<KYC>> {
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
      fetch(this._getSignAgreementURL(), this._getSignAgreementRequestInit(address, {fullName, pool}))
    )
  }

  _getSignNDARequestInit(address: string, body: {pool: string}): RequestInit {
    return {
      method: "POST",
      headers: {
        ...this._getAuthHeaders(address),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  }

  _getSignNDAURL(): string {
    return `${this.baseURL}/signNDA`
  }

  async signNDA(address: string, pool: string): Promise<HandledResponse> {
    return this._handleResponse(fetch(this._getSignNDAURL(), this._getSignNDARequestInit(address, {pool})))
  }
}

export class SimpleGoldfinchClient implements GoldfinchUnauthenticatedClient {
  private readonly baseURL: string

  constructor(networkName: string) {
    this.baseURL = process.env.REACT_APP_GCLOUD_FUNCTIONS_URL || API_URLS[networkName]
  }

  async _handleResponse<T = any>(fetched: Promise<Response>): Promise<HandledResponse<T>> {
    const response = await fetched
    const json = (await response.json()) as T
    if (response.ok) {
      return {
        ok: response.ok,
        response,
        json,
      }
    } else {
      throw new GoldfinchClientError({
        ok: response.ok,
        response,
        json,
      })
    }
  }

  _getFetchNDARequestInit(address: string): RequestInit {
    return {
      headers: {
        "x-goldfinch-address": address,
      },
    }
  }

  _getFetchNDAURL(pool: string): string {
    return `${this.baseURL}/fetchNDA/?pool=${pool}`
  }

  async fetchNDA(address: string, pool: string): Promise<HandledResponse> {
    return this._handleResponse(fetch(this._getFetchNDAURL(pool), this._getFetchNDARequestInit(address)))
  }
}

export default DefaultGoldfinchClient
