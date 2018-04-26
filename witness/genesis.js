"use strict";
const db = require('trustnote-common/db.js');
const headlessWallet = require('trustnote-headless');
const eventBus = require('trustnote-common/event_bus.js');
const constants = require('trustnote-common/constants.js');

function onError(err) {
    throw Error(err);
}

function createGenesisUnit(address, onDone) {
    var composer = require('trustnote-common/composer.js');
    var network = require('trustnote-common/network.js');

    var savingCallbacks = composer.getSavingCallbacks({
        ifNotEnoughFunds: onError,
        ifError: onError,
        ifOk: function(objJoint) {
            network.broadcastJoint(objJoint);
            onDone(objJoint.unit.unit);
        }
    });

    composer.setGenesis(true);
    composer.composeJoint({
        witnesses: [address],
        paying_addresses: [address],
        outputs: [
            { address: address, amount: 1000000 },
            { address: address, amount: 1000000 },
            { address: address, amount: 1000000 },
            { address: address, amount: 1000000 },
            { address: address, amount: 1000000 },
            { address: address, amount: 0 }, // change output
        ],
        signer: headlessWallet.signer,
        callbacks: {
            ifNotEnoughFunds: onError,
            ifError: onError,
            ifOk: function(objJoint, assocPrivatePayloads, composer_unlock) {
                constants.GENESIS_UNIT = objJoint.unit.unit;
                savingCallbacks.ifOk(objJoint, assocPrivatePayloads, composer_unlock);
            }
        }
    });

}

// function addMyWitness(witness, onDone) {
//     db.query("INSERT INTO my_witnesses (address) VALUES (?)", [witness], onDone);    
// }

eventBus.once('headless_wallet_ready', function() {
    headlessWallet.readSingleAddress(function(address) {
        createGenesisUnit(address, function(genesisHash) {
            console.log("Genesis created, hash=" + genesisHash);
            // addMyWitness(address, function() {
                process.exit(0);
            // });
        });
    });
});
