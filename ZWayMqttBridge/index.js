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

    console.log('ZWayMqttBridge: will open socket ...');
    var self = this;

    var socket = new sockets.tcp();
    socket.reusable();
    socket.bind(8888);
    socket.onrecv = function(data) {
        console.log('ZWayMqttBridge: client connected!');
        self.client = this;
    }

    socket.onclose = function(data) {
        console.log('ZWayMqttBridge: client disconnected!');
        self.client = null;
    }

    socket.listen();

    console.log('ZWayMqttBridge: listening on port 8888');

    this.deviceUpdate = function (device) {
        if (self.client) {
            self.client.send(JSON.stringify(device, null, 4));
        }
    };

    this.controller.devices.on('change:metrics:level', self.deviceUpdate);
};

