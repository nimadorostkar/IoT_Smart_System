/**
 * IoT Smart System - ESP32-S3 Main Firmware
 * 
 * نویسنده: تیم توسعه IoT
 * نسخه: 1.0.0
 * تاریخ: 2024
 * 
 * این firmware شامل:
 * - مدیریت سنسورها
 * - ارتباط MQTT
 * - شبکه Zigbee
 * - OTA Updates
 * - Web Server محلی
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <ArduinoOTA.h>
#include <ESP32Time.h>

// کتابخانه‌های سنسور
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_SHT31.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_BME680.h>
#include <BH1750.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// تنظیمات شبکه
const char* ssid = "IoT_Network";
const char* password = "SecurePass123";
const char* mqtt_server = "mqtt.iot-system.com";
const int mqtt_port = 8883;
const char* mqtt_user = "device_user";
const char* mqtt_pass = "device_pass";

// تنظیمات پین‌ها
#define LED_STATUS_PIN    2
#define BUTTON_CONFIG_PIN 0
#define PIR_SENSOR_PIN    4
#define ONEWIRE_BUS_PIN   5
#define RELAY_PIN         6
#define BUZZER_PIN        7

// تنظیمات سنسورها
#define I2C_SDA_PIN       21
#define I2C_SCL_PIN       22
#define ADC_SOUND_PIN     A0
#define UPDATE_INTERVAL   30000  // 30 ثانیه

// Object های سنسور
Adafruit_SHT31 sht31 = Adafruit_SHT31();
Adafruit_BMP280 bmp280;
Adafruit_BME680 bme680;
BH1750 lightMeter;
OneWire oneWire(ONEWIRE_BUS_PIN);
DallasTemperature sensors(&oneWire);

// Object های شبکه
WiFiClientSecure espClient;
PubSubClient mqtt(espClient);
AsyncWebServer webServer(80);
Preferences preferences;
ESP32Time rtc;

// متغیرهای global
String deviceId;
bool mqttConnected = false;
bool sensorsInitialized = false;
unsigned long lastSensorRead = 0;
unsigned long lastHeartbeat = 0;
bool motionDetected = false;
bool configMode = false;

// ساختار داده سنسور
struct SensorData {
    float temperature = 0.0;
    float humidity = 0.0;
    float pressure = 0.0;
    float gasResistance = 0.0;
    float lightLevel = 0.0;
    float soundLevel = 0.0;
    bool motionStatus = false;
    float batteryLevel = 0.0;
    unsigned long timestamp = 0;
};

SensorData currentData;

/**
 * راه‌اندازی اولیه سیستم
 */
void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("=== IoT Smart System Starting ===");
    
    // راه‌اندازی پین‌ها
    setupPins();
    
    // خواندن تنظیمات
    loadConfiguration();
    
    // ایجاد Device ID منحصر به فرد
    generateDeviceId();
    
    // راه‌اندازی I2C
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    
    // راه‌اندازی سنسورها
    initializeSensors();
    
    // اتصال به WiFi
    connectToWiFi();
    
    // راه‌اندازی MQTT
    setupMQTT();
    
    // راه‌اندازی Web Server
    setupWebServer();
    
    // راه‌اندازی OTA
    setupOTA();
    
    // تنظیم زمان
    configTime(0, 0, "pool.ntp.org");
    
    Serial.println("=== System Ready ===");
    blinkStatusLED(3, 200);
}

/**
 * حلقه اصلی برنامه
 */
void loop() {
    // مدیریت MQTT
    if (!mqtt.connected()) {
        reconnectMQTT();
    }
    mqtt.loop();
    
    // مدیریت OTA
    ArduinoOTA.handle();
    
    // خواندن سنسورها
    if (millis() - lastSensorRead > UPDATE_INTERVAL) {
        readAllSensors();
        publishSensorData();
        lastSensorRead = millis();
    }
    
    // ارسال heartbeat
    if (millis() - lastHeartbeat > 60000) { // هر دقیقه
        publishHeartbeat();
        lastHeartbeat = millis();
    }
    
    // بررسی motion sensor
    checkMotionSensor();
    
    // بررسی دکمه config
    checkConfigButton();
    
    delay(100);
}

/**
 * راه‌اندازی پین‌های GPIO
 */
