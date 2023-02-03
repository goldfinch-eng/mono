# Goldfinch Finance CMS

## Technology

### Payload CMS

Payload CMS is a code first headless CMS built on MongoDB, Express and Node. Payload was developed with developers in mind for the best API experience.

### Google Cloud Storage

Google Cloud Storage is an object storage web service that is used to store all media uploaded to the CMS. The storage bucket is used as the CDN for the uploads.

## Local Development

The local development environment will initalize a local instance of MongoDB and a mock Google Cloud Storage service using Docker to simulate the production environment.

**IMPORTANT**: You must run the local subgraph before starting the CMS locally. This is because the startup scripts for the CMS will read the subgraph to find tranched pools to import.

### Prerequsities

- Docker

### Steps

1. Make sure you have Docker running on your machine
2. Create your local environment file `.env` file (see `.env.example`)
3. Start your local environment:

```
yarn start:dev
```

4. Open [http://localhost:3010](http://localhost:3010) to see the CMS in action

## Production

### Technology

The production stack of the CMS has 3 different components:

1. Payload: Webserver on Compute Engine running a Dockerized Payload CMS server
2. MongoDB: Webserver on Compute Engine running MongoDB
3. Cloud Storage: Used to store images and media from the CMS

### Prerequsities

- Docker
- `gcloud` cli tool

### Deployment

The deployment of Payload is handled entirely with pushing up newly built docker images. The docker image is pushed to the Artifact Registry inside the Google project, which is then used to deploy a Google Compute instance using the image.

You can find the existing images in the Artifact Registry
The current production deployment should use the image `cms` tagged with `stable`
(Eg. `cms:stable`)

Deployment to Payload updates is done through the `gcloud` CLI tool and docker itself:

1. Authenticate `gcloud` and login with your account

```
gcloud auth login
```

2. Run the following command to authenticate your docker with the Google account

```
gcloud auth configure-docker us-central1-docker.pkg.dev
```

3. Once authenticated, build the image and tag it:

```
#  "--platform x86-64" is an optional parameter if you are using a x64 machine - only required for arm64 machines due to npm module "sharp" failing to install. See https://github.com/lovell/sharp/issues/2482

docker build . --tag us-central1-docker.pkg.dev/goldfinch-frontends-prod/goldfinch-docker-images/cms:<TAG> --platform x86-64
```

4. Deploy the tagged image to the Artifact Registry

```
docker push us-central1-docker.pkg.dev/goldfinch-frontends-prod/goldfinch-docker-images/cms:<TAG>
```

5. Once the image is sent to the registry, you can use the image to launch or re-launch the Payload CMS server. If a Payload server is already running, you will have to **Restart** the machine for the new image to be loaded

#### Target deployment by tagging image builds

The default production server deploys from the `cms` image tagged with `stable` in the Artifact Registry. Pushing an image as `cms:stable` will automatically be used on production after the next restart.

Tagging allows us to easily deploy images and target different environments.
For example, a staging or testing server can be set to use `cms:latest` image, where a different build can be used.

An image can also have multiple tags

```
docker build . \
--tag us-central1-docker.pkg.dev/goldfinch-frontends-prod/goldfinch-docker-images/cms:stable \
--tag us-central1-docker.pkg.dev/goldfinch-frontends-prod/goldfinch-docker-images/cms:latest
```

Tags can also be added to existing images

```
docker tag \
  us-central1-docker.pkg.dev/goldfinch-frontends-prod/goldfinch-docker-images/cms:latest \
  us-central1-docker.pkg.dev/goldfinch-frontends-prod/goldfinch-docker-images/cms:latest
```

### Scripts

Payload also contains a Local API which allows us to run scripts against our Payload instance. This can be useful for operations such as seeding new data.

The optional `local` parameter disables the UI and only allows the use of the Local API.

```
// Initialize Payload
payload.init({
  secret: process.env.PAYLOAD_SECRET,
  mongoURL: process.env.MONGODB_URI,
  mongoOptions: {
    dbName: "payload",
  },
  local: true,
});
```

#### Running a script

Scripts are stored inside of the `src/scripts` directory. Since the location of the Payload configuration file (`payload.config.ts`) is already pre-determined, any scripts that initialize Payload must be executed from the src folder of the repository. This also ensures that your `.env` file is imported accordingly if you are running the script locally

Running the seeding script:

```
ts-node scripts/seed-localhost.ts
```

Useful scripts are exposed to you via the package.json file. Additionally, there is a production dump of MongoDB available here as `prod-dump.tar`. You can untar it and use `mongorestore --uri="YOUR_CONNECTION_STRING" prod-dump` on it to import prod data into your local MongoDB. This dump was generated with the following command:
```
mongodump --db=payload --excludeCollectionsWithPrefix=_ --excludeCollection=cms-users --out=prod-dump
```
As you can see, it did not include production users.
