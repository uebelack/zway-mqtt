MQTT module for Z-Way  
============================================

MQTT module for Z-Way Home Automation engine. 

+ Publishes all device events to a MQTT broker
+ Devices can be controlled with MQTT messages


### Installation (on RaZberry)
    
    git clone git@github.com:goodfield/zway-mqtt.git /opt/z-way-server/automation/modules/MQTT
    /etc/init.d/z-way-server restart
    
Access Z-Way Home Automation web application and activate/configure MQTT module

### Usage
The topics for the devices are defined as following:

    [Topic Prefix]/[Room]/[Device Name]
    (e.g: myhome/Living/Light1)

Devices can be controlled by adding following suffixes to the topic:

+ status: get the current status of a device (no payload)
(e.g.: myhome/Living/Light1/status)
+ set: change the value of a device (on|off as payload) 
(e.g.: myhome/Living/Light1/set on)



