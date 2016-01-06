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

    this.deviceUpdate = function (device) {
        if (!self.mqttBridge) {
            console.log('Connecting to Mqtt Bridge...');
            self.mqttBridge = new sockets.websocket('ws://192.168.0.62:8080');

            self.mqttBridge.onopen = function () {
                console.log('Mqtt Bridge websocket connected!');
            };

            self.mqttBridge.onmessage = function (ev) {
                console.log('got data:' + ev.data);
            };

            self.mqttBridge.onclose = function () {
                console.log('Mqtt Bridge websocket was closed!');
                self.mqttBridge = null;
            };

            self.mqttBridge.onerror = function (ev) {
                console.log('Mqtt Bridge websocket error: ' + ev.data);
            };
        }

        if (self.mqttBridge) {
            self.mqttBridge.send(JSON.stringify(device, null, 4));
        }
    };

    this.controller.devices.on('change:metrics:level', self.deviceUpdate);
};

ZWayMqttBridge.prototype.stop = function () {

};