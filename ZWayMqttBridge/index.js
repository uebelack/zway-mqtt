/*** MQTT Z-Way odule *******************************************
 Version: 1.0.0
 -----------------------------------------------------------------------------
 Author: David Uebelacker <david@uebelacker.ch>
 ******************************************************************************/

function ZWayMqttBridge(id, controller) {
    ZWayMqttBridge.super_.call(this, id, controller);
}

inherits(ZWayMqttBridge, AutomationModule);

_module = ZWayMqttBridge;

ZWayMqttBridge.prototype.init = function (config) {
    ZWayMqttBridge.super_.prototype.init.call(this, config);

    var self = this;



    this.log = function(message) {
        console.log('ZWayMqttBridge: ' + message);
    };

    if (!self.config.host || !self.config.port) {
        this.log('Host or port not configured! will not start!')
    };

    this.reconnect = function () {
        self.connected = false;
        self.mqttBridge = null;
        self.log('Will try to reconnect to Mqtt Bridge in 10 seconds ...');
        setTimeout(function () {
            self.connect();
        }, 10000);
    };

    this.connect = function () {
        self.log('Connecting to Mqtt Bridge ....');

        this.mqttBridge = new sockets.tcp();
        this.mqttBridge.onrecv = function (data) {
            self.log('Connecting to Mqtt Bridge established!');
            self.connected = true;
        };

        this.mqttBridge.onclose = function () {
            self.log('Mqtt Bridge connection was closed!');
            self.reconnect();
        };

        if (this.mqttBridge.connect(self.config.host, parseInt(self.config.port))) {
            setTimeout(function () {
                if (self.mqttBridge && !self.connected) {
                    self.log('Mqtt Bridge connection timeout!');
                    self.reconnect();
                }
            }, 5000);
        } else {
            self.log('Could not connect to Mqtt Bridge!');
            self.reconnect();
        }
    };

    this.findRoom = function(id) {
        self.log('Searching for room with id ' + id);
        var locations = self.controller.locations;
        if (locations) {
            for (var i = 0; i < locations.length; i++) {
                console.log(locations[i].id);
                if (locations[i].id == id) {
                    return locations[i];
                }
            }
        }
        return null;
    };

    this.createTopic = function(device) {
        var topic = '/';
        topic += self.config.topic_prefix;
        topic += '/';
        topic += self.normalizeTopicToken(self.findRoom(device.get('location')));
        topic += '/';
        topic += self.normalizeTopicToken(device.get('metrics:title'));
        return topic;
    };

    this.normalizeTopicToken = function(token) {
        token = token.toLowerCase();
        token = token.replace(/[^0-9a-z_]/g, '_');
        return token;
    };

    this.deviceUpdate = function (device) {
        if (self.mqttBridge) {

            self.log(self.findRoom(device.get('location')))

            var message = {
                'topic': self.createTopic(device),
                'payload': device.get('metric:level')
            };

            var str = JSON.stringify(message);

            self.log('Sending update to bridge:' + str);

            var buf = new ArrayBuffer(str.length); // 2 bytes for each char
            var bufView = new Uint8Array(buf);

            for (var i=0; i < str.length; i++) {
                bufView[i] = str.charCodeAt(i);
            }

            self.mqttBridge.send(buf);
        }
    };

    this.connect();
    this.controller.devices.on('change:metrics:level', self.deviceUpdate);
};

