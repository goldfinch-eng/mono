import fetch from "node-fetch"
import {camelize} from "@goldfinch-eng/utils"
import {PmAccreditationResponse, PmIdentity, PmOauthResponse, PmProfileResponse} from "./PmApiTypes"
import * as functions from "firebase-functions"
import {getConfig} from "../../config"

const {
  api_key: apiKey,
  base_url: baseUrl,
  client_id: clientId,
  client_secret: clientSecret,
  redirect_uri: redirectUri,
} = getConfig(functions).parallelmarkets

export const ParallelMarkets = {
  getIdentity: async (id: string): Promise<PmIdentity> => {
    return query(`/identity/${id}`)
  },

  getIdentityForAccessToken: async (accessToken: string): Promise<PmIdentity> => {
    return query("/identity", {overrideToken: accessToken})
  },

  tradeCodeForToken: async (authCode: string): Promise<PmOauthResponse> => {
    return query("/oauth/token", {
      method: "POST",
      queryParams: {
        code: authCode,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      },
      useAuth: false,
    })
  },

  getProfile: async (id: string): Promise<PmProfileResponse> => {
    return query(`/profile/${id}`)
  },

  getProfileForAccessToken: async (accessToken: string): Promise<PmProfileResponse> => {
    return query("/me", {overrideToken: accessToken})
  },

  getAccreditations: async (id: string): Promise<PmAccreditationResponse> => {
    return query(`/accreditations/${id}`)
  },

  getAccreditationsForAccessToken: async (accessToken: string): Promise<PmAccreditationResponse> => {
    return query("/accreditations", {overrideToken: accessToken})
  },
}

type QueryOptions = Partial<{
  method: "GET" | "POST"
  body: any
  queryParams: Record<string, string>
  useAuth: boolean
  overrideToken: string
}>

const DEFAULT_OPTIONS: QueryOptions = {
  method: "GET",
  queryParams: {},
  useAuth: true,
}

const query = async <T>(path: string, options: QueryOptions = {}): Promise<T> => {
  const {method, body, queryParams, useAuth, overrideToken} = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  const url = new URL(`${baseUrl}${path}`)

  
  Object.entries(queryParams || {}).forEach(([key, value]) => url.searchParams.append(key, value as string))
  
  return fetch(url.toString(), {
    method: method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
      ...(useAuth ? {Authorization: `Bearer ${overrideToken || apiKey}`} : {}),
    },
    console.log({url, queryParams, body, authorization: `Bearer ${overrideToken || apiKey}`})
  })
    .then((res) => {
      if (res.status !== 200) {
        console.error(`ParalllelMarkets error (${res.status}): ${res.statusText}`)
        throw new Error(`ParallelMarkets api error (${res.status}): ${res.statusText}`)
      }

      return res.json()
    })
    .then(camelize) as T
}
