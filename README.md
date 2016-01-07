ZWay MQTT Bridge 
=========

A simple nodejs app to bridge ZWay to a MQTT broker. 

## Quickstart

The bridge consist of two modules:

+ Z-Way module called ZWayMqttBridge, which exposes a socket on the zway server to access events and change states
+ The node script, which connects to the zway server and the mqtt broker


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

