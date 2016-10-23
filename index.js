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
    executeFile(this.moduleBasePath() + "/lib/buffer.js");
    executeFile(this.moduleBasePath() + "/lib/mqtt.js");

    MQTT.super_.prototype.init.call(this, config);
    console.log('MQTT: starting...');

    var self = this;
    this.config = config;

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
        if (self.mqttClient && self.mqttClient.connected) {
            var topic = self.createTopic(device);
            var value = device.get('metrics:level');

            if (self.status[topic] === undefined) {
                self.status[topic] = 0;
            }

            var status = ++self.status[topic];

            setTimeout(function () {
                if (self.status[topic] === status) {
                    self.verbose('publishing: ' + topic + ': ' + value + ' [retain: ' + self.config.retain + ']');
                    self.mqttClient.publish(topic, value.toString().trim(), {retain: self.config.retain});
                    self.status[topic] = 0;
                } else {
                    self.verbose('not publishing: ' + topic + ': ' + value + ' [status: ' + status + ', last status:' + self.status[topic] + ' ]');
                }
            }, 200);
        }
    };

    this.connect = function () {
        this.mqttClient = new MQTTClient(self.config.host, parseInt(self.config.port), {client_id: config.client_id});
        self.log('Connecting to ' + self.config.host + ':' + self.config.port + '...');
        this.mqttClient.connect(function () {

            self.log('Connected to ' + self.config.host + ':' + self.config.port);

            self.mqttClient.onError(function (error) {
                self.log(error.toString());
                if (error.toString().indexOf('Timeout') !== -1) {
                    self.connect();
                } else if (error.toString().indexOf('Unknow Error') !== -1) {
                    var match = /Unknow Error: #([\d]+)/.exec(error.toString());
                    var errorCode = parseInt(match[1]);
                    if (errorCode >= 100) {
                        self.connect();
                    }
                } else if (error.toString().indexOf('Please connect to server first') !== -1) {
                    self.connect();
                }
            });

            self.mqttClient.onDisconnect(function () {
                self.log('Error: disconnected, will retry to connect...');
                self.connect();
            });

            self.mqttClient.subscribe(self.config.topic_prefix + '/#', {}, function (topic, payload) {
                self.verbose('subscription: ' + topic + ': ' + payload);
                self.controller.devices.filter(function (device) {
                    var device_topic = self.createTopic(device);
                    return device_topic + '/' + 'set' == topic
                        || device_topic + '/' + 'status' == topic
                        || device_topic + '/' + 'toggle' == topic;
                }).map(function (device) {
                    var device_topic = self.createTopic(device);
                    if (topic == device_topic + '/status') {
                        self.deviceUpdate(device);
                    } else if (topic == device_topic + '/toggle') {
                        var value = device.get('metrics:level').toString().trim();
                        if (value === 'on') {
                            device.performCommand('off');
                        } else {
                            device.performCommand('on');
                        }
                    } else {
                        if (device.get('deviceType') === 'switchMultilevel') {
                            if (payload !== 'on' && payload !== 'off') {
                                device.performCommand('exact', {level: payload});
                            } else {
                                device.performCommand(payload);
                            }
                        }
                        else {
                            device.performCommand(payload);
                        }

                    }
                });
            });
        });
    };

    if (!self.config.host || !self.config.port) {
        this.log('Host or port not configured! will not start!')
    } else {
        this.connect();
        this.controller.devices.on('change:metrics:level', self.deviceUpdate);
    }
};

