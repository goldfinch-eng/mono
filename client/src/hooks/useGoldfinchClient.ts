// TODO: Actually make this a hook that invalidates the session on a 401

const API_URLS = {
  mainnet: "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net",
  localhost: "https://us-central1-goldfinch-frontends-dev.cloudfunctions.net",
}

interface GoldfinchClient {
  fetchKYCStatus(address: string): Promise<any>
  signAgreement(address: string, fullName: string, pool: string): Promise<any>
}

class DefaultGoldfinchClient implements GoldfinchClient {
  private readonly baseURL: string
  private readonly signature: string

  constructor(networkName: string, signature: string) {
    this.baseURL = process.env.REACT_APP_GCLOUD_FUNCTIONS_URL || API_URLS[networkName]
    this.signature = signature
  }

  async fetchKYCStatus(address: string): Promise<any> {
    const kycStatusURL = this.baseURL + "/kycStatus?" + new URLSearchParams({address})
    const response = await fetch(kycStatusURL, {
      headers: {"x-goldfinch-signature": this.signature},
    })
    return await response.json()
  }

  async signAgreement(address: string, fullName: string, pool: string): Promise<any> {
    const agreementURL = this.baseURL + "/signAgreement"
    const response = await fetch(agreementURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goldfinch-signature": this.signature,
      },
      body: JSON.stringify({fullName, pool, address}),
    })
    if (response.status >= 500) {
      throw new Error("Internal error signing agreement")
    }
    return await response.json()
  }
}

export default DefaultGoldfinchClient
