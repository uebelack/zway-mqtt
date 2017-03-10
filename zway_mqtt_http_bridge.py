import traceback
import tornado.web
import tornado.ioloop
import paho.mqtt.client as mqtt
import json
import socket
import time
import requests
import os
import sys
import thread


class ZwayMqttHttpBride:
    config = None
    api_url = 'http://localhost:8083/ZAutomation/api/v1'
    api_sid = None
    api_devices = None
    api_values = {}
    mqtt_connected = False
    mqtt_client = None
    mqtt_qos_publish = 0
    mqtt_qos_subscribe = 0
    mqtt_retain = False

    def mqtt_connect(self):
        if self.mqtt_broker_reachable():
            self.verbose('Connecting to ' + self.config['mqtt_host'] + ':' + self.config['mqtt_port'])
            self.mqtt_client = mqtt.Client(self.config['mqtt_client_id'], clean_session=False)
            if 'mqtt_user' in self.config and 'mqtt_password' in self.config:
                self.mqtt_client.username_pw_set(self.config['mqtt_user'], self.config['mqtt_password'])
            self.mqtt_client.on_connect = self.mqtt_on_connect
            self.mqtt_client.on_disconnect = self.mqtt_on_disconnect
            self.mqtt_client.on_disconnect = self.mqtt_on_disconnect
            self.mqtt_client.on_message = self.mqtt_on_message

            try:
                self.mqtt_client.connect(self.config['mqtt_host'], int(self.config['mqtt_port']), 10)
                self.mqtt_client.subscribe(self.config['mqtt_topic_prefix'] + '/#', self.mqtt_qos_subscribe)
                self.mqtt_client.loop_start()
            except:
                self.error(traceback.format_exc())
                self.mqtt_client = None
        else:
            self.error(self.config['mqtt_host'] + ':' + self.config['mqtt_port'] + ' not reachable!')

    def mqtt_on_connect(self, mqtt_client, userdata, flags, rc):
        self.mqtt_connected = True
        self.verbose('...mqtt_connected!')

    def mqtt_on_disconnect(self, mqtt_client, userdata, rc):
        self.mqtt_connected = False
        self.verbose('Diconnected! will reconnect! ...')
        if rc is 0:
            self.mqtt_connect()
        else:
            time.sleep(5)
            while not self.mqtt_broker_reachable():
                time.sleep(10)
            self.mqtt_client.reconnect()

    def mqtt_on_message(self, client, userdata, message):
        self.verbose(message.topic)
        if self.api_devices and message.topic in self.api_devices:
            self.api_values[message.topic] = str(message.payload)
        else:
            if self.api_sid and self.api_devices:
                topic, action = os.path.split(message.topic)
                if topic in self.api_devices:
                    if action == 'set':
                        self.api_update_device(self.api_devices[topic], str(message.payload))
                    elif action == 'toggle' and topic:
                        value = 'on' if topic in self.api_values and self.api_values[topic] == 'off' else 'off'
                        self.api_update_device(self.api_devices[topic], value)

    def api_update_device(self, device_id, value):
        url = self.api_url + '/devices/' + device_id + '/command/'
        if value.isdigit():
            url += 'exact?level='
        url += value.lower()
        response = requests.get(url, headers={'ZWAYSession': self.api_sid})
        if response.status_code == 200:
            self.verbose('did update device: ' + url)
        elif response.status_code == 403:
            self.api_login()
            self.api_update_device(device_id, value)
        else:
            self.error('could not update device: ' + url + '\n' + response.text)

    def config_update(self, config):
        self.config = config
        self.mqtt_qos_publish = int(self.config['mqtt_qos_publish']) if 'mqtt_qos_publish' in config else 0
        self.mqtt_qos_subscribe = int(self.config['mqtt_qos_subscribe']) if 'mqtt_qos_subscribe' in config else 0
        self.mqtt_retain = 'mqtt_retain' in config and self.config['mqtt_retain']
        if 'api_url' in config:
            self.api_url = config['api_url']

        thread.start_new_thread(self.api_login, ())
        if self.mqtt_client:
            self.mqtt_client.disconnect()
        else:
            self.mqtt_connect()

    def device_update(self, message):
        if self.mqtt_connected:
            self.mqtt_client.publish(message['topic'], payload=message['value'], qos=self.mqtt_qos_publish,
                                     retain=self.mqtt_retain)

    def mqtt_broker_reachable(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        try:
            s.connect((self.config['mqtt_host'], int(self.config['mqtt_port'])))
            s.close()
            return True
        except socket.error:
            return False

    def start(self):
        tornado.web.Application([
            (r"/update", DeviceHandler, {'bridge': self}),
            (r"/config", ConfigHandler, {'bridge': self})]).listen(34254, '127.0.0.1')
        tornado.ioloop.IOLoop.current().start()

    def api_login(self):
        if self.config and 'zway_user' in self.config and 'zway_user' in self.config:
            response = requests.post(self.api_url + '/login',
                                     {'login': self.config['zway_user'], "password": self.config['zway_password']})
            if response.status_code == 200:
                self.api_sid = response.json()['data']['sid']
                self.verbose('logged in to zwave api, got sid:' + self.api_sid)
                self.refresh_devices()
            else:
                self.api_sid = None
                self.error('could not login ' + self.api_url + '/login: \n' + response.text)

    def refresh_devices(self):
        if self.api_sid:
            response = requests.get(self.api_url + '/locations', headers={'ZWAYSession': self.api_sid})
            if response.status_code == 200:
                devices = {}
                for room in response.json()['data']:
                    if 'namespaces' in room:
                        for namespace in room['namespaces']:
                            if 'id' in namespace and 'devices_all' == namespace['id']:
                                for device in namespace['params']:
                                    devices[self.config['mqtt_topic_prefix'] + '/' + room['title'] + '/' + device[
                                        'deviceName']] = device['deviceId']
                self.api_devices = devices
                self.verbose('refreshed devices:' + json.dumps(self.api_devices, indent=2))
                response = requests.get(self.api_url + '/devices', headers={'ZWAYSession': self.api_sid})
                if response.status_code == 200:
                    for device in response.json()['data']['devices']:
                        if device['id'] in self.api_devices.values():
                            topic = self.api_devices.keys()[self.api_devices.values().index(device['id'])]
                            self.api_values[topic] = device['metrics']['level']
                else:
                    self.error('could not refresh devices ' + self.api_url + '/devices: \n' + response.text)
            else:
                self.api_devices = None
                self.error('could not refresh devices ' + self.api_url + '/locations: \n' + response.text)

    def verbose(self, message):
        if not self.config or 'verbose' not in self.config or self.config['verbose']:
            sys.stdout.write('VERBOSE: ' + message + '\n')
            sys.stdout.flush()

    def error(self, message):
        sys.stderr.write('ERROR: ' + message + '\n')
        sys.stderr.flush()


class ConfigHandler(tornado.web.RequestHandler):
    def initialize(self, bridge):
        self.bridge = bridge

    def post(self):
        try:
            self.bridge.config_update(json.loads(self.request.body))
        except:
            self.bridge.error(traceback.format_exc())


class DeviceHandler(tornado.web.RequestHandler):
    def initialize(self, bridge):
        self.bridge = bridge

    def post(self):
        try:
            self.bridge.device_update(json.loads(self.request.body))
        except:
            self.bridge.error(traceback.format_exc())


if __name__ == "__main__":
    ZwayMqttHttpBride().start()
