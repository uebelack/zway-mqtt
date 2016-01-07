var mqtt = require('mqtt');
var net = require('net');
var config = require('./config');

var mqttClient = mqtt.connect(config.mqtt);
var bridgeServer = net.createServer();
var bridgeClient = null;

mqttClient.on('connect', function () {
    mqttClient.subscribe(config.topic_prefix + '/#');
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
            var messages = dataStr.split(/\r?\n/);
            messages.forEach(function (messageStr) {
                if (messageStr.indexOf('}') > 0) {
                    var message = JSON.parse(messageStr);
                    if (message && message.payload) {
                        console.log("RECIEVED: " + messageStr)
                        mqttClient.publish(message.topic, message.payload.toString());
                    }
                }
            });
        }
    });
});


bridgeServer.listen(config.port);