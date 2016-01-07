ZWay MQTT Bridge 
=========

A simple nodejs app to bridge ZWay to a MQTT broker. 

## Quickstart

The bridge consist of two modules:

+ The node script, which connects exposes a socket for the zway server and connects to the mqtt broker
+ Z-Way module called ZWayMqttBridge, which connects to the zway-mqtt socket to pubish and consume events


### Installation
    git clone git@github.com:goodfield/zway-mqtt.git
    cd zway-mqtt
    cp -r ZWayMqttBridge /opt/z-way-server/automation/modules
    npm install
    
### Configuration
In zway-mqtt directory create **config.js**:
 
    var config = {}
    config.port = 8080;
    config.topic_prefix = 'zway';
    config.mqtt = {
      host: '192.168.0.250',
      port: 1883,
      username: 'user',
      password: 'password'
    };   
    module.exports = config;

In z-way Web application activate and configure ZWayMqttBridge App.

### Start
In the zway-mqtt directory:

    node index.js

