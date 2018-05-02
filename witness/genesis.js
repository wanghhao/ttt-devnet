"use strict";
const db = require('trustnote-common/db.js');
const headlessWallet = require('trustnote-headless');
const eventBus = require('trustnote-common/event_bus.js');
const constants = require('trustnote-common/constants.js');
const fs = require('fs');
const readline = require('readline');
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


//yangk 20180427
function changeGenesisHash (genesisHash){

    if(typeof genesisHash == "undefined" || genesisHash == null || genesisHash == "" ){
        console.error('genesisHash  ERROR');
        return false ;
    }
    var fReadName ='../node_modules/trustnote-common/constants.js';
    var fWriteName ='../node_modules/trustnote-common/temp_readline.js';
    var fRead = fs.createReadStream(fReadName);
    var fWrite = fs.createWriteStream(fWriteName);
    var enableWriteIndex = true;
    var index = 1;

    fRead.on('end', function(){
        enableWriteIndex = false;
    });

    var objReadline = readline.createInterface({
        input: fRead,
        output: fWrite
    });

    objReadline.on('line', function(line){
        if (enableWriteIndex) {
            if(line.indexOf('exports.GENESIS_UNIT')>=0){
                line = "exports.GENESIS_UNIT = '"+genesisHash+"';";
            }
            index ++;
            fWrite.write(line+"\r\n");
        }
    });

    objReadline.on('close', function(){
        fs.unlinkSync(fReadName);

        copyFile(function () {
            fs.renameSync(fWriteName, fReadName);
            process.exit(0);
        });
    });
}

function copyFile(cb) {

    var fReadFile ='../node_modules/trustnote-common/temp_readline.js';
    var fWriteTrustnoteCommon = '../../trustnote-common/constants.js';
    var fRead = fs.createReadStream(fReadFile);
    var fWrite = fs.createWriteStream(fWriteTrustnoteCommon);
    var enableWriteIndex = true;
    var index = 1;

    fRead.on('end', function(){
        enableWriteIndex = false;
    });

    var objReadline = readline.createInterface({
        input: fRead,
        output: fWrite
    });

    objReadline.on('line', function(line){
        if (enableWriteIndex) {
            index ++;
            fWrite.write(line+"\r\n");
        }
    });
    objReadline.on('close', function(){
        cb();
    });
}

eventBus.once('headless_wallet_ready', function() {
    headlessWallet.readSingleAddress(function(address) {
        createGenesisUnit(address, function(genesisHash) {
            console.log("Genesis created, hash=" + genesisHash);
            changeGenesisHash(genesisHash);
        });
    });
});



