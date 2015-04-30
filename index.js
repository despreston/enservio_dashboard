var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io')(server);
var request = require('request');
var async = require('async');

var INTERVAL_SECS = 10;
var refreshInterval;
var urls = {
	qa: {
		qa11: [{ name: 'CE_SC', url: 'http://qa11.contentsexpress.lan/release_info.json' }], 
		qa32: [{ name: 'CE_SC', url: 'http://qa32.contentsexpress.lan/release_info.json' },
			   { name: 'IAP_SC', url: 'http://qa32.contentsexpress.lan/iap/release_info.json'}],
		qa42: [{ name: 'claimsws', url: 'http://qa42.contentsexpress.lan/claimsws/release_info.json' }]
	}
};

app.use(express.static('static'));

function Exception(message) {
	this.message = message;
	this.name = 'Exception';
}

io.on('connection', function(socket) {
	console.log('connected');
	var s = socket;

	socket.on('getServerInfo', function(data) {
		try {
			if(refreshInterval) {
				clearInterval(refreshInterval);
			}
			generateMap(data.server, data.environment, s);
			refreshInterval = setInterval(function(){generateMap(data.server, data.environment, s)}, INTERVAL_SECS * 1000);
		} catch(e) {
			console.log(e);
		}
	});
});

var generateMap = function(server, env, s) {

	if (!urls.hasOwnProperty(env)) {
		throw new Exception("Environment does not exist: " + env);
	} else if (!urls[env].hasOwnProperty(server)) {
		throw new Exception(env + ' does not have the server: ' + server);
	}

	var resultsObj = {};
	async.map(urls[env][server], fetchData, function(error, results) {
		if (error) {
			console.log(error);
			resultsObj['error'] = error;
			io.emit('servers_update', resultsObj);
			return error;
		} else {
			async.each(results, 
				function(item, callback) {
					for (key in item) {
						if (item.hasOwnProperty(key)) {
							resultsObj[key] = item[key];
							callback();
						}
					}
				},
				function(error) {
					if(!error) {
						var d = new Date();
						resultsObj['updated'] = d.toString();
						s.emit('servers_update', resultsObj);
					}
				}
			);
		}
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
			error = '\nResponse Code: ' + response.statusCode;
			cb(error);
		}
	});
};

server.listen(3000, function(){
  console.log('listening on *:3000');
});