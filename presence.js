var fs = require('fs');
var arp = require('node-arp');
var Promise = require('promise');
var logger = require('./logger.js');
var request = require('request');

logger.debug('platform is: '+process.platform);
var path = __dirname+"/../../presenceDb.json";
var tokensPath = __dirname+"/../../tokens.json";
var secretsPath = __dirname+'/../../secrets.json';
var _uuid = "f589cad6-49bf-4d1b-9091-4ba9ef1d466b";
var persons;

var darkStart, darkEnd;
var yemama = 60000*60*24;
var customStartAddition = -60000*60*1.5;
var timeZoneOffset;

var tokensObject;
var secretsObject;

var location = {
	lat: '32.188442',
	lon: '34.896422'
};

var googleApiKey = 'AIzaSyDBdaxeZln_ubb2yrqM8Wg6H0INz_GZ-fo';

function initSunTimes() {

	logger.debug('initSunTimes started...');

	//get the local time zone + dst
	var currentTimeinSeconds = new Date().getTime() / 1000;
	var timeZoneApiUrl = 'https://maps.googleapis.com/maps/api/timezone/json?location='+location.lat+','+location.lon+'&timestamp='+currentTimeinSeconds+'&key='+googleApiKey;
	var sunTimeApiUrl = 'http://api.sunrise-sunset.org/json?lat='+location.lat+'&lng='+location.lon+'&date=today&formatted=0';

	logger.debug('requesting time zone from '+timeZoneApiUrl);
	request(timeZoneApiUrl, function(error, response, body) {
		logger.debug('received response from timeZone api: '+response.statusCode);
		if (!error && response.statusCode === 200) {
			var responseObj = JSON.parse(body);
			timeZoneOffset = responseObj.rawOffset + responseObj.dstOffset;

			logger.debug('time zone offset is: '+timeZoneOffset+' now for the sun times...');
			request(sunTimeApiUrl, function(sunError, sunResponse, sunBody) {
				logger.debug('received response from suntimes api '+response.statusCode);
				if (!sunError && sunResponse.statusCode === 200) {
					var responseObj = JSON.parse(sunBody).results;
					darkStart = new Date(responseObj.sunset).getTime()+timeZoneOffset+customStartAddition;
					darkEnd = new Date(responseObj.sunrise).getTime()+timeZoneOffset+yemama;

					logger.debug('darkStart at: '+darkStart);
					logger.debug('darkEnd at: '+darkEnd);

					//var test1 = new Date('2016-03-12T08:39:44.172Z');
					//var test2 = new Date('2016-03-12T15:00:44.172Z');

					//logger.debug('test1 is dark? '+isDark(test1.getTime()));
					//logger.debug('test2 is dark? '+isDark(test2.getTime()));
					//if (!isDark(test2.getTime())) {
					//	console.error('Error! test2 ('+test2+') suppose to be dark!!');
					//}
					logger.debug('is it dark now? ('+new Date()+') '+isDark(new Date()));
				}
				else {
					logger.error('Error from suntimes api: '+JSON.parse(response));
				}
			})

		}
		else {
			logger.error('Error from timeZone api '+JSON.parse(response));
		}


	})
}

function initTokenFiles() {
	logger.debug("initiating tokens file");
	var fileStr = fs.readFileSync(tokensPath);
	tokensObject = JSON.parse(fileStr);
	var secretsFile = fs.readFileSync(secretsPath);
	secretsObject = JSON.parse(secretsFile);

	logger.debug('tokens file is: '+fileStr);
	logger.debug('secrets files is: '+secretsFile);
}

function isDark(timestamp) {

	logger.debug('checking if isDark with darkStart: '+darkStart+', darkEnd: '+darkEnd+' and timestamp is: '+timestamp);

	var now = new Date();
	if (now.getHours() < 8 || now.getHours() > 20) {
		logger.debug("no need for dark login in the middle of the night ("+now+")");
		return false;
	}
	if (darkStart && darkEnd) {
		var result = timestamp > darkStart && timestamp < darkEnd;
		logger.debug('Is it dark? '+result);
		return result;
	}
	else {
		logger.error('sun times not set...');
		return false;
	}

}

function noOneIsHome(persons) {
	var result = true;
	persons.forEach(function (person) {
		if (person.status.toLowerCase() === 'home' && person.name.toLowerCase() !== 'itchuk') {
			result = false;
		}
	});

	return result;
}

