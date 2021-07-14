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
    response = await fetchEntities("accounts", paginationToken)
    for (let account of response.data) {
      if (account.attributes.referenceId && account.attributes.tags.includes("APPROVED")) {
        allAccounts[account.attributes.referenceId] = {
          id: account.attributes.referenceId,
          status: account.attributes.tags,
          countryCode: account.attributes.countryCode,
          email: account.attributes.emailAddress,
        }
      }
      paginationToken = account.id
    }
  } while (response.data.length > 0)
  return allAccounts
}

async function fetchInquiry(referenceId) {
  let inquiries = await fetchEntities("inquiries", null, `filter[reference-id]=${referenceId}`)
  const approvedInquiry = inquiries.data.find((i) => i.attributes.status === "approved")
  if (!approvedInquiry) {
    return null
  }
  let event = await fetchEntities(
    "events",
    null,
    `filter[name]=inquiry.approved&filter[object-id]=${approvedInquiry.id}`
  )
  approvedInquiry.included = event.data[0].attributes.payload.included
  return approvedInquiry
}

async function main() {
  if (!personaAPIKey) {
    console.log("Persona API key is missing. Please prepend the command with PERSONA_API_KEY=#KEY#")
    return
  }
  console.log("Fetching accounts")
  const approvedAccounts = Object.values(await fetchAllAccounts())
  let accountCount = 0
  for (let account of approvedAccounts) {
    const inquiry = await fetchInquiry(account.id)
    accountCount += 1
    if (accountCount % 10 === 0) {
      console.log(`Fetched ${accountCount} of ${approvedAccounts.length}`)
    }
    if (inquiry) {
      const verification = inquiry.included.find((included) => included.type === "verification/government-id")
      account.countryCode = verification.attributes.countryCode
      account.discord = inquiry.attributes.fields.discordName.value
    }
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