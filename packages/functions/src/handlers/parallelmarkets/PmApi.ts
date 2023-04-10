import fetch from "node-fetch"
import {camelize} from "@goldfinch-eng/utils"
import {PmAccreditationResponse, PmIdentity, PmOauthResponse, PmProfileResponse} from "./PmApiTypes"

const PROFILE_API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.parallelmarkets.com/v1/identity"
    : "https://demo-api.parallelmarkets.com/v1/identity"

const PM_API_KEY = process.env.NODE_ENV === "production" ? process.env.PM_PROD_API_KEY : process.env.PM_DEMO_API_KEY
const PM_CLIENT_ID = ""
const PM_CLIENT_SECRET = ""
const PM_REDIRECT_URI = ""

export const ParallelMarkets = {
  getIdentity: async (id: string): Promise<PmIdentity> => {
    return query(`/identity/${id}`)
  },

  getIdentityForAccessToken: async (accessToken: string): Promise<PmIdentity> => {
    return query("/identity", {overrideToken: accessToken, useAuth: false})
  },

  tradeCodeForToken: async (authCode: string): Promise<PmOauthResponse> => {
    return query("/oauth/token", {
      method: "POST",
      body: {
        code: authCode,
        client_id: PM_CLIENT_ID,
        client_secret: PM_CLIENT_SECRET,
        redirect_uri: PM_REDIRECT_URI,
        grant_type: "authorization_code",
      },
      useAuth: false,
    })
  },

  getProfile: async (id: string): Promise<PmProfileResponse> => {
    return query(`/profile/${id}`)
  },

  getProfileForAccessToken: async (accessToken: string): Promise<PmProfileResponse> => {
    return query("/me", {overrideToken: accessToken, useAuth: false})
  },

  getAccreditations: async (id: string): Promise<PmAccreditationResponse> => {
    return query(`/accreditations/${id}`)
  },

  getAccreditationsForAccessToken: async (accessToken: string): Promise<PmAccreditationResponse> => {
    return query("/accreditations", {overrideToken: accessToken, useAuth: false})
  },
}

const query = async <T>(
  path: string,
  options?: {method?: "GET" | "POST"; body?: unknown; useAuth?: boolean; overrideToken?: string},
): Promise<T> => {
  const useAuth = options?.useAuth == undefined ? true : false // default to true

  return fetch(`${PROFILE_API_BASE_URL}${path}`, {
    method: options?.method || "GET",
    body: options?.body ? JSON.stringify(options.body) : undefined,
    headers: {
      ...(useAuth ? {Authorization: `Bearer ${options?.overrideToken || PM_API_KEY}`} : {}),
    },
  })
    .then((res) => res.json())
    .then(camelize) as T
}