function startServer() {
	fs.readFile(path, function(err, fileStr) {

		if (err) {
			console.error('Error reading '+path);
			return;
		}


		var fileJson = JSON.parse(fileStr);
		persons = fileJson.persons;

		console.log('file '+path+' open!: '+fileStr);
		var ori = persons.filter(function(person) {
			return person.name === 'Ori';
		})[0];

		var yifat = persons.filter(function(person) {
			return person.name === 'Yifat';
		})[0];

        var itchuk = persons.filter(function(person) {
            return person.name === 'Itchuk';
        })[0];

		console.log('initial status of Ori: '+ori.status);
		console.log('initial status of Yifat: '+yifat.status);
		console.log('initial status of Itchuk: '+itchuk.status);

		console.log('Ori MacAddress: '+ori.macAddress);
		console.log('Yifat MacAddress: '+yifat.macAddress);
		console.log('Itchuk MacAddress: '+itchuk.macAddress);

		setInterval(function() {

			var promises = [];

			//for (var i = 0; i < 35; i++) {

			//var ip = '10.0.0.'+i;
			promises.push(getMacForIP('192.168.1.2'));
			promises.push(getMacForIP('192.168.1.5'));
			promises.push(getMacForIP('192.168.1.6'));
			//}

			Promise.all(promises).then(function(nonPaddedLivingMacs) {
				var livingMacs = nonPaddedLivingMacs.map(function(nonPaddedMacAddress) {
					return padMac('0', nonPaddedMacAddress.macAddress);
				});
				// console.log('livingMacs: '+livingMacs);

				if (livingMacs.indexOf(ori.macAddress) > -1) {
					processResult('home', ori, persons);
				}
				else {
					processResult('away', ori, persons);
				}

				if (livingMacs.indexOf(yifat.macAddress) > -1) {
					processResult('home', yifat, persons);
				}
				else {
					//console.log('yifat is away');
					processResult('away', yifat, persons);
				}

				if (livingMacs.indexOf(itchuk.macAddress) > -1) {
					processResult('home', itchuk, persons);
				}
				else {
					//console.log('itchuk is away');
					processResult('away', itchuk, persons);
				}

			}).catch(function(exc) {
				console.error('Error promise all: '+exc+' stack: '+exc.stack);
			});


		}, 1000);

	});
}

function sendPush(notificationObj) {
	var fcmUrl = 'https://fcm.googleapis.com/fcm/send';

	var authKey = secretsObject.serverKey;

	logger.debug('sending push');
	var users = Object.keys(tokensObject);

	var registrationIds = [];
	users.forEach((user)=>{
		registrationIds = registrationIds.concat(tokensObject[user]);
	});


	var data = {
        "data": {
            "msg":"presence",
			"title":notificationObj.title,
			"body":notificationObj.body
        },
		// "notification":notificationObj,
		"sound":"default",
		"priority":"high",
		"registration_ids": registrationIds
	};

	var authCookie = 'key='+authKey;

	logger.debug('sending push to: '+registrationIds+' authCookie: '+authCookie);
	request({
		url: fcmUrl,
		headers: {
			'Content-Type': 'application/json',
			'Authorization': authCookie
		},
		method: 'POST',
		json: data
	}, (error, response, body)=>{
		try {
			if (response) {
				logger.debug('sendPush finished response.statusCode: '+response.statusCode);
			}

			if (error) {
				logger.error('Error sending push to '+registrationIds+' error: '+error);
			}
			if (response && response.statusCode != 200) {
				logger.error('response status code is: '+response.statusCode);
			}

			// var bodyExample = {
			//     "multicast_id":7817453940186984000,
			//     "success":1,
			//     "failure":0,
			//     "canonical_ids":0,
			//     "results":[{"message_id":"0:1488746124884778%23210808f9fd7ecd"}]
			// }

			logger.debug('body is: '+JSON.stringify(body));

			if (body.failure > 0) {
				logger.error('Error sending push to '+body.failure+' recipients');
			}
		}
		catch (ex) {
			logger.error('Exception in push response read! '+ex);
			logger.error('Exception stack: '+ex.stack);
		}

	});
}

