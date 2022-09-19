# Overview

If you want to use the command-line examples in this guide, install the `gcloud` command-line tool. https://cloud.google.com/sdk/docs/install or use homebrew `brew install --cask google-cloud-sdk`.

## Updating config settings
For a given cloud function, one way to see what is the config setting’s value is to go to the [cloud console]("https://console.cloud.google.com/functions/details/us-central1/kycStatus?env=gen1&project=goldfinch-frontends-prod&tab=source"), view/download the source code of the cloud function, and then view the .runtimeconfig.json file in that bundle.

## gcloud commands

For <projects> use `goldfinch-frontends-prod` or `goldfinch-frontends-dev`

Docs: https://cloud.google.com/deployment-manager/runtime-configurator
SDK Docs: https://cloud.google.com/sdk/gcloud/reference/beta/runtime-config/configs

`gcloud help`

`gcloud auth login`

`gcloud beta runtime-config configs list --project <projects>`

`gcloud beta runtime-config configs variables list --config-name kyc --values --project <projects>`

Example get variables
`gcloud beta runtime-config configs variables get-value allowed_origins --config-name kyc --project <projects>`

Example set variable `--is-text` is a needed param
`gcloud beta runtime-config configs variables set allowed_origins "https://app.goldfinch.finance,https://deploy-preview-*--goldfinchfi.netlify.app" --config-name kyc --project <projects> --is-text`

NOTE: If you want to be able to use the remote cloud functions when running locally, then `http://localhost:3000` should be included as one of those allowed origins ^^^.
