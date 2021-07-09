const fetch = require("node-fetch")
const goList = require("../client/src/goList.json")

const personaAPIKey = process.env.PERSONA_API_KEY

async function fetchEntities(entity, paginationToken) {
  let url = `https://withpersona.com/api/v1/${entity}?`
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

async function main() {
  if (!personaAPIKey) {
    console.log("Persona API key is missing. Please prepend the command with PERSONA_API_KEY=#KEY#")
    return
  }
  const approvedAccounts = await fetchAllAccounts()
  const accountsToAdd = []
  for (let account of Object.values(approvedAccounts)) {
    // Ignore US for now
    if (!account.countryCode || account.countryCode === "US") {
      continue
    }
    // If already golisted, ignore
    if (goList.includes(account.id) || goList.includes(account.id.toLowerCase())) {
      continue
    }
    accountsToAdd.push(account)
  }

  console.log("Paste the following into the golist:\n")
  for (let account of accountsToAdd) {
    console.log(`"${account.id}",`)
  }

  console.log("\n\nEmail the following addresses:\n")
  for (let account of accountsToAdd) {
    console.log(`"${account.email}",`)
  }

  console.log("\n\nCSV export")
  for (let account of accountsToAdd) {
    console.log(`"${account.id}", ${account.email}`)
  }
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