var processResult = function(status, person, allPersons) {
	if (status === 'home') {

		if (person.awayTimeout) {
			logger.debug('false away detected for '+person.name);
		}

		clearTimeout(person.awayTimeout);
		delete person.awayTimeout;

		if (person.status === 'away') {

			var isNoOneHome = noOneIsHome(allPersons);
			logger.debug('adding HOME state for '+person.name+' isNoOneHome: '+isNoOneHome);
			var notificationObj = {
				title: 'Presence Change!',
				body: person.name+' is home!'
			};

			sendPush(notificationObj);
			person.status = 'home';
			person.deadCount = 0;
			person.updated_at = new Date().toISOString();

			if (isDark(Date.now()) && isNoOneHome) {
				logger.debug('its dark. turn on the light...');
				turnOnTheLights();
			}
			else {
				logger.debug("no need to turn on the light");
			}

			if (isNoOneHome) {
				deActivateCamera();
			}


			savePersons();
		}

	}
	else {
		if (person.status === 'home') {

			if (!person.awayTimeout) {
				logger.debug('detected away for '+person.name+'. starting the timeout... (which is now '+person.awayTimeout+')');

				person.awayTimeout = setTimeout(function() {
					person.status = 'away';
					console.log(new Date().toISOString() + ' adding AWAY state for '+person.name);

					var notificationObj = {
						title: 'Presence Change!',
						body: person.name+' left!'
					};

					sendPush(notificationObj);

					person.updated_at = new Date().toISOString();
					savePersons();
					if (noOneIsHome(allPersons)) {
						activateCamera();
					}

				}, 15*60000);
			}



		}
		person.deadCount = 0;
	}

};

function deActivateCamera() {

	logger.debug('attempting to deactivate camera');
	request({url: 'http://192.168.1.4:6367/deActivate/cam?uuid='+_uuid, method: 'POST'}, function(error, response, body) {
		logger.debug('deActivate/cam finished error: '+error);
		if (!error) {
			logger.debug('camera deactivated successfully!');
		}
		else {
			logger.error('unable to deactivate camera. trying again');
			setTimeout(deActivateCamera, 1000);
		}
	});

}

function activateCamera() {
	request({url: 'http://192.168.1.4:6367/activate/cam?uuid='+_uuid, method: 'POST'}, function(error, response, body) {
		logger.debug('activate/cam finished');
	});
}

function turnOnTheLights() {

	logger.debug('invoking turnOnTheLights');
	request({url: 'http://192.168.1.4:6367/all/sockets/on?uuid='+_uuid, method: 'POST'}, function(error, response, body) {
		logger.debug('all/sockets/on finished');
	});

	setRollerPosition('on');
}

function setRollerPosition(state) {

	logger.debug('invoking setRollerPosition');
	request({url: 'http://192.168.1.4:6367/zwave/shutter/'+state, method: 'POST'}, function(error, response, body) {
		logger.debug('/zwave/shutter/'+state+' finished');
	});
}

function zwaveLogin() {
	return new Promise(function(resolve, reject) {
        request({url: 'http://192.168.1.3:8083/ZAutomation/api/v1/login', method: 'POST',
				json: {"login":"admin", "password":"hagav6367"}},
			function(error, response, body) {

        	if (error){
        		logger.error('Error trying to login to z-way '+error);
			}
			else {
        		var sid = response.sid;
        		resolve(sid);
			}
        });
	})
}

function savePersons() {
	fs.readFile(path, function(err, fileStr) {
		var fileJson = JSON.parse(fileStr);

		persons.forEach(function(person) {
			delete person.awayTimeout;
		});

		fileJson.persons = persons;
		fs.writeFileSync(path, JSON.stringify(fileJson));
	});
}

function getMacForIP(ip) {

	return new Promise(function(resolve, reject) {

		try {
			arp.getMAC(ip, function(err, mac) {

				//console.log(new Date().toISOString()+' sending mac for: '+ip+' is: '+mac);

				if (err) {
					reject(err);
				}
				else {
					//console.log('resolving mac: '+mac);
					resolve({macAddress: mac, ip: ip})
				}

			});
		}
		catch(exc) {
			logger.error('exception in getMacForIP: '+exc);
			reject(exc);
		}


	})

}

function padMac(padChar, macAddress) {
	return macAddress ? macAddress.replace(':a:', ':'+padChar+'a:') : "";
}

initSunTimes();
initTokenFiles();
setInterval(function() {
	var now = new Date();
	logger.debug('checking if need to refresh dark times in '+now);
	if (now.getHours() === 11) {
		logger.debug('its time to refresh dark times...');
		initSunTimes();
	}
	else {
		logger.debug('no need to refresh dark time');
	}
}, 60000*30);
startServer();
// deActivateCamera();