const fetch = require("node-fetch")
const goList = require("../client/src/goList.json")
const fs = require("fs")

const personaAPIKey = process.env.PERSONA_API_KEY

let requests = 0

async function fetchEntities(entity, paginationToken, filter) {
  let url = `https://withpersona.com/api/v1/${entity}?${filter}`
  if (paginationToken) {
    url = `${url}&page[after]=${paginationToken}`
  }

  const options = {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Persona-Version": "2020-01-13",
      Authorization: `Bearer ${personaAPIKey}`,
    },
  }

  requests = requests + 1

  if (requests % 250 === 0) {
    console.log("Sleeping for rate limit")
    await new Promise((resolve) => setTimeout(resolve, 60000))
  }

  return fetch(url, options)
    .then((res) => res.json())
    .catch((err) => console.error("error:" + err))
}

async function fetchAllAccounts() {
  let paginationToken = null
  let allAccounts = {}
  let response
  do {
    response = await fetchEntities("events", paginationToken, "filter[name]=inquiry.approved")
    for (let event of response.data) {
      const payload = event.attributes.payload
      const account = payload.included.find((i) => i.type === "account")
      const referenceId = account.attributes.referenceId
      if (referenceId && payload.data.attributes.status === "approved") {
        const verification = payload.included.find((included) => included.type === "verification/government-id")
        const customFields = payload.data.attributes.fields
        if (allAccounts[referenceId]) {
          console.log(
            `${referenceId} already has an approved inquiry ${allAccounts[referenceId].inquiryId}, skipping ${payload.data.id}`
          )
          continue
        }
        allAccounts[referenceId] = {
          id: referenceId,
          inquiryId: payload.data.id,
          status: account.attributes.tags,
          countryCode: account.attributes.countryCode,
          email: account.attributes.emailAddress || null,
          verificationCountryCode: verification.attributes.countryCode || null,
          discord: (customFields.discordName && customFields.discordName.value) || null,
        }
      }
      paginationToken = event.id
    }
  } while (response.data.length > 0)
  return allAccounts
}

async function main() {
  if (!personaAPIKey) {
    console.log("Persona API key is missing. Please prepend the command with PERSONA_API_KEY=#KEY#")
    return
  }
  console.log("Fetching accounts")
  const approvedAccounts = Object.values(await fetchAllAccounts())
  for (let account of approvedAccounts) {
    account.countryCode = account.countryCode || account.verificationCountryCode
    account.golisted = goList.includes(account.id) || goList.includes(account.id.toLowerCase())
  }

  const accountsToAdd = []
  for (let account of approvedAccounts) {
    // If the account is US based or if we don't know the country code for sure, skip
    if (!account.countryCode || account.countryCode === "" || account.countryCode === "US") {
      continue
    }

    // If already golisted, ignore
    if (account.golisted) {
      continue
    }
    accountsToAdd.push(account.id)
  }

  console.log("Paste the following into the golist:\n")
  for (let i = 0; i < accountsToAdd.length; i++) {
    if (i === accountsToAdd.length - 1) {
      console.log(`"${accountsToAdd[i]}"`)
    } else {
      console.log(`"${accountsToAdd[i]}",`)
    }
  }

  let writeStream = fs.createWriteStream("accounts.csv")
  writeStream.write("address, country_code, golisted, email, discord\n")
  for (let account of approvedAccounts) {
    writeStream.write(
      `"${account.id}", ${account.countryCode}, ${account.golisted}, ${account.email}, ${account.discord}\n`
    )
  }
  writeStream.end()
  await new Promise((resolve) => {
    writeStream.on("finish", () => {
      console.log("\nAll accounts exported to accounts.csv")
      resolve()
    })
  })
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = main
