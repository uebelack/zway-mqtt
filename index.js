/*** MQTT Z-Way module *******************************************
 Version: 0.0.1
 -----------------------------------------------------------------------------
 Author: David Uebelacker <david@uebelacker.ch>
 Buffer from: https://github.com/toots/buffer-browserify
 MQTT from: https://github.com/leizongmin/MQTTClient
 ******************************************************************************/

function MQTT(id, controller) {
    MQTT.super_.call(this, id, controller);
}

inherits(MQTT, AutomationModule);

_module = MQTT;


MQTT.prototype.init = function (config) {

    const BRIDGE_URL = 'http://127.0.0.1:34254';
    const DIRECT_DEVICES = [
        'toggleButton',
        'battery',
        'sensorBinary',
        'sensorMultilevel'
    ];


    MQTT.super_.prototype.init.call(this, config);
    console.log('MQTT: starting...');

    var self = this;
    self.config = config;
    self.status = {};

    this.log = function (message) {
        console.log('MQTT: ' + message);
    };

    this.verbose = function (message) {
        if (self.config.verbose) {
            console.log('MQTT: ' + message);
        }
    };

    this.findRoom = function (id) {
        var locations = self.controller.locations;
        if (locations) {
            for (var i = 0; i < locations.length; i++) {
                if (locations[i].id == id) {
                    return locations[i];
                }
            }
        }
        return null;
    };

    this.createTopic = function (device) {
        var room = self.findRoom(device.get('location'));
        var topic = self.config.topic_prefix;
        topic += '/';
        topic += room.title;
        topic += '/';
        topic += device.get('metrics:title');
        return topic;
    };

    this.deviceUpdate = function (device) {
        var topic = self.createTopic(device);
        var value = device.get('metrics:level');
        if (!device.get('permanently_hidden')) {
            if (self.status[topic] === undefined
                || value != self.status[topic].value
                || (DIRECT_DEVICES.indexOf(device.get('deviceType')) >= 0
                    && self.status[topic].timestamp + 2000 < self.timestamp())) {
                self.status[topic] = {timestamp: self.timestamp(), value: value};
                self.verbose('publishing: ' + topic + ': ' + value);
                self.sendUpdateToBridge(topic, value.toString().trim(), {retain: self.config.retain});
            }
        }
    };

    this.timestamp = function() {
        return Date.now();
    };

    this.sendConfigToBridge = function () {
        request = {
            url: BRIDGE_URL + '/config',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(self.config)
        };
        self.verbose('SENDING: ' + JSON.stringify(request));
        self.verbose('RESPONSE: ' + JSON.stringify(http.request(request)));
    };

    this.sendUpdateToBridge = function (topic, value) {
        request = {
            url: BRIDGE_URL + '/update',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({topic: topic, value: value})
        };

        self.verbose('SENDING: ' + JSON.stringify(request));
        self.verbose('RESPONSE: ' + JSON.stringify(http.request(request)));
    };

    if (!self.config.host || !self.config.port) {
        this.log('Host or port not configured! will not start!')
    } else {
        this.sendConfigToBridge();
        this.controller.devices.on('change:metrics:level', self.deviceUpdate);
    }
};

