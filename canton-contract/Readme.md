# First time

make deploy # build + start node + upload DAR + setup

# Pick an environment

make deploy ENV=prod

# Individual steps

make build
make start-bg
make upload
make setup
make allocate-parties

# Iteration

make redeploy # stop → full deploy
make reset # stop → clean → full deploy

# Quality

make test
make lint

# Cleanup

make clean # removes .daml/dist
make clean-all # also stops Canton and removes data dirs

# Custom node URL

make upload CANTON_LEDGER_URL=10.0.0.5:6865
