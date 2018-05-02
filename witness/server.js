"use strict";
require("trustnote-common/wallet.js");
require("trustnote-common/enforce_singleton.js");
const witness = require("trustnote-witness");
const explorer = require('trustnote-explorer/explorer.js');
const headlessWallet = require('trustnote-headless');
const eventBus = require('trustnote-common/event_bus.js');
const validationUtils = require("trustnote-common/validation_utils.js");
const conf = require('trustnote-common/conf.js');
const constants = require('trustnote-common/constants.js');
var db = require('trustnote-common/db.js');
var storage=require('trustnote-common/storage.js');

function initRPC() {
	var rpc = require('json-rpc2');

	var server = rpc.Server.$create({
		'websocket': true, // is true by default 
		'headers': { // allow custom headers is empty by default 
			'Access-Control-Allow-Origin': '*'
		}
	});

	/**
	 * Send funds to address.
	 * If address is invalid, then returns "invalid address".
	 * @param {String} address
	 * @param {Integer} amount
	 * @return {String} status
	 */
	server.expose('sendtoaddress', function(args, opt, cb) {
		var amount = args[1];
		var toAddress = args[0];
		if (amount && toAddress) {
			if (validationUtils.isValidAddress(toAddress))
				headlessWallet.issueChangeAddressAndSendPayment(null, amount, toAddress, null, function(err, unit) {
					cb(err, err ? undefined : unit);
				});
			else
				cb("invalid address");
		}
		else
			cb("wrong parameters");
	});

	/**
	 * Send blackbytes to address.
	 * If address is invalid, then returns "invalid address".
	 * @param {String} device
	 * @param {String} address
	 * @param {Integer} amount
	 * @return {String} status
	 */
	server.expose('sendblackbytestoaddress', function(args, opt, cb) {
		if (args.length != 3) {
			return cb("wrong parameters");
		}

		let device = args[0];
		let toAddress = args[1];
		let amount = args[2];

		if (!validationUtils.isValidDeviceAddress(device)) {
			return cb("invalid device address");
		}

		if (!validationUtils.isValidAddress(toAddress)) {
			return cb("invalid address");
		}

		headlessWallet.readSingleAddress(function(fromAddress) {
			createIndivisibleAssetPayment(constants.BLACKBYTES_ASSET, amount, fromAddress, toAddress, device, function(err, unit) {
				cb(err, err ? undefined : unit);
			});
		});
	});

	server.expose('getbalance', function(args, opt, cb) {
		let start_time = Date.now();
		var address = args[0];
		var asset = args[1];
		if (address) {
			if (validationUtils.isValidAddress(address))
				db.query("SELECT COUNT(*) AS count FROM my_addresses WHERE address = ?", [address], function(rows) {
					if (rows[0].count)
						db.query(
							"SELECT asset, is_stable, SUM(amount) AS balance \n\
							FROM outputs JOIN units USING(unit) \n\
							WHERE is_spent=0 AND address=? AND sequence='good' AND asset "+(asset ? "="+db.escape(asset) : "IS NULL")+" \n\
							GROUP BY is_stable", [address],
							function(rows) {
								var balance = {};
								balance[asset || 'base'] = {
									stable: 0,
									pending: 0
								};
								for (var i = 0; i < rows.length; i++) {
									var row = rows[i];
									balance[asset || 'base'][row.is_stable ? 'stable' : 'pending'] = row.balance;
								}
								cb(null, balance);
							}
						);
					else
						cb("address not found");
				});
			else
				cb("invalid address");
		}
		else
			Wallet.readBalance(wallet_id, function(balances) {
				console.log('getbalance took '+(Date.now()-start_time)+'ms');
				cb(null, balances);
			});
	});
	server.listen(conf.rpcPort, conf.rpcInterface);
}

function createIndivisibleAssetPayment(asset, amount, fromAddress, toAddress, toDevice, callback) {
	var network = require('trustnote-common/network.js');
	var indivisibleAsset = require('trustnote-common/indivisible_asset.js');
	var walletGeneral = require('trustnote-common/wallet_general.js');

	indivisibleAsset.composeAndSaveIndivisibleAssetPaymentJoint({
		asset: asset,
		paying_addresses: [fromAddress],
		fee_paying_addresses: [fromAddress],
		change_address: fromAddress,
		to_address: toAddress,
		amount: amount,
		tolerance_plus: 0,
		tolerance_minus: 0,
		signer: headlessWallet.signer,
		callbacks: {
			ifNotEnoughFunds: callback,
			ifError: callback,
			ifOk: function(objJoint, arrChains) {
				network.broadcastJoint(objJoint);
				if (arrChains) { // if the asset is private
					walletGeneral.sendPrivatePayments(toDevice, arrChains);
				}
				callback(null, objJoint.unit.unit);
			}
		}
	});
}

function postTimestamp(address) {
	var composer = require('trustnote-common/composer.js');
	var network = require('trustnote-common/network.js');
	var callbacks = composer.getSavingCallbacks({
		ifNotEnoughFunds: function(err) {
			console.error(err);
		},
		ifError: function(err) {
			console.error(err);
		},
		ifOk: function(objJoint) {
			network.broadcastJoint(objJoint);
		}
	});

	var datafeed = {
		time: new Date().toString(),
		timestamp: Date.now()
	};
	composer.composeDataFeedJoint(address, datafeed, headlessWallet.signer, callbacks);
}



eventBus.once('headless_wallet_ready', function() {
	initRPC();
	headlessWallet.readSingleAddress(function(address) {
		storage.restoreRound(db,address);
	});
});

eventBus.on('paired', function(from_address) {
    console.log('Sucessfully paired with:' + from_address);
    const device = require('trustnote-common/device.js');
    device.sendMessageToDevice(from_address, "text", "Welcome to devnet Witness!");
});
