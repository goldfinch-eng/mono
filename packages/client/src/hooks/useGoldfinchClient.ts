import {SessionData} from "../types/session"
import {AuthenticatedSession, KnownSession} from "./useSignIn"

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
}

interface GoldfinchKnownClient {
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

class BaseGoldfinchClient {
  readonly baseURL: string
  readonly session: AuthenticatedSession | KnownSession
  readonly setSessionData: (data: SessionData | undefined) => void

  constructor(
    networkName: string,
    session: AuthenticatedSession | KnownSession,
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
}

// Requires a signature and signature block number
class AuthenticatedGoldfinchClient extends BaseGoldfinchClient implements GoldfinchAuthenticatedClient {
  _getAuthHeaders(address: string) {
    if (this.session.status !== "authenticated") {
      throw new Error("Not signed in. Please refresh the page and try again")
    }

    const signature = this.session.signature === "pending" ? "" : this.session.signature
    return {
      "x-goldfinch-address": address,
      "x-goldfinch-signature": signature,
      "x-goldfinch-signature-block-num": this.session.signatureBlockNum.toString(),
    }
  }

  async fetchKYCStatus(address: string): Promise<HandledResponse<KYC>> {
    return this._handleResponse(
      fetch(`${this.baseURL}/kycStatus`, {
        headers: this._getAuthHeaders(address),
      })
    )
  }
}

// Does not require a signature
export class KnownGoldfinchClient extends BaseGoldfinchClient implements GoldfinchKnownClient {
  _getAuthHeaders(address: string) {
    return {
      "x-goldfinch-address": address,
    }
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

  async signAgreement(address: string, fullName: string, pool: string): Promise<HandledResponse> {
    return this._handleResponse(
      fetch(`${this.baseURL}/signAgreement`, this._getSignAgreementRequestInit(address, {fullName, pool}))
    )
  }
}

export default AuthenticatedGoldfinchClient