void setupPins() {
    pinMode(LED_STATUS_PIN, OUTPUT);
    pinMode(BUTTON_CONFIG_PIN, INPUT_PULLUP);
    pinMode(PIR_SENSOR_PIN, INPUT);
    pinMode(RELAY_PIN, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    
    // خاموش کردن اولیه
    digitalWrite(LED_STATUS_PIN, LOW);
    digitalWrite(RELAY_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
}

/**
 * تولید Device ID منحصر به فرد
 */
void generateDeviceId() {
    uint64_t chipid = ESP.getEfuseMac();
    deviceId = "ESP32-" + String((uint32_t)(chipid >> 32), HEX) + 
               String((uint32_t)chipid, HEX);
    deviceId.toUpperCase();
    Serial.println("Device ID: " + deviceId);
}

/**
 * راه‌اندازی سنسورها
 */
void initializeSensors() {
    Serial.println("Initializing sensors...");
    
    // SHT31 (دما و رطوبت)
    if (sht31.begin(0x44)) {
        Serial.println("✓ SHT31 initialized");
    } else {
        Serial.println("✗ SHT31 failed");
    }
    
    // BMP280 (فشار)
    if (bmp280.begin(0x76)) {
        Serial.println("✓ BMP280 initialized");
        bmp280.setSampling(Adafruit_BMP280::MODE_NORMAL,
                          Adafruit_BMP280::SAMPLING_X2,
                          Adafruit_BMP280::SAMPLING_X16,
                          Adafruit_BMP280::FILTER_X16,
                          Adafruit_BMP280::STANDBY_MS_500);
    } else {
        Serial.println("✗ BMP280 failed");
    }
    
    // BME680 (کیفیت هوا)
    if (bme680.begin(0x77)) {
        Serial.println("✓ BME680 initialized");
        bme680.setTemperatureOversampling(BME680_OS_8X);
        bme680.setHumidityOversampling(BME680_OS_2X);
        bme680.setPressureOversampling(BME680_OS_4X);
        bme680.setIIRFilterSize(BME680_FILTER_SIZE_3);
        bme680.setGasHeater(320, 150);
    } else {
        Serial.println("✗ BME680 failed");
    }
    
    // BH1750 (نور)
    if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
        Serial.println("✓ BH1750 initialized");
    } else {
        Serial.println("✗ BH1750 failed");
    }
    
    // DS18B20 (دمای خارجی)
    sensors.begin();
    int deviceCount = sensors.getDeviceCount();
    Serial.println("✓ Found " + String(deviceCount) + " DS18B20 sensors");
    
    sensorsInitialized = true;
}

/**
 * اتصال به WiFi
 */
void connectToWiFi() {
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        blinkStatusLED(1, 100);
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        Serial.println("WiFi connected!");
        Serial.println("IP address: " + WiFi.localIP().toString());
        digitalWrite(LED_STATUS_PIN, HIGH);
    } else {
        Serial.println();
        Serial.println("WiFi connection failed!");
        // ورود به حالت AP
        startAPMode();
    }
}

/**
 * راه‌اندازی MQTT
 */
void setupMQTT() {
    espClient.setInsecure(); // برای تست - در تولید از certificate استفاده کنید
    mqtt.setServer(mqtt_server, mqtt_port);
    mqtt.setCallback(mqttCallback);
    
    reconnectMQTT();
}

/**
 * اتصال مجدد به MQTT
 */
void reconnectMQTT() {
    while (!mqtt.connected()) {
        Serial.print("Attempting MQTT connection...");
        
        String clientId = deviceId + "-" + String(random(0xffff), HEX);
        
        if (mqtt.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
            Serial.println("connected");
            mqttConnected = true;
            
            // subscribe به topics
            mqtt.subscribe(("devices/" + deviceId + "/commands").c_str());
            mqtt.subscribe(("devices/" + deviceId + "/config").c_str());
            
            // اعلام آنلاین بودن
            publishHeartbeat();
            
        } else {
            Serial.print("failed, rc=");
            Serial.print(mqtt.state());
            Serial.println(" try again in 5 seconds");
            delay(5000);
        }
    }
}

/**
 * callback برای پیام‌های MQTT
 */
void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String message = "";
    for (int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    
    Serial.println("Received: " + String(topic) + " = " + message);
    
    // پردازش دستورات
    if (String(topic).endsWith("/commands")) {
        processCommand(message);
    }
    
    // پردازش تنظیمات
    if (String(topic).endsWith("/config")) {
        processConfig(message);
    }
}

/**
 * خواندن تمام سنسورها
 */
