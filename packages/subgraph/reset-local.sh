set -e

root_dir=$(dirname $(dirname $(dirname $(readlink -f "$0"))))
env_path="${root_dir}/.env.local"
source "${env_path}"

if [ "$REACT_APP_TOGGLE_THE_GRAPH" != "true" ]; then
    echo "The graph feature flag is toggled off. Exiting..."
    exit 0
fi

docker compose down -v;

if [ -d "data" ]
then
  echo "Found old data for the graph node - deleting it";
  # we need to sudo this to remove system locked files
  sudo rm -rf data/;
fi
