import {useContext, useEffect} from "react"
import {AppContext, GeolocationData} from "../App"

interface GeolocationClient {
  fetch(): Promise<GeolocationData>
}

class IpInfoClient implements GeolocationClient {
  async fetch(): Promise<GeolocationData> {
    let response = await fetch("https://ipinfo.io?token=878b795cd15418", {
      method: "GET",
      headers: {"Content-Type": "application/json"},
    })
    if (response.ok) {
      return (await response.json()) as GeolocationData
    } else {
      return Promise.reject(response)
    }
  }
}

class FakeClient implements GeolocationClient {
  country: string

  constructor(country: string = "US") {
    this.country = country
  }

  async fetch(): Promise<GeolocationData> {
    let geolocationData = {
      ip: "123.456.789.0",
      city: "Oakland",
      region: "California",
      country: this.country,
      loc: "37.8044,-122.2708",
      org: "AS701 MCI Communications Services, Inc. d/b/a Verizon Business",
      postal: "94604",
      timezone: "America/Los_Angeles",
    }
    return Promise.resolve(geolocationData)
  }
}

const defaultClient = process.env.NODE_ENV !== "production" ? new FakeClient() : new IpInfoClient()

function useGeolocation(client: GeolocationClient = defaultClient): GeolocationData | undefined {
  let {geolocationData, setGeolocationData} = useContext(AppContext)

  useEffect(() => {
    async function fetchGeolocationData() {
      let data = await client.fetch()
      setGeolocationData?.(data)
    }

    if (!geolocationData) {
      fetchGeolocationData()
    }
  }, [client, geolocationData, setGeolocationData])

  return geolocationData
}

export default useGeolocation
