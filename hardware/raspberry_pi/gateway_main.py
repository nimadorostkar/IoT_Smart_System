#!/usr/bin/env python3
"""
IoT Smart System - Raspberry Pi Gateway
=======================================

این سکریپت وظایف زیر را انجام می‌دهد:
- مدیریت شبکه محلی Zigbee/Z-Wave
- پردازش و فوروارد ویدیو
- پردازش AI برای تشخیص
- پل ارتباطی به cloud
- مدیریت محلی دستگاه‌ها

نویسنده: تیم توسعه IoT
نسخه: 1.0.0
"""

import asyncio
import json
import logging
import time
import signal
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# کتابخانه‌های اصلی
import numpy as np
import cv2
import paho.mqtt.client as mqtt
import redis
import sqlite3
from flask import Flask, request, jsonify, render_template
from flask_socketio import SocketIO, emit
from threading import Thread, Lock
import subprocess
import RPi.GPIO as GPIO

# کتابخانه‌های تخصصی
try:
    import tensorflow as tf
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    logging.warning("TensorFlow not available - AI features disabled")

# تنظیمات
CONFIG = {
    'mqtt': {
        'broker': 'localhost',
        'port': 1883,
        'topics': {
            'devices': 'devices/+/data',
            'commands': 'gateway/commands',
            'status': 'gateway/status'
        }
    },
    'video': {
        'rtsp_port': 8554,
        'webrtc_port': 8000,
        'recording_path': '/opt/iot_system/recordings'
    },
    'ai': {
        'model_path': '/opt/iot_system/models/detection_model.tflite',
        'confidence_threshold': 0.7
    },
    'gpio': {
        'status_led': 18,
        'alarm_buzzer': 19,
        'reset_button': 21
    }
}

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/iot_gateway.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('IoTGateway')