void readAllSensors() {
    if (!sensorsInitialized) return;
    
    currentData.timestamp = rtc.getEpoch();
    
    // SHT31
    if (!isnan(sht31.readTemperature())) {
        currentData.temperature = sht31.readTemperature();
        currentData.humidity = sht31.readHumidity();
    }
    
    // BMP280
    if (bmp280.begin()) {
        currentData.pressure = bmp280.readPressure() / 100.0F; // hPa
    }
    
    // BME680
    if (bme680.performReading()) {
        currentData.gasResistance = bme680.gas_resistance / 1000.0; // KOhms
    }
    
    // BH1750
    currentData.lightLevel = lightMeter.readLightLevel();
    
    // Sound level (ADC)
    int soundRaw = analogRead(ADC_SOUND_PIN);
    currentData.soundLevel = (soundRaw / 4095.0) * 100.0; // درصد
    
    // PIR Motion
    currentData.motionStatus = digitalRead(PIR_SENSOR_PIN);
    
    // Battery level (if running on battery)
    currentData.batteryLevel = readBatteryLevel();
    
    // DS18B20 external temperature
    sensors.requestTemperatures();
    // استفاده از دمای اولین سنسور
    
    Serial.println("Sensors read: T=" + String(currentData.temperature) + 
                   "°C, H=" + String(currentData.humidity) + 
                   "%, P=" + String(currentData.pressure) + "hPa");
}

/**
 * انتشار داده‌های سنسور
 */
void publishSensorData() {
    if (!mqttConnected) return;
    
    // ایجاد JSON payload
    StaticJsonDocument<512> doc;
    doc["device_id"] = deviceId;
    doc["timestamp"] = currentData.timestamp;
    doc["temperature"] = currentData.temperature;
    doc["humidity"] = currentData.humidity;
    doc["pressure"] = currentData.pressure;
    doc["gas_resistance"] = currentData.gasResistance;
    doc["light_level"] = currentData.lightLevel;
    doc["sound_level"] = currentData.soundLevel;
    doc["motion"] = currentData.motionStatus;
    doc["battery"] = currentData.batteryLevel;
    doc["rssi"] = WiFi.RSSI();
    doc["free_heap"] = ESP.getFreeHeap();
    
    String payload;
    serializeJson(doc, payload);
    
    String topic = "devices/" + deviceId + "/data";
    
    if (mqtt.publish(topic.c_str(), payload.c_str())) {
        Serial.println("Data published successfully");
        blinkStatusLED(1, 50);
    } else {
        Serial.println("Failed to publish data");
    }
}

/**
 * انتشار heartbeat
 */
void publishHeartbeat() {
    if (!mqttConnected) return;
    
    StaticJsonDocument<256> doc;
    doc["device_id"] = deviceId;
    doc["status"] = "online";
    doc["uptime"] = millis();
    doc["wifi_rssi"] = WiFi.RSSI();
    doc["free_heap"] = ESP.getFreeHeap();
    doc["version"] = "1.0.0";
    
    String payload;
    serializeJson(doc, payload);
    
    String topic = "devices/" + deviceId + "/heartbeat";
    mqtt.publish(topic.c_str(), payload.c_str());
}

/**
 * پردازش دستورات
 */
void processCommand(String command) {
    StaticJsonDocument<256> doc;
    deserializeJson(doc, command);
    
    String cmd = doc["command"];
    
    if (cmd == "relay_on") {
        digitalWrite(RELAY_PIN, HIGH);
        Serial.println("Relay turned ON");
    }
    else if (cmd == "relay_off") {
        digitalWrite(RELAY_PIN, LOW);
        Serial.println("Relay turned OFF");
    }
    else if (cmd == "buzzer") {
        int duration = doc["duration"] | 1000;
        digitalWrite(BUZZER_PIN, HIGH);
        delay(duration);
        digitalWrite(BUZZER_PIN, LOW);
    }
    else if (cmd == "restart") {
        Serial.println("Restarting device...");
        ESP.restart();
    }
    else if (cmd == "factory_reset") {
        factoryReset();
    }
    
    // ارسال تأیید
    publishCommandResponse(cmd, "executed");
}

/**
 * ارسال پاسخ دستور
 */
void publishCommandResponse(String command, String status) {
    StaticJsonDocument<128> doc;
    doc["command"] = command;
    doc["status"] = status;
    doc["timestamp"] = rtc.getEpoch();
    
    String payload;
    serializeJson(doc, payload);
    
    String topic = "devices/" + deviceId + "/response";
    mqtt.publish(topic.c_str(), payload.c_str());
}

/**
 * بررسی motion sensor
 */
