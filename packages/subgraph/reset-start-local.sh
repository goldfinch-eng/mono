set -e

root_dir=$(dirname $(dirname $(dirname $(readlink -f "$0"))))
env_path="${root_dir}/.env.local"
source "${env_path}"

if [ -z "$REACT_APP_HARDHAT_FORK" ]; then
    echo "Cannot start subgraph with local forking." \
         "Either start with mainnet forking or set REACT_APP_TOGGLE_THE_GRAPH as false." \
         "Exiting..."
    exit 1
fi

if [ "$REACT_APP_TOGGLE_THE_GRAPH" != "true" ]; then
    echo "The graph feature flag is toggled off. Exiting..."
    exit 0
fi

docker-compose down -v;

echo "Building the subgraph..."

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "On a linux system running setup script"
    bash ./setup.sh
fi

echo "On a linux system running setup script"
docker-compose down -v;

if [ -d "data" ]
then
  echo "Found old data for the graph node - deleting it";
  # we need to sudo this to remove system locked files
  sudo rm -rf data/;
fi

docker-compose up -d;

sleep 30

npm run build

npm run create-local

npm run deploy-local
