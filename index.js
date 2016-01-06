var mqtt = require('mqtt');
var net = require('net');

var client  = mqtt.connect('mqtt://192.168.0.210');
var server = net.createServer();


server.on('connection', function(socket) { //This is a standard net.Socket
    console.log('Got a client!');
    socket.write('ZWayMqttBridge\r\n');
    socket.on('data', function (data) {
        console.log(data.toString());
        var message = JSON.parse(data.toString());
        if (message && message.payload) {
            client.publish(message.topic, message.payload.toString());
        }
    });
});


server.listen(8080);