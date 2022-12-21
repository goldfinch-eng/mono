set -e

root_dir=$(dirname $(dirname $(dirname $(readlink -f "$0"))))
env_path="${root_dir}/.env.local"
source "${env_path}"

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

docker-compose down -v;
docker-compose up -d;

sleep 30

yarn build
yarn create-local
yarn deploy-local
