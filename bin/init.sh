#!/bin/bash

PROJECT="byteball-devnet-witness"
CONFDIR="$HOME/.config"

if [ -d node_modules/tttcore ]; then
    echo "Setting devnet constants:"
    cp -v config/constants.js node_modules/tttcore/constants.js
else
    echo "Project is not ready yet. Run 'npm install' first!"
    exit -1
fi

if [ -d "$CONFDIR/$PROJECT" ]; then
    echo "Configuration directory already exists."
else
    echo "Creating configuration directory with default keys:"
    cp -vr config/$PROJECT $CONFDIR/
fi

BYTEBALL_CORE_VERSION=`npm view tttcore version`
if [ "$BYTEBALL_CORE_VERSION" == "0.2.57" ]; then
    echo "Patching byteball core to support single witness:"
    patch -N -r - node_modules/tttcore/composer.js < patch/composer.js/fix-single-authored-genesis-issue-input.patch
elif [ "$BYTEBALL_CORE_VERSION" == "0.2.58" ]; then
    echo "Patching byteball core to fix hub/deliver message to self:"
    patch -N -r - node_modules/tttcore/network.js < patch/network.js/fix-hub-deliver-to-self.patch
elif [ "$BYTEBALL_CORE_VERSION" == "0.2.78" ]; then
    echo "Patching byteball core to fix witnessed level for genesis unit:"
    patch -N -r - node_modules/tttcore/storage.js < patch/storage.js/fix-witnessed-level-for-genesis.patch
else
    echo "Detected compatible byteball core v$BYTEBALL_CORE_VERSION"
fi

echo "Fixing Byteball DAG explorer to update automatically"
sed -i -e 's/new_joint/new_my_transactions/' node_modules/byteball-explorer/explorer.js

echo "You can now run 'npm run genesis'"
