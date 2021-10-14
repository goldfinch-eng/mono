set -e

docker-compose down -v;

echo "Building the sugraph..."

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "On a linux system running setup script"
    bash ./setup.sh
fi

echo "On a linux system running setup script"
docker-compose down -v;
docker-compose up -d;

# if [ -d "data" ]
# then
#   echo "Found old data for the graph node - deleting it";
#   # we need to sudo this to remove system locked files
#   sudo rm -rf data/;
# fi

sleep 30

npm run codegen && npm run build

graph create --node http://localhost:8020/ goldfinch-subgraph

npm run deploy-local --version-label v0.0.1
