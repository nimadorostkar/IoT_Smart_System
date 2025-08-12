/**
 * MQTT Service - مدیریت ارتباطات MQTT
 * =====================================
 * 
 * این سرویس وظایف زیر را انجام می‌دهد:
 * - اتصال به MQTT Broker
 * - مدیریت topic های subscribe/publish
 * - پردازش پیام‌های دریافتی از دستگاه‌ها
 * - ارسال دستورات به دستگاه‌ها
 * - مدیریت QoS و retain messages
 */

const mqtt = require('mqtt');
const EventEmitter = require('events');
const logger = require('../utils/logger');
const deviceService = require('./deviceService');
const alertService = require('./alertService');
const { Device } = require('../models/Device');
const { SensorData } = require('../models/SensorData');

class MQTTService extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.connected = false;
        this.io = null;
        this.subscriptions = new Map();
        this.lastWillTopic = 'system/gateway/lastwill';
        
        // MQTT configuration
        this.config = {
            broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
            username: process.env.MQTT_USERNAME || 'iot_server',
            password: process.env.MQTT_PASSWORD || 'secure_password',
            clientId: `iot_backend_${Date.now()}`,
            keepalive: 60,
            reconnectPeriod: 5000,
            connectTimeout: 30000,
            will: {
                topic: this.lastWillTopic,
                payload: JSON.stringify({
                    status: 'offline',
                    timestamp: new Date().toISOString(),
                    service: 'backend'
                }),
                qos: 1,
                retain: true
            }
        };

        // Topic patterns
        this.topics = {
            deviceData: 'devices/+/data',
            deviceHeartbeat: 'devices/+/heartbeat',
            deviceEvents: 'devices/+/events',
            deviceResponse: 'devices/+/response',
            gatewayStatus: 'gateway/+/status',
            systemCommands: 'system/commands',
            systemStatus: 'system/status'
        };
    }

    /**
     * راه‌اندازی اولیه MQTT service
     */
    async initialize(socketIo) {
        this.io = socketIo;
        
        try {
            await this.connect();
            this.setupEventHandlers();
            await this.subscribeToTopics();
            logger.info('MQTT Service initialized successfully');
        } catch (error) {
            logger.error('MQTT Service initialization failed:', error);
            throw error;
        }
    }

    /**
     * اتصال به MQTT Broker
     */
    async connect() {
        return new Promise((resolve, reject) => {
            if (this.client) {
                this.client.end(true);
            }

            logger.info(`Connecting to MQTT broker: ${this.config.broker}`);
            
            this.client = mqtt.connect(this.config.broker, {
                clientId: this.config.clientId,
                username: this.config.username,
                password: this.config.password,
                keepalive: this.config.keepalive,
                reconnectPeriod: this.config.reconnectPeriod,
                connectTimeout: this.config.connectTimeout,
                will: this.config.will,
                clean: true
            });

            this.client.on('connect', () => {
                this.connected = true;
                logger.info('MQTT Connected successfully');
                
                // ارسال پیام آنلاین بودن
                this.publishSystemStatus('online');
                
                resolve();
            });

            this.client.on('error', (error) => {
                logger.error('MQTT Connection error:', error);
                reject(error);
            });

            this.client.on('reconnect', () => {
                logger.info('MQTT Reconnecting...');
            });

            this.client.on('close', () => {
                this.connected = false;
                logger.warn('MQTT Connection closed');
            });

            this.client.on('offline', () => {
                this.connected = false;
                logger.warn('MQTT Client offline');
            });

            // Timeout for connection
            setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('MQTT connection timeout'));
                }
            }, this.config.connectTimeout);
        });
    }

    /**
     * راه‌اندازی event handlers
     */
    setupEventHandlers() {
        this.client.on('message', (topic, message, packet) => {
            this.handleIncomingMessage(topic, message, packet);
        });

        this.client.on('error', (error) => {
            logger.error('MQTT Error:', error);
            this.emit('error', error);
        });

        this.client.on('disconnect', () => {
            logger.warn('MQTT Disconnected');
            this.emit('disconnect');
        });
    }

    /**
     * Subscribe به topic های مورد نیاز
     */
    async subscribeToTopics() {
        const subscriptions = [
            { topic: this.topics.deviceData, qos: 1 },
            { topic: this.topics.deviceHeartbeat, qos: 1 },
            { topic: this.topics.deviceEvents, qos: 1 },
            { topic: this.topics.deviceResponse, qos: 1 },
            { topic: this.topics.gatewayStatus, qos: 1 },
            { topic: this.topics.systemCommands, qos: 2 }
        ];

        for (const sub of subscriptions) {
            await this.subscribe(sub.topic, sub.qos);
        }
    }

    /**
     * Subscribe به یک topic
     */
    async subscribe(topic, qos = 1) {
        return new Promise((resolve, reject) => {
            this.client.subscribe(topic, { qos }, (error, granted) => {
                if (error) {
                    logger.error(`Failed to subscribe to ${topic}:`, error);
                    reject(error);
                } else {
                    this.subscriptions.set(topic, { qos, granted });
                    logger.info(`Subscribed to topic: ${topic} (QoS: ${qos})`);
                    resolve(granted);
                }
            });
        });
    }

    /**
     * پردازش پیام‌های دریافتی
     */
    async handleIncomingMessage(topic, message, packet) {
        try {
            const messageStr = message.toString();
            logger.debug(`Received message on ${topic}: ${messageStr}`);

            // Parse JSON payload
            let payload;
            try {
                payload = JSON.parse(messageStr);
            } catch (parseError) {
                logger.warn(`Invalid JSON payload on ${topic}: ${messageStr}`);
                return;
            }

            // Route based on topic pattern
            if (topic.includes('/data')) {
                await this.handleDeviceData(topic, payload);
            } else if (topic.includes('/heartbeat')) {
                await this.handleDeviceHeartbeat(topic, payload);
            } else if (topic.includes('/events')) {
                await this.handleDeviceEvent(topic, payload);
            } else if (topic.includes('/response')) {
                await this.handleDeviceResponse(topic, payload);
            } else if (topic.includes('gateway') && topic.includes('/status')) {
                await this.handleGatewayStatus(topic, payload);
            } else if (topic === this.topics.systemCommands) {
                await this.handleSystemCommand(payload);
            }

        } catch (error) {
            logger.error(`Error processing message on ${topic}:`, error);
        }
    }

    /**
     * پردازش داده‌های سنسور
     */
    async handleDeviceData(topic, payload) {
        try {
            const deviceId = this.extractDeviceIdFromTopic(topic);
            
            // ذخیره داده در دیتابیس
            const sensorData = new SensorData({
                deviceId,
                timestamp: new Date(payload.timestamp || Date.now()),
                temperature: payload.temperature,
                humidity: payload.humidity,
                pressure: payload.pressure,
                lightLevel: payload.light_level,
                soundLevel: payload.sound_level,
                motionDetected: payload.motion,
                batteryLevel: payload.battery,
                signalStrength: payload.rssi,
                rawData: payload
            });

            await sensorData.save();

            // به‌روزرسانی وضعیت دستگاه
            await deviceService.updateDeviceStatus(deviceId, {
                lastSeen: new Date(),
                lastData: payload,
                isOnline: true
            });

            // ارسال به کلاینت‌های WebSocket
            if (this.io) {
                this.io.emit('sensorData', {
                    deviceId,
                    data: payload,
                    timestamp: new Date().toISOString()
                });
            }

            // بررسی آلارم‌ها
            await this.checkAlarms(deviceId, payload);

            logger.debug(`Processed sensor data for device: ${deviceId}`);

        } catch (error) {
            logger.error('Error handling device data:', error);
        }
    }

    /**
     * پردازش heartbeat دستگاه‌ها
     */
    async handleDeviceHeartbeat(topic, payload) {
        try {
            const deviceId = this.extractDeviceIdFromTopic(topic);
            
            await deviceService.updateDeviceStatus(deviceId, {
                lastSeen: new Date(),
                isOnline: true,
                uptime: payload.uptime,
                freeMemory: payload.free_heap,
                wifiSignal: payload.wifi_rssi,
                firmwareVersion: payload.version
            });

            // ارسال به WebSocket
            if (this.io) {
                this.io.emit('deviceHeartbeat', {
                    deviceId,
                    status: payload,
                    timestamp: new Date().toISOString()
                });
            }

            logger.debug(`Heartbeat received from device: ${deviceId}`);

        } catch (error) {
            logger.error('Error handling device heartbeat:', error);
        }
    }

    /**
     * پردازش event های دستگاه
     */
    async handleDeviceEvent(topic, payload) {
        try {
            const deviceId = this.extractDeviceIdFromTopic(topic);
            
            // ذخیره event
            await deviceService.logDeviceEvent(deviceId, payload.event, payload);

            // ارسال alert در صورت نیاز
            if (payload.event === 'motion_detected' || payload.event === 'alarm_triggered') {
                await alertService.createAlert({
                    deviceId,
                    type: payload.event,
                    message: `Event: ${payload.event} on device ${deviceId}`,
                    data: payload,
                    severity: 'warning'
                });
            }

            // ارسال به WebSocket
            if (this.io) {
                this.io.emit('deviceEvent', {
                    deviceId,
                    event: payload,
                    timestamp: new Date().toISOString()
                });
            }

            logger.info(`Event received from device ${deviceId}: ${payload.event}`);

        } catch (error) {
            logger.error('Error handling device event:', error);
        }
    }

    /**
     * پردازش پاسخ دستگاه‌ها
     */
    async handleDeviceResponse(topic, payload) {
        try {
            const deviceId = this.extractDeviceIdFromTopic(topic);
            
            // ارسال به WebSocket
            if (this.io) {
                this.io.emit('deviceResponse', {
                    deviceId,
                    response: payload,
                    timestamp: new Date().toISOString()
                });
            }

            logger.debug(`Response received from device ${deviceId}: ${payload.command} - ${payload.status}`);

        } catch (error) {
            logger.error('Error handling device response:', error);
        }
    }

    /**
     * پردازش وضعیت gateway
     */
    async handleGatewayStatus(topic, payload) {
        try {
            const gatewayId = topic.split('/')[1];
            
            // به‌روزرسانی وضعیت gateway
            await deviceService.updateGatewayStatus(gatewayId, payload);

            // ارسال به WebSocket
            if (this.io) {
                this.io.emit('gatewayStatus', {
                    gatewayId,
                    status: payload,
                    timestamp: new Date().toISOString()
                });
            }

            logger.debug(`Gateway status updated: ${gatewayId}`);

        } catch (error) {
            logger.error('Error handling gateway status:', error);
        }
    }

    /**
     * پردازش دستورات سیستم
     */
    async handleSystemCommand(payload) {
        try {
            const { command, target, data } = payload;

            switch (command) {
                case 'restart_device':
                    await this.sendDeviceCommand(target, { command: 'restart' });
                    break;

                case 'update_firmware':
                    await this.sendDeviceCommand(target, { command: 'update_firmware', url: data.url });
                    break;

                case 'factory_reset':
                    await this.sendDeviceCommand(target, { command: 'factory_reset' });
                    break;

                case 'scan_devices':
                    await this.publishToTopic('gateway/commands', { command: 'scan_devices' });
                    break;

                default:
                    logger.warn(`Unknown system command: ${command}`);
            }

        } catch (error) {
            logger.error('Error handling system command:', error);
        }
    }

    /**
     * ارسال دستور به دستگاه
     */
    async sendDeviceCommand(deviceId, command) {
        const topic = `devices/${deviceId}/commands`;
        const payload = {
            ...command,
            timestamp: Date.now(),
            source: 'backend'
        };

        return this.publishToTopic(topic, payload, 2); // QoS 2 for commands
    }

    /**
     * ارسال پیام به topic
     */
    async publishToTopic(topic, payload, qos = 1, retain = false) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('MQTT client not connected'));
                return;
            }

            const message = JSON.stringify(payload);
            
            this.client.publish(topic, message, { qos, retain }, (error) => {
                if (error) {
                    logger.error(`Failed to publish to ${topic}:`, error);
                    reject(error);
                } else {
                    logger.debug(`Published to ${topic}: ${message}`);
                    resolve();
                }
            });
        });
    }

    /**
     * انتشار وضعیت سیستم
     */
    async publishSystemStatus(status) {
        const payload = {
            status,
            timestamp: new Date().toISOString(),
            service: 'backend',
            version: process.env.npm_package_version || '1.0.0'
        };

        await this.publishToTopic(this.topics.systemStatus, payload, 1, true);
    }

    /**
     * بررسی آلارم‌ها
     */
    async checkAlarms(deviceId, data) {
        try {
            const device = await Device.findOne({ deviceId });
            if (!device || !device.alarmRules) return;

            for (const rule of device.alarmRules) {
                const shouldTrigger = this.evaluateAlarmRule(rule, data);
                
                if (shouldTrigger) {
                    await alertService.createAlert({
                        deviceId,
                        type: 'threshold_exceeded',
                        message: `${rule.parameter} ${rule.operator} ${rule.threshold}`,
                        data: { rule, currentValue: data[rule.parameter] },
                        severity: rule.severity || 'warning'
                    });
                }
            }

        } catch (error) {
            logger.error('Error checking alarms:', error);
        }
    }

    /**
     * ارزیابی قانون آلارم
     */
    evaluateAlarmRule(rule, data) {
        const value = data[rule.parameter];
        if (value === undefined) return false;

        switch (rule.operator) {
            case '>':
                return value > rule.threshold;
            case '<':
                return value < rule.threshold;
            case '>=':
                return value >= rule.threshold;
            case '<=':
                return value <= rule.threshold;
            case '==':
                return value == rule.threshold;
            case '!=':
                return value != rule.threshold;
            default:
                return false;
        }
    }

    /**
     * استخراج device ID از topic
     */
    extractDeviceIdFromTopic(topic) {
        const parts = topic.split('/');
        return parts[1]; // devices/{deviceId}/...
    }

    /**
     * قطع اتصال MQTT
     */
    async disconnect() {
        if (this.client && this.connected) {
            await this.publishSystemStatus('offline');
            this.client.end(true);
            this.connected = false;
            logger.info('MQTT client disconnected');
        }
    }

    /**
     * بررسی وضعیت اتصال
     */
    isConnected() {
        return this.connected && this.client && this.client.connected;
    }

    /**
     * آمار اتصال
     */
    getConnectionStats() {
        return {
            connected: this.connected,
            subscriptions: Array.from(this.subscriptions.keys()),
            clientId: this.config.clientId,
            broker: this.config.broker
        };
    }
}

// Create singleton instance
const mqttService = new MQTTService();

module.exports = mqttService;