class IoTGateway:
    """کلاس اصلی Gateway که تمام عملیات را مدیریت می‌کند"""
    
    def __init__(self):
        self.running = False
        self.devices = {}
        self.video_streams = {}
        self.ai_processor = None
        self.data_lock = Lock()
        
        # Setup components
        self.setup_gpio()
        self.setup_database()
        self.setup_mqtt()
        self.setup_redis()
        self.setup_flask()
        
        if AI_AVAILABLE:
            self.setup_ai()
            
        logger.info("IoT Gateway initialized successfully")
    
    def setup_gpio(self):
        """راه‌اندازی GPIO برای LED ها و دکمه‌ها"""
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(CONFIG['gpio']['status_led'], GPIO.OUT)
        GPIO.setup(CONFIG['gpio']['alarm_buzzer'], GPIO.OUT)
        GPIO.setup(CONFIG['gpio']['reset_button'], GPIO.IN, pull_up_down=GPIO.PUD_UP)
        
        # LED خاموش
        GPIO.output(CONFIG['gpio']['status_led'], GPIO.LOW)
        GPIO.output(CONFIG['gpio']['alarm_buzzer'], GPIO.LOW)
        
        logger.info("GPIO setup completed")
    
    def setup_database(self):
        """راه‌اندازی SQLite برای ذخیره محلی داده‌ها"""
        db_path = Path('/opt/iot_system/data/local.db')
        db_path.parent.mkdir(parents=True, exist_ok=True)
        
        self.db = sqlite3.connect(str(db_path), check_same_thread=False)
        
        # ایجاد جداول
        self.db.execute('''
            CREATE TABLE IF NOT EXISTS sensor_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                temperature REAL,
                humidity REAL,
                pressure REAL,
                light_level REAL,
                motion BOOLEAN,
                data_json TEXT
            )
        ''')
        
        self.db.execute('''
            CREATE TABLE IF NOT EXISTS device_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                data_json TEXT
            )
        ''')
        
        self.db.commit()
        logger.info("Database setup completed")
    
    def setup_mqtt(self):
        """راه‌اندازی MQTT client"""
        self.mqtt_client = mqtt.Client()
        self.mqtt_client.on_connect = self.on_mqtt_connect
        self.mqtt_client.on_message = self.on_mqtt_message
        self.mqtt_client.on_disconnect = self.on_mqtt_disconnect
        
        try:
            self.mqtt_client.connect(CONFIG['mqtt']['broker'], CONFIG['mqtt']['port'], 60)
            self.mqtt_client.loop_start()
            logger.info("MQTT client connected")
        except Exception as e:
            logger.error(f"MQTT connection failed: {e}")
    
    def setup_redis(self):
        """راه‌اندازی Redis برای cache"""
        try:
            self.redis_client = redis.Redis(host='localhost', port=6379, db=0)
            self.redis_client.ping()
            logger.info("Redis connected")
        except Exception as e:
            logger.error(f"Redis connection failed: {e}")
            self.redis_client = None
    
    def setup_flask(self):
        """راه‌اندازی Flask web server"""
        self.app = Flask(__name__)
        self.app.config['SECRET_KEY'] = 'iot_gateway_secret_key'
        self.socketio = SocketIO(self.app, cors_allowed_origins="*")
        
        self.setup_routes()
        logger.info("Flask web server setup completed")
    
    def setup_ai(self):
        """راه‌اندازی AI model برای تشخیص اشیاء"""
        try:
            model_path = CONFIG['ai']['model_path']
            if Path(model_path).exists():
                self.ai_processor = AIProcessor(model_path)
                logger.info("AI processor initialized")
            else:
                logger.warning("AI model not found")
        except Exception as e:
            logger.error(f"AI setup failed: {e}")
    
    def setup_routes(self):
        """تعریف route های Flask"""
        
        @self.app.route('/')
        def dashboard():
            """صفحه اصلی داشبورد"""
            return render_template('dashboard.html', devices=self.devices)
        
        @self.app.route('/api/devices')
        def get_devices():
            """لیست دستگاه‌های متصل"""
            with self.data_lock:
                return jsonify(list(self.devices.values()))
        
        @self.app.route('/api/device/<device_id>/data')
        def get_device_data(device_id):
            """آخرین داده‌های یک دستگاه"""
            if device_id in self.devices:
                return jsonify(self.devices[device_id])
            return jsonify({'error': 'Device not found'}), 404
        
        @self.app.route('/api/device/<device_id>/command', methods=['POST'])
        def send_command(device_id):
            """ارسال دستور به دستگاه"""
            command = request.json
            topic = f"devices/{device_id}/commands"
            
            self.mqtt_client.publish(topic, json.dumps(command))
            return jsonify({'status': 'sent'})
        
        @self.app.route('/api/statistics')
        def get_statistics():
            """آمار کلی سیستم"""
            stats = {
                'total_devices': len(self.devices),
                'online_devices': sum(1 for d in self.devices.values() 
                                    if d.get('last_seen', 0) > time.time() - 300),
                'total_sensors': sum(len(d.get('sensors', [])) 
                                   for d in self.devices.values()),
                'uptime': time.time() - self.start_time if hasattr(self, 'start_time') else 0
            }
            return jsonify(stats)
        
        @self.socketio.on('connect')
        def handle_connect():
            """اتصال WebSocket جدید"""
            emit('status', {'message': 'Connected to IoT Gateway'})
        
        @self.socketio.on('subscribe_device')
        def handle_subscribe(data):
            """subscribe به یک دستگاه خاص"""
            device_id = data.get('device_id')
            if device_id:
                # اضافه کردن کلاینت به room مخصوص device
                # برای real-time updates
                pass
    
    def on_mqtt_connect(self, client, userdata, flags, rc):
        """callback اتصال MQTT"""
        if rc == 0:
            logger.info("MQTT connected successfully")
            # Subscribe به topics
            client.subscribe(CONFIG['mqtt']['topics']['devices'])
            client.subscribe(CONFIG['mqtt']['topics']['commands'])
            
            # اعلام آنلاین بودن gateway
            self.publish_gateway_status('online')
            
            # چراغ وضعیت روشن
            GPIO.output(CONFIG['gpio']['status_led'], GPIO.HIGH)
        else:
            logger.error(f"MQTT connection failed with code {rc}")
    
    def on_mqtt_message(self, client, userdata, msg):
        """پردازش پیام‌های MQTT"""
        try:
            topic = msg.topic
            payload = json.loads(msg.payload.decode())
            
            logger.debug(f"Received: {topic} = {payload}")
            
            if 'devices/' in topic and '/data' in topic:
                # داده سنسور جدید
                device_id = topic.split('/')[1]
                self.process_sensor_data(device_id, payload)
                
            elif topic == CONFIG['mqtt']['topics']['commands']:
                # دستور برای gateway
                self.process_gateway_command(payload)
                
        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")
    
    def on_mqtt_disconnect(self, client, userdata, rc):
        """callback قطع اتصال MQTT"""
        logger.warning("MQTT disconnected")
        GPIO.output(CONFIG['gpio']['status_led'], GPIO.LOW)
    
    def process_sensor_data(self, device_id: str, data: Dict):
        """پردازش داده‌های سنسور"""
        with self.data_lock:
            # به‌روزرسانی اطلاعات دستگاه
            if device_id not in self.devices:
                self.devices[device_id] = {
                    'id': device_id,
                    'first_seen': time.time(),
                    'sensors': []
                }
            
            self.devices[device_id].update({
                'last_seen': time.time(),
                'last_data': data,
                'temperature': data.get('temperature'),
                'humidity': data.get('humidity'),
                'motion': data.get('motion'),
                'battery': data.get('battery')
            })
        
        # ذخیره در دیتابیس محلی
        self.save_sensor_data(device_id, data)
        
        # ارسال به clients متصل
        self.socketio.emit('sensor_data', {
            'device_id': device_id,
            'data': data
        }, room='dashboard')
        
        # بررسی alarm ها
        self.check_alarms(device_id, data)
        
        # فوروارد به cloud (اختیاری)
        if self.redis_client:
            key = f"device:{device_id}:latest"
            self.redis_client.setex(key, 3600, json.dumps(data))
    
    def save_sensor_data(self, device_id: str, data: Dict):
        """ذخیره داده در SQLite"""
        try:
            self.db.execute('''
                INSERT INTO sensor_data 
                (device_id, timestamp, temperature, humidity, pressure, light_level, motion, data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                device_id,
                data.get('timestamp', int(time.time())),
                data.get('temperature'),
                data.get('humidity'),
                data.get('pressure'),
                data.get('light_level'),
                data.get('motion'),
                json.dumps(data)
            ))
            self.db.commit()
        except Exception as e:
            logger.error(f"Database save error: {e}")
    
    def check_alarms(self, device_id: str, data: Dict):
        """بررسی شرایط alarm"""
        alerts = []
        
        # بررسی دما
        temp = data.get('temperature')
        if temp and (temp > 35 or temp < -5):
            alerts.append(f"Temperature alert: {temp}°C")
        
        # بررسی رطوبت
        humidity = data.get('humidity')
        if humidity and (humidity > 80 or humidity < 20):
            alerts.append(f"Humidity alert: {humidity}%")
        
        # بررسی motion
        if data.get('motion'):
            alerts.append("Motion detected")
        
        # بررسی سطح باتری
        battery = data.get('battery')
        if battery and battery < 20:
            alerts.append(f"Low battery: {battery}%")
        
        # ارسال alert ها
        for alert in alerts:
            self.send_alert(device_id, alert)
    
    def send_alert(self, device_id: str, message: str):
        """ارسال هشدار"""
        alert_data = {
            'device_id': device_id,
            'message': message,
            'timestamp': time.time(),
            'level': 'warning'
        }
        
        # ذخیره event
        self.db.execute('''
            INSERT INTO device_events (device_id, event_type, timestamp, data_json)
            VALUES (?, ?, ?, ?)
        ''', (device_id, 'alert', int(time.time()), json.dumps(alert_data)))
        self.db.commit()
        
        # ارسال به clients
        self.socketio.emit('alert', alert_data)
        
        # فعال‌سازی buzzer (اختیاری)
        self.activate_buzzer(1)
        
        logger.warning(f"Alert: {device_id} - {message}")
    
    def activate_buzzer(self, duration: float):
        """فعال‌سازی buzzer برای مدت معین"""
        def buzzer_thread():
            GPIO.output(CONFIG['gpio']['alarm_buzzer'], GPIO.HIGH)
            time.sleep(duration)
            GPIO.output(CONFIG['gpio']['alarm_buzzer'], GPIO.LOW)
        
        Thread(target=buzzer_thread, daemon=True).start()
    
    def process_gateway_command(self, command: Dict):
        """پردازش دستورات gateway"""
        cmd_type = command.get('command')
        
        if cmd_type == 'restart':
            logger.info("Gateway restart requested")
            self.shutdown()
            subprocess.run(['sudo', 'reboot'])
            
        elif cmd_type == 'update_firmware':
            logger.info("Firmware update requested")
            self.update_firmware()
            
        elif cmd_type == 'scan_devices':
            logger.info("Device scan requested")
            self.scan_devices()
            
        elif cmd_type == 'backup_data':
            logger.info("Data backup requested")
            self.backup_data()
    
    def publish_gateway_status(self, status: str):
        """انتشار وضعیت gateway"""
        status_data = {
            'status': status,
            'timestamp': time.time(),
            'uptime': time.time() - self.start_time if hasattr(self, 'start_time') else 0,
            'devices_count': len(self.devices),
            'version': '1.0.0'
        }
        
        topic = CONFIG['mqtt']['topics']['status']
        self.mqtt_client.publish(topic, json.dumps(status_data))
    
    def scan_devices(self):
        """اسکن شبکه برای یافتن دستگاه‌های جدید"""
        # پیاده‌سازی اسکن Zigbee/Z-Wave
        logger.info("Scanning for new devices...")
        # این بخش بستگی به hardware مورد استفاده دارد
    
    def backup_data(self):
        """پشتیبان‌گیری از داده‌ها"""
        backup_path = f"/opt/iot_system/backups/backup_{int(time.time())}.db"
        Path(backup_path).parent.mkdir(parents=True, exist_ok=True)
        
        # کپی فایل دیتابیس
        subprocess.run(['cp', '/opt/iot_system/data/local.db', backup_path])
        logger.info(f"Data backup created: {backup_path}")
    
    def start_video_streaming(self):
        """شروع video streaming server"""
        try:
            # راه‌اندازی RTSP server برای دوربین‌ها
            cmd = [
                'gst-launch-1.0',
                'rtspsrc', f'location=rtsp://admin:password@192.168.1.100:554/stream',
                '!', 'decodebin',
                '!', 'videoconvert',
                '!', 'x264enc',
                '!', 'rtph264pay',
                '!', 'udpsink', f'host=0.0.0.0', f'port={CONFIG["video"]["rtsp_port"]}'
            ]
            
            self.video_process = subprocess.Popen(cmd)
            logger.info("Video streaming started")
            
        except Exception as e:
            logger.error(f"Video streaming failed: {e}")
    
    def run(self):
        """اجرای اصلی gateway"""
        self.running = True
        self.start_time = time.time()
        
        logger.info("IoT Gateway starting...")
        
        # شروع video streaming
        self.start_video_streaming()
        
        # اجرای Flask server در thread جداگانه
        def flask_thread():
            self.socketio.run(self.app, host='0.0.0.0', port=5000, debug=False)
        
        Thread(target=flask_thread, daemon=True).start()
        
        # حلقه اصلی
        try:
            while self.running:
                # بررسی وضعیت دستگاه‌ها
                self.check_device_health()
                
                # ارسال heartbeat
                self.publish_gateway_status('online')
                
                # بررسی دکمه reset
                if GPIO.input(CONFIG['gpio']['reset_button']) == GPIO.LOW:
                    logger.info("Reset button pressed")
                    time.sleep(3)  # انتظار برای اطمینان
                    if GPIO.input(CONFIG['gpio']['reset_button']) == GPIO.LOW:
                        self.factory_reset()
                
                time.sleep(30)  # هر 30 ثانیه
                
        except KeyboardInterrupt:
            logger.info("Shutdown requested")
        finally:
            self.shutdown()
    
    def check_device_health(self):
        """بررسی سلامت دستگاه‌ها"""
        current_time = time.time()
        offline_devices = []
        
        with self.data_lock:
            for device_id, device_info in self.devices.items():
                last_seen = device_info.get('last_seen', 0)
                if current_time - last_seen > 300:  # 5 دقیقه
                    offline_devices.append(device_id)
        
        for device_id in offline_devices:
            logger.warning(f"Device {device_id} appears offline")
            # ارسال اعلان offline
            self.send_alert(device_id, "Device offline")
    
    def factory_reset(self):
        """بازگشت به تنظیمات کارخانه"""
        logger.info("Factory reset initiated")
        
        # پاک کردن دیتابیس
        self.db.execute('DELETE FROM sensor_data')
        self.db.execute('DELETE FROM device_events')
        self.db.commit()
        
        # پاک کردن Redis cache
        if self.redis_client:
            self.redis_client.flushdb()
        
        logger.info("Factory reset completed")
        
        # restart سیستم
        subprocess.run(['sudo', 'reboot'])
    
    def shutdown(self):
        """خاموش کردن gateway"""
        logger.info("Gateway shutting down...")
        self.running = False
        
        # قطع اتصال MQTT
        if hasattr(self, 'mqtt_client'):
            self.publish_gateway_status('offline')
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
        
        # بستن دیتابیس
        if hasattr(self, 'db'):
            self.db.close()
        
        # خاموش کردن GPIO
        GPIO.output(CONFIG['gpio']['status_led'], GPIO.LOW)
        GPIO.output(CONFIG['gpio']['alarm_buzzer'], GPIO.LOW)
        GPIO.cleanup()
        
        # قطع video streaming
        if hasattr(self, 'video_process'):
            self.video_process.terminate()
        
        logger.info("Gateway shutdown complete")


class AIProcessor:
    """پردازشگر AI برای تشخیص اشیاء در ویدیو"""
    
    def __init__(self, model_path: str):
        self.interpreter = tf.lite.Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()
        
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        
        logger.info("AI model loaded successfully")
    
    def detect_objects(self, frame: np.ndarray) -> List[Dict]:
        """تشخیص اشیاء در frame"""
        # پیش‌پردازش تصویر
        input_data = self.preprocess_frame(frame)
        
        # اجرای مدل
        self.interpreter.set_tensor(self.input_details[0]['index'], input_data)
        self.interpreter.invoke()
        
        # استخراج نتایج
        boxes = self.interpreter.get_tensor(self.output_details[0]['index'])
        classes = self.interpreter.get_tensor(self.output_details[1]['index'])
        scores = self.interpreter.get_tensor(self.output_details[2]['index'])
        
        # فیلتر کردن نتایج
        detections = []
        threshold = CONFIG['ai']['confidence_threshold']
        
        for i in range(len(scores[0])):
            if scores[0][i] > threshold:
                detections.append({
                    'class': int(classes[0][i]),
                    'confidence': float(scores[0][i]),
                    'bbox': boxes[0][i].tolist()
                })
        
        return detections
    
    def preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """پیش‌پردازش frame برای مدل"""
        # تغییر اندازه به اندازه ورودی مدل
        input_shape = self.input_details[0]['shape']
        resized = cv2.resize(frame, (input_shape[2], input_shape[1]))
        
        # نرمال‌سازی
        normalized = resized.astype(np.float32) / 255.0
        
        # اضافه کردن batch dimension
        input_data = np.expand_dims(normalized, axis=0)
        
        return input_data


def signal_handler(signum, frame):
    """مدیریت signal های سیستم"""
    logger.info(f"Received signal {signum}")
    if 'gateway' in globals():
        gateway.shutdown()
    sys.exit(0)


def main():
    """تابع اصلی"""
    # تنظیم signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # ایجاد و اجرای gateway
    global gateway
    gateway = IoTGateway()
    gateway.run()


if __name__ == '__main__':
    main()
