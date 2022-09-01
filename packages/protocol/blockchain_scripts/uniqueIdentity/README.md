# Burn UID Script

We use this script to burn a user's UID so they remint with the same EOA or a different one.
State on Persona is managed so they can redo the embedded KYC flow with the same documents
and pass all verification checks. We achieve this by updating their Persona account's reference
id to be the EOA they wish to remint at.

The row for the user is deleted from the `users` firebase store, but this is a soft delete. Their
information (UID type burned, country code, and inquiry id) is recorded in the `destroyedUsers`
firebase store for recordkeeping purposes. If this is their first burn with that EOA then a record
is created in the `destroyedUsers` store. On subsequent burns information is appended to the existing
record.

## Running in production

The script relies on these environment variables

- `NETWORK` is network name to execute the burn on. Use "mainnet" for production and "localhost" for testing.
- `BURN_ACCOUNT` is the wallet address whose UID we want to burn
- `BURN_UID_TYPE` is type of the UID being burned
- `UNIQUE_IDENTITY_SIGNER_API_KEY` is the api key of the Unique Identity Signer relayer which can be found at https://defender.openzeppelin.com/#/relay.
- `UNIQUE_IDENTITY_SIGNER_API_SECRET` is the api secret of the Unique Identity Signer relayer
- `PERSONA_API_KEY` is the Persona API key, which can be found at https://app.withpersona.com/dashboard/api-configuration. Mainnet burns should use the production api key.
- `PREPARE_REMINT_ACCOUNT` is an optional new address for the user to remint at. If this variable is blank then the user will be able to remint using the same wallet address (`BURN_ACCOUNT`)
- `BURNER_PRIVATE_KEY` private key of a wallet funded with ETH that will be used to execute the burn

If you are running the script locally then set them in your .env.local file. If you are running the script in a codespace
then set them as encrypted environment variables. More info on that [here](https://docs.github.com/en/codespaces/managing-your-codespaces/managing-encrypted-secrets-for-your-codespaces#using-secrets).

```
npx hardhat run --network mainnet burnUID.ts | tee burn-UID-output.txt
```

This will write all script output to file `burn-UID-output.txt`

### Setting up Codespace secrets
This [GitHub page](https://docs.github.com/en/codespaces/managing-your-codespaces/managing-encrypted-secrets-for-your-codespaces#using-secrets) is a step-by-step guide for how to
configure the secrets for the script.

Make sure you give the `warbler-labs/mono` repo access to each secret ([screenshot](https://drive.google.com/file/d/1h9-I7_JlOPwuypvNwONVvYTORLXX3VGI/view?usp=sharing))

Your secrets page should look like [this](https://drive.google.com/file/d/1z-nNOM8gyMv9uVvOGavUGHgAiopUbQY4/view?usp=sharing) after configuring the secrets

## Additional Documentation

https://www.notion.so/goldfinchfinance/Burning-a-UID-ed3113fb6d8b4687b300a3a4b337f8b3

## Future Improvements

A list of potential improvements to the script

### Avoid forcing the user to re-kyc

Users who request to burn their existing UID and remint have already gone through the kyc flow and it might seem annoying and unnecessary
to have to do it again. Can the script be modified so they don't have to re-kyc?

### Add an option such that future UID mints are disallowed

After running the script, the user whose UID was burned will (after they've gone through the KYC flow again) be able to re-mint a UID for `BURN_ACCOUNT` (or `PREPARE_REMINT_ACCOUNT` if that option was used). Re-minting is possible in both cases, but we might want to disable remint in certain cases, e.g. for sanctioned individuals.

#### Potential Solution

If we set the user's Persona account's reference id to `null`, then the next time they start the embedded kyc flow a NEW Persona account will be created.
When they submit documents for the NEW Persona account, duplicate id verification checks will fail because they already used these documents on their OLD
Persona (which we haven't deleted).