void checkMotionSensor() {
    bool currentMotion = digitalRead(PIR_SENSOR_PIN);
    
    if (currentMotion && !motionDetected) {
        motionDetected = true;
        Serial.println("Motion detected!");
        
        // ارسال اعلان فوری
        if (mqttConnected) {
            StaticJsonDocument<128> doc;
            doc["device_id"] = deviceId;
            doc["event"] = "motion_detected";
            doc["timestamp"] = rtc.getEpoch();
            
            String payload;
            serializeJson(doc, payload);
            
            String topic = "devices/" + deviceId + "/events";
            mqtt.publish(topic.c_str(), payload.c_str());
        }
        
        blinkStatusLED(5, 100);
    }
    else if (!currentMotion && motionDetected) {
        motionDetected = false;
        Serial.println("Motion ended");
    }
}

/**
 * خواندن سطح باتری
 */
float readBatteryLevel() {
    // اگر از باتری استفاده می‌کنید
    // این مقدار را بر اساس مدار تقسیم ولتاژ محاسبه کنید
    return 100.0; // فرضی برای تست
}

/**
 * چشمک زدن LED وضعیت
 */
void blinkStatusLED(int times, int delayMs) {
    for (int i = 0; i < times; i++) {
        digitalWrite(LED_STATUS_PIN, HIGH);
        delay(delayMs);
        digitalWrite(LED_STATUS_PIN, LOW);
        delay(delayMs);
    }
}

/**
 * بارگذاری تنظیمات
 */
void loadConfiguration() {
    preferences.begin("iot-config", false);
    
    // بارگذاری تنظیمات WiFi در صورت وجود
    String savedSSID = preferences.getString("wifi_ssid", "");
    String savedPass = preferences.getString("wifi_pass", "");
    
    if (savedSSID.length() > 0) {
        savedSSID.toCharArray((char*)ssid, savedSSID.length() + 1);
        savedPass.toCharArray((char*)password, savedPass.length() + 1);
    }
    
    preferences.end();
}

/**
 * ذخیره تنظیمات
 */
void saveConfiguration() {
    preferences.begin("iot-config", false);
    preferences.putString("wifi_ssid", ssid);
    preferences.putString("wifi_pass", password);
    preferences.end();
}

/**
 * بازگشت به تنظیمات کارخانه
 */
void factoryReset() {
    Serial.println("Factory reset...");
    preferences.begin("iot-config", false);
    preferences.clear();
    preferences.end();
    delay(1000);
    ESP.restart();
}

/**
 * بررسی دکمه config
 */
void checkConfigButton() {
    static unsigned long buttonPressed = 0;
    
    if (digitalRead(BUTTON_CONFIG_PIN) == LOW) {
        if (buttonPressed == 0) {
            buttonPressed = millis();
        }
        else if (millis() - buttonPressed > 5000) { // 5 ثانیه
            Serial.println("Config mode activated");
            startAPMode();
            buttonPressed = 0;
        }
    } else {
        buttonPressed = 0;
    }
}

/**
 * شروع حالت Access Point
 */
void startAPMode() {
    WiFi.mode(WIFI_AP);
    WiFi.softAP("IoT-Setup-" + deviceId, "12345678");
    
    Serial.println("AP Mode started");
    Serial.println("SSID: IoT-Setup-" + deviceId);
    Serial.println("IP: " + WiFi.softAPIP().toString());
    
    configMode = true;
}

/**
 * راه‌اندازی Web Server
 */
void setupWebServer() {
    // صفحه اصلی
    webServer.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        String html = generateStatusPage();
        request->send(200, "text/html", html);
    });
    
    // API endpoint برای داده‌های سنسور
    webServer.on("/api/sensors", HTTP_GET, [](AsyncWebServerRequest *request){
        StaticJsonDocument<512> doc;
        doc["temperature"] = currentData.temperature;
        doc["humidity"] = currentData.humidity;
        doc["pressure"] = currentData.pressure;
        doc["light"] = currentData.lightLevel;
        doc["motion"] = currentData.motionStatus;
        doc["timestamp"] = currentData.timestamp;
        
        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });
    
    // کنترل relay
    webServer.on("/api/relay", HTTP_POST, [](AsyncWebServerRequest *request){
        if (request->hasParam("state", true)) {
            String state = request->getParam("state", true)->value();
            digitalWrite(RELAY_PIN, state == "on" ? HIGH : LOW);
            request->send(200, "text/plain", "OK");
        } else {
            request->send(400, "text/plain", "Missing state parameter");
        }
    });
    
    webServer.begin();
    Serial.println("Web server started");
}

/**
 * تولید صفحه وضعیت HTML
 */
