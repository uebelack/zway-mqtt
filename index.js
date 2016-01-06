var mqtt = require('mqtt');
var net = require('net');

var mqttClient  = mqtt.connect('mqtt://192.168.0.210');
var bridgeServer = net.createServer();
var bridgeClient = null;


mqttClient.on('connect', function () {
    mqttClient.subscribe('halti/#');
});

mqttClient.on('message', function (topic, payload) {
    if (bridgeClient) {
        bridgeClient.write(JSON.stringify({topic: topic, payload: payload}));
    }
});

bridgeServer.on('connection', function(socket) {
    bridgeClient = socket;
    bridgeClient.write('Hello!')
    bridgeClient.on('data', function (data) {
        var message = JSON.parse(data.toString());
        if (message && message.payload) {
            mqttClient.publish(message.topic, message.payload.toString());
        }
    });
});


bridgeServer.listen(8080);