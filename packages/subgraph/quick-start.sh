set -e

FILE=~/dump_branch_feature_earn_page_subgraph_pt2.sql
# check if backup exists on user's machine
if [ -f "$FILE" ]; then
  echo "Dump file already exists: $FILE"
else
  echo "You must download the backup file at: https://drive.google.com/file/d/1KjLw2YJmJ_vRFqj-ElPXCPc1rw53iLW8/view"
  exit 0
fi

root_dir=$(dirname $(dirname $(dirname $(readlink -f "$0"))))
env_path="${root_dir}/.env.local"
source "${env_path}"

if [ "$REACT_APP_TOGGLE_THE_GRAPH" != "true" ]; then
    echo "The graph feature flag is toggled off. Exiting..."
    exit 0
fi

if [ -d "data" ]
then
  echo "Found old data for the graph node - deleting it";
  # we need to sudo this to remove system locked files
  sudo rm -rf data/;
fi

docker compose down -v;

docker compose --env-file .env.local-subgraph up -d postgres

sleep 3

cat $FILE | docker exec -i $(docker-compose ps -q postgres) psql -U graph-node

docker compose --env-file .env.local-subgraph up -d;

sleep 30
