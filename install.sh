#!/bin/bash

if [ `whoami` != 'root' ]
    then echo "Please run as root/with sudo!"
    exit 1
fi

apt-get -y install supervisor python-dev python-pip git
pip install tornado
pip install paho-mqtt
pip install requests

if [ -d /opt/z-way-server/automation/modules/MQTT ]
then
    rm -rf /opt/z-way-server/automation/modules/MQTT
fi

cd /opt/z-way-server/automation/modules
git clone git@github.com:goodfield/zway-mqtt.git MQTT

cp /opt/z-way-server/automation/modules/MQTT/etc/supervisor.zway_mqtt_http_bridge.conf /etc/supervisor/conf.d/zway_mqtt_http_bridge.conf
update-rc.d supervisor defaults
service supervisor restart
/etc/init.d/z-way-server restart