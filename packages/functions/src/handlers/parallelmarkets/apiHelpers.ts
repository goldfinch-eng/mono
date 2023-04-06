import fetch from "node-fetch"
import {PmIdentity} from "./types"

const PROFILE_API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.parallelmarkets.com/v1/identity"
    : "https://demo-api.parallelmarkets.com/v1/identity"

const PM_API_KEY = process.env.NODE_ENV === "production" ? process.env.PM_PROD_API_KEY : process.env.PM_DEMO_API_KEY

const REQUEST_OPTIONS = {
  method: "GET",
  headers: {
    Authorization: `Bearer ${PM_API_KEY}`,
  },
}

export const fetchIdentity = async (id: string): Promise<PmIdentity> => {
  const url = `${PROFILE_API_BASE_URL}/${id}`
  // TODO - propagate the error
  const res = await fetch(url, REQUEST_OPTIONS)
    .then((res) => res.json())
    .catch((err) => console.error(`error: ${err}`))
  return res as PmIdentity
}
