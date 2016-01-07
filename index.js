var mqtt = require('mqtt');
var net = require('net');

var mqttClient = mqtt.connect('mqtt://192.168.0.210');
var bridgeServer = net.createServer();
var bridgeClient = null;

mqttClient.on('connect', function () {
    mqttClient.subscribe('halti/#');
});

mqttClient.on('message', function (topic, payload) {
    if (topic.indexOf('/set', topic.length - '/set'.length) !== -1 && bridgeClient) {
        var message = JSON.stringify({topic: topic, payload: payload.toString()});
        console.log("SENDING: " + message)
        bridgeClient.write(message);
    }
});

bridgeServer.on('connection', function (socket) {
    bridgeClient = socket;
    console.log("Client connected!")
    bridgeClient.write('HELLO')
    bridgeClient.on('data', function (data) {
        var dataStr = data.toString();
        if (dataStr.indexOf('}') > 0) {
            var messages = dataStr.split('}');
            messages.forEach(function (messageStr) {
                var message = JSON.parse(messageStr);
                if (message && message.payload) {
                    console.log("RECIEVED: " + data.toString())
                    mqttClient.publish(message.topic, message.payload.toString());
                }
            });
        }

    });
});


bridgeServer.listen(8080);