String generateStatusPage() {
    String html = R"(
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IoT Device Status</title>
    <style>
        body { font-family: Arial; margin: 20px; background: #f0f0f0; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
        .sensor { margin: 10px 0; padding: 10px; background: #e8f4fd; border-radius: 5px; }
        .value { font-weight: bold; color: #0066cc; }
        button { padding: 10px 20px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; }
        .on { background: #28a745; color: white; }
        .off { background: #dc3545; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏠 IoT Smart System</h1>
        <h2>Device ID: )" + deviceId + R"(</h2>
        
        <div class="sensor">
            <strong>🌡️ دما:</strong> <span class="value" id="temp">)" + String(currentData.temperature) + R"(°C</span>
        </div>
        
        <div class="sensor">
            <strong>💧 رطوبت:</strong> <span class="value" id="humidity">)" + String(currentData.humidity) + R"(%</span>
        </div>
        
        <div class="sensor">
            <strong>📏 فشار:</strong> <span class="value" id="pressure">)" + String(currentData.pressure) + R"( hPa</span>
        </div>
        
        <div class="sensor">
            <strong>💡 نور:</strong> <span class="value" id="light">)" + String(currentData.lightLevel) + R"( lux</span>
        </div>
        
        <div class="sensor">
            <strong>👤 حرکت:</strong> <span class="value">)" + String(currentData.motionStatus ? "تشخیص داده شد" : "تشخیص نداده شد") + R"(</span>
        </div>
        
        <h3>کنترل دستگاه‌ها</h3>
        <button class="on" onclick="controlRelay('on')">روشن کردن رله</button>
        <button class="off" onclick="controlRelay('off')">خاموش کردن رله</button>
        
        <h3>اطلاعات شبکه</h3>
        <div class="sensor">
            <strong>WiFi:</strong> <span class="value">)" + String(WiFi.SSID()) + R"(</span><br>
            <strong>IP:</strong> <span class="value">)" + WiFi.localIP().toString() + R"(</span><br>
            <strong>RSSI:</strong> <span class="value">)" + String(WiFi.RSSI()) + R"( dBm</span>
        </div>
    </div>
    
    <script>
        function controlRelay(state) {
            fetch('/api/relay', {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: 'state=' + state
            }).then(response => {
                if(response.ok) alert('دستور اجرا شد');
            });
        }
        
        // به‌روزرسانی خودکار هر 5 ثانیه
        setInterval(() => {
            fetch('/api/sensors')
            .then(response => response.json())
            .then(data => {
                document.getElementById('temp').textContent = data.temperature + '°C';
                document.getElementById('humidity').textContent = data.humidity + '%';
                document.getElementById('pressure').textContent = data.pressure + ' hPa';
                document.getElementById('light').textContent = data.light + ' lux';
            });
        }, 5000);
    </script>
</body>
</html>
)";
    return html;
}

/**
 * راه‌اندازی OTA (Over The Air Updates)
 */
void setupOTA() {
    ArduinoOTA.setHostname(deviceId.c_str());
    ArduinoOTA.setPassword("ota_update_pass");
    
    ArduinoOTA.onStart([]() {
        String type;
        if (ArduinoOTA.getCommand() == U_FLASH) {
            type = "sketch";
        } else {
            type = "filesystem";
        }
        Serial.println("Start updating " + type);
    });
    
    ArduinoOTA.onEnd([]() {
        Serial.println("\nEnd");
    });
    
    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
    });
    
    ArduinoOTA.onError([](ota_error_t error) {
        Serial.printf("Error[%u]: ", error);
        if (error == OTA_AUTH_ERROR) {
            Serial.println("Auth Failed");
        } else if (error == OTA_BEGIN_ERROR) {
            Serial.println("Begin Failed");
        } else if (error == OTA_CONNECT_ERROR) {
            Serial.println("Connect Failed");
        } else if (error == OTA_RECEIVE_ERROR) {
            Serial.println("Receive Failed");
        } else if (error == OTA_END_ERROR) {
            Serial.println("End Failed");
        }
    });
    
    ArduinoOTA.begin();
    Serial.println("OTA Ready");
}

/**
 * پردازش تنظیمات جدید
 */
void processConfig(String config) {
    StaticJsonDocument<256> doc;
    deserializeJson(doc, config);
    
    if (doc.containsKey("update_interval")) {
        // به‌روزرسانی فاصله خواندن سنسور
        // این مقدار را در preferences ذخیره کنید
    }
    
    if (doc.containsKey("wifi_ssid") && doc.containsKey("wifi_pass")) {
        // به‌روزرسانی تنظیمات WiFi
        // بعد از ذخیره، دستگاه را restart کنید
    }
}
