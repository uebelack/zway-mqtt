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

    console.log(JSON.stringify(zway, null, 4));

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
            console.log('Mqtt Bridge server:' + String.fromCharCode.apply(null, new Uint8Array(data)));
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
            console.log('Mqtt Bridge: Sending update to Client...')

            var message = {
                topic: device.metrics.title,
                payload: device.metrics.level
            }

            var str = JSON.stringify(device, null, 4);

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

