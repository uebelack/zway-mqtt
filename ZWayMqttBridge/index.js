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
        if (self.mqttBridge) {
            self.mqttBridge.close()
            self.mqttBridge = null;
        }
        console.log('Will try to reconnect to Mqtt Bridge in 10 seconds ...');
        setTimeout(function () {
            console.log('Will try to reconnect to Mqtt Bridge ...');
            self.connect();
        }, 10000);
    }

    this.connect = function () {
        console.log('Connecting to Mqtt Bridge ....');
        this.mqttBridge = new sockets.websocket('ws://192.168.0.62:8080');

        setTimeout(function () {
            if (self.mqttBridge && !self.connected) {
                console.log('Could not connect to Mqtt Bridge after 5 seconds!');
                self.reconnect();
            }
        }, 5000);

        this.mqttBridge.onopen = function () {
            console.log('Mqtt Bridge websocket connected!');
            self.connected = true;
        };

        this.mqttBridge.onmessage = function (ev) {
            console.log('got data:' + ev.data);
        };

        this.mqttBridge.onclose = function () {
            console.log('Mqtt Bridge websocket was closed!');
            self.reconnect();
        };

        this.mqttBridge.onerror = function (ev) {
            console.log('Mqtt Bridge websocket error: ' + ev.data);
            self.reconnect();
        };
    }


    this.deviceUpdate = function (device) {
        if (self.mqttBridge) {
            self.mqttBridge.send(JSON.stringify(device, null, 4));
        }
    };

    this.connect();
    this.controller.devices.on('change:metrics:level', self.deviceUpdate);
};

