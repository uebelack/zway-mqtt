MQTT module for Z-Way  
============================================

MQTT module for Z-Way Home Automation engine. 

+ Publishes all device events to a MQTT broker
+ Devices can be controlled with MQTT messages

Unfortunately z-way's automation api makes it impossible to use a common mqtt client implementation, like MQTT.js. For
this reason, this modules contains an small python based webserver which communications with the z-way api via http.

Device level changes will directly pushed (not pulled!) via http to the python webserver and the webserver forwards the changes to the configured mqtt broker.

Mqtt messages to control the z-way devices will be forwarded from the web server to the z-way json api, also via http.

To give access to the z-way json api, the z-way credentials have to be provided in the configuration if this module.

### Dependencies
* supervisor, python-dev, python-pip (raspbian packages)
* tornado, paho-mqtt, requests (python modules)

Supervisor is used to daemonize the python webserver.

### Installation (on RaZberry)
    
    wget -q -O - https://git.io/vXItc | sudo bash

After the installation you have to activate and configure this module inside the Z-Way Home Automation web application.


### Usage
The topics for the devices are defined as following:

    [Topic Prefix]/[Room]/[Device Name]
    (e.g: myhome/Living/Light1)

Devices can be controlled by adding following suffixes to the topic:

+ status: get the current status of a device (no payload)
(e.g.: myhome/Living/Light1/status)
+ set: change the value of a device (on|off as payload) 
(e.g.: myhome/Living/Light1/set on)
+ toggle: toggle the value of a device (from on to off/off to on)
(e.g.: myhome/Living/Light1/toggle)



