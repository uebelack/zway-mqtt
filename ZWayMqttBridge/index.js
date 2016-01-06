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

    this.reconnect = function () {
        self.connected = false;
        self.mqttBridge = null;
        console.log('Will try to reconnect to Mqtt Bridge in 10 seconds ...');
        setTimeout(function () {
            console.log('Will try to reconnect to Mqtt Bridge ...');
            self.connect();
        }, 10000);
    };

    this.connect = function () {
        console.log('Connecting to Mqtt Bridge ....');

        this.mqttBridge = new sockets.tcp();

        this.mqttBridge.onrecv = function (data) {
            console.log('Mqtt Bridge server:' + data);
            self.connected = true;
        };

        this.mqttBridge.onclose = function () {
            console.log('Mqtt Bridge websocket was closed!');
            self.reconnect();
        };

        if (this.mqttBridge.connect('192.168.0.62', 8080)) {
            setTimeout(function () {
                if (self.mqttBridge && !self.connected) {
                    console.log('Could not connect to Mqtt Bridge after 5 seconds!');
                    self.reconnect();
                }
            }, 5000);
        } else {
            console.log('Could not connect to Mqtt Bridge!');
            self.reconnect();
        }
    };

    this.deviceUpdate = function (device) {
        if (self.mqttBridge) {
            self.mqttBridge.send(JSON.stringify(device, null, 4));
        }
    };

    this.connect();
    this.controller.devices.on('change:metrics:level', self.deviceUpdate);
};

