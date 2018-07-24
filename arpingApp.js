var child = require("child_process"), devices = [];

var intervalHandler = setInterval(function() {

    getMacForIP(ori.ip, function(isAlive){
        pingCallback(isAlive, ori);
    });

    getMacForIP(yifat.ip, function(isAlive){
        pingCallback(isAlive, yifat);
    });

}, 1000);

function run() {
    var activeDevices = devices.slice(), index = 0, curDevice = activeDevices[index], newState = false;

    getMacForIP(curDevice.config.ip, function check(mac) {
        if (!mac || !curDevice.config.mac || curDevice.config.mac == mac) {
            curDevice.state = mac ? "on" : "off";
            newState = newState || !!mac;
        }

        if (curDevice = devices[++index]) getMacForIP(curDevice.config.ip, check);
        else setTimeout(run, newState ? 300000 : 20000);
    });
}

function getMacForIP(ip, callback) {
    child.exec("sudo arping -I eth0 -c 8 -f " + ip, function(err, res) {
        res = res && /Unicast reply from .* \[(.+)\]/.exec(res);
        callback(res && res[1]);
    });
}