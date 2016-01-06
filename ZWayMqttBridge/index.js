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


    this.log = function (message) {
        console.log('ZWayMqttBridge: ' + message);
    };

    if (!self.config.host || !self.config.port) {
        this.log('Host or port not configured! will not start!')
    }
    ;

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
            if (!self.connected) {
                self.log('Connecting to Mqtt Bridge established!');
                self.connected = true;
            }

            if (data) {
                var messageStr = String.fromCharCode.apply(null, new Uint8Array(data));
                if (messageStr != 'HELLO') {
                    var message = JSON.parse(messageStr);
                    if (message.topic && message.payload) {
                        self.handleUpdatRequest(message);
                    }
                }
            }
        };

        this.mqttBridge.onclose = function (data) {
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

    this.handleUpdatRequest = function (message) {
        var device = self.findDevice(message.topic);
        if (device) {
            device.performCommand(message.payload);
        }
    };

    this.findDevice = function (topic) {
        var devices = self.controller.devices;
        if (devices) {
            for (var i = 0; i < devices.length; i++) {
                if (devices[i]) {
                    var device_topic = self.createTopic(devices[i]);
                    if (device_topic + '/' + 'set' == topic) {
                        return devices[i];
                    }
                }
            }
        }
        return null;
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
        topic += self.normalizeTopicToken(room.title);
        topic += '/';
        topic += self.normalizeTopicToken(device.get('metrics:title'));
        return topic;
    };

    this.normalizeTopicToken = function (token) {
        token = token.toLowerCase();
        token = token.replace(/[^0-9a-z_]/g, '_');
        return token;
    };

    this.deviceUpdate = function (device) {
        if (self.mqttBridge) {
            var message = {
                'topic': self.createTopic(device),
                'payload': device.get('metrics:level')
            };

            var str = JSON.stringify(message);
            self.log('Sending update to bridge:' + str);
            var buf = new ArrayBuffer(str.length); // 2 bytes for each char
            var bufView = new Uint8Array(buf);

            for (var i = 0; i < str.length; i++) {
                bufView[i] = str.charCodeAt(i);
            }

            self.mqttBridge.send(buf);
        }
    };

    this.connect();
    this.controller.devices.on('change:metrics:level', self.deviceUpdate);
};

