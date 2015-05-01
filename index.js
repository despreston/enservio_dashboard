var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io')(server);
var request = require('request');
var async = require('async');

var INTERVAL_SECS = 1800;
var urls = {
	qa: {
		qa11: [{ name: 'CE_SC', url: 'http://qa11.contentsexpress.lan/release_info.json' }], 
		qa32: [{ name: 'CE_SC', url: 'http://qa32.contentsexpress.lan/release_info.json' },
			   { name: 'IAP_SC', url: 'http://qa32.contentsexpress.lan/iap/release_info.json' }],
		qa42: [{ name: 'CE_SC', url: 'http://qa42.contentsexpress.lan/release_info.json' },
			   { name: 'IAP_SC', url: 'http://qa42.contentsexpress.lan/iap/release_info.json' },
			   { name: 'Admin_SC', url: 'http://qa42.contentsexpress.lan/adminsc/release_info.json' },
			   { name: 'claimsws', url: 'http://qa42.contentsexpress.lan/claimsws/release_info.json' },
			   { name: 'ce_web', url: 'http://qa42.contentsexpress.lan/web/release_info.json' },
			   { name: 'ce_app', url: 'http://qa42.contentsexpress.lan/app/release_info.json' },
			   { name: 'adminws', url: 'http://qa42.contentsexpress.lan/adminws/release_info.json' },
			   { name: 'IDP', url: 'http://qa42.contentsexpress.lan/idp/release_info.json' },
			   { name: 'IntegrationWS', url: 'http://qa42.contentsexpress.lan/integrationws/release_info.json' }]
	},
	dev: {
		dev02: [{ name: 'CASA_SC', url: 'http://dev02.contentsexpress.lan/casa/release_info.json' }]
	}
};

app.use(express.static('static'));

function Exception(message) {
	this.message = message;
	this.name = 'Exception';
}

io.on('connection', function(socket) {
	console.log('connected');
	var s = socket,
		refreshInterval;

	socket.on('getServerInfo', function(data) {
		try {
			if(refreshInterval) {
				clearInterval(refreshInterval);
			}
			generateMap(data.server, data.environment, s);
			refreshInterval = setInterval(function(){generateMap(data.server, data.environment, s)}, INTERVAL_SECS * 1000);
		} catch(e) {
			console.log(e);
			clearInterval(refreshInterval);
		}
	});
	socket.on('disconnect', function(data) {
		console.log('disconnected');
		clearInterval(refreshInterval);
	});
});

var generateMap = function(server, env, s) {
	if (!urls.hasOwnProperty(env)) {
		throw new Exception("Environment does not exist: " + env);
	} else if (!urls[env].hasOwnProperty(server)) {
		throw new Exception(env + ' does not have the server: ' + server);
	}
	
	var resultsObj = {},
		oldBuildTimestamp = (typeof oldBuildTimestamp === 'undefined' ? {} : oldBuildTimestamp);
	
	async.map(urls[env][server], fetchData, function(error, results) {
			async.each(results, 
				//convert the array created by .map into an object
				function(item, callback) {
					for (key in item) {
						if (item.hasOwnProperty(key)) {
							if (item[key].hasOwnProperty('error')) {
								resultsObj[key] = item[key];
							} else {
								// old build timestamp doesnt exist-- usually happens on first pass
								if (!oldBuildTimestamp.hasOwnProperty(key)) { 
									oldBuildTimestamp[key] = item[key].build_info.build_timestamp; 
									resultsObj[key] = item[key];
								}
								// timestamp is different than the old one
								else if (oldBuildTimestamp[key] != item[key].build_info.build_timestamp) {
									oldBuildTimestamp[key] = item[key].build_info.build_timestamp; 
									resultsObj[key] = item[key];
									console.log('shit changed!');
									resultsObj[key]['changed'] = true;
								}
								// time stamp is the same. don't append the updated flag
								else {
									resultsObj[key] = item[key];
								}
							}
							callback();
						}
					}

				},
				function() {
					var d = new Date();
					resultsObj['updated'] = d.toString();
					s.emit('servers_update', resultsObj);
				}
			);
	});
};

function fetchData(url_obj, cb) {
	var server_obj = {};

	request.get({url: url_obj.url, json: true, encoding: 'utf8'}, function(error, response, body) {
		if (!error && response.statusCode == 200) {
			if (body.constructor != Object) {
				cb('Not returning an object');
			} else {
				server_obj[url_obj.name] = body;
				cb(null, server_obj);
			}
		} else {
			error = {message: 'URL: ' + url_obj.url + ' Response Code: ' + response.statusCode, server: url_obj.name};
			server_obj[url_obj.name] = { error: error};
			cb(null, server_obj);
		}
	});
};

server.listen(3000, function(){
  console.log('listening on *:3000');
});