# 📘 IoT Smart System Blueprint

این داکیومنت یک نمای کامل، یکپارچه و تصویری از سیستم IoT شما ارائه می‌کند: معماری، دیاگرام‌ها، فلوهای داده، امنیت، مدل داده، پیاده‌سازی، تست و استقرار.

## فهرست مطالب
- معماری کلان و اجزاء
- توپولوژی شبکه و پروتکل‌ها
- فلوهای اصلی (Sequence)
- مدل‌های داده و Topicها
- امنیت و Provisioning
- الزامات عملکردی و مقیاس‌پذیری
- راهنمای پیاده‌سازی هر لایه
- مانیتورینگ، لاگینگ و تست

---

## معماری کلان سیستم

```mermaid
graph TD
  subgraph "Clients"
    U1["Web Dashboard"]
    U2["Mobile App"]
  end

  subgraph "Cloud/Core"
    API["API Server (Node.js)"]
    MQ["MQTT Broker (Mosquitto/HiveMQ)"]
    DB["MongoDB"]
    TSDB["InfluxDB"]
    WS["WebSocket"]
  end

  subgraph "Edge/Gateway"
    GW["Raspberry Pi Gateway"]
  end

  subgraph "Devices"
    ZB["Zigbee Nodes (ESP32-C6)"]
    LR["LoRa Nodes (SX1276)"]
    WIFI["WiFi Nodes (ESP32-S3)"]
    CAM["IP/ESP32-CAM"]
  end

  U1 <-->|HTTPS/WSS| API
  U2 <-->|HTTPS/WSS| API
  API <-->|Pub/Sub| MQ
  API <-->|CRUD| DB
  API --> TSDB
  API <-->|WS Events| WS

  GW <-->|MQTT| MQ
  GW <-->|Zigbee/Z-Wave| ZB
  GW <-->|LoRaWAN| LR
  GW <-->|RTSP/WebRTC| CAM
  GW <-->|WiFi| WIFI
```

---

## توپولوژی شبکه و پروتکل‌ها

- هسته داده: MQTT/TLS برای داده سنسورها و فرمان‌ها
- ویدیو: WebRTC (کم‌تاخیر) یا RTSP→WebRTC Gateway
- سنسور تا برد: Zigbee 3.0 برای مصرف پایین و Mesh؛ LoRaWAN برای فواصل طولانی
- ارتباط محلی: WiFi/Ethernet برای گیت‌وی و دوربین‌ها
- API و Dashboard: HTTPS + WebSocket

```mermaid
graph LR
  subgraph WAN/Internet
  CLI1[Clients]-- HTTPS/WSS -->CDN[(CDN/Edge)]--->APIc[API]
  end

  subgraph Datacenter/Cloud
  APIc-- Pub/Sub -->MQTT[(MQTT Broker)]
  APIc-- CRUD -->DB[(MongoDB)]
  APIc-- Write -->TS[(InfluxDB)]
  APIc-- WS -->WSvc[(WS Service)]
  end

  subgraph Local Site
  GW[Gateway Pi]-- MQTT/TLS -->MQTT
  GW-- Zigbee -->ZB[Zigbee Mesh]
  GW-- LoRaWAN -->LR[LoRa Nodes]
  GW-- RTSP/WebRTC -->Cam[IP/ESP32-CAM]
```

---

## فلوهای اصلی (Sequence)

### ارسال داده سنسور
```mermaid
sequenceDiagram
  participant Dev as Device (ESP32/Zigbee)
  participant GW as Gateway (Raspberry Pi)
  participant MQ as MQTT Broker
  participant API as API Server
  participant DB as MongoDB/InfluxDB
  participant UI as Web/Mobile

  Dev->>GW: Sensor Reading (Zigbee/LoRa/WiFi)
  GW->>MQ: Publish devices/{id}/data (QoS 1)
  MQ->>API: Forward via subscribe
  API->>DB: Store (Mongo + Influx)
  API-->>UI: WebSocket event (sensorData)
```

### اجرای فرمان
```mermaid
sequenceDiagram
  participant UI as Web/Mobile
  participant API as API Server
  participant MQ as MQTT Broker
  participant Dev as Device (ESP32)

  UI->>API: POST /devices/{id}/command { relay_on }
  API->>MQ: Publish devices/{id}/commands (QoS 2)
  MQ->>Dev: MQTT message
  Dev-->>MQ: devices/{id}/response { executed }
  MQ-->>API: response
  API-->>UI: Status update via WS
```

### استریم ویدیو
```mermaid
sequenceDiagram
  participant Cam as Camera (IP/ESP32-CAM)
  participant GW as Gateway (Jetson/Pi)
  participant ST as STUN/TURN
  participant UI as WebRTC Client

  Cam->>GW: RTSP/RTP stream
  UI->>GW: WebRTC Offer (HTTPS/WSS signaling)
  GW->>ST: ICE/STUN
  ST-->>GW: Candidate
  GW-->>UI: Answer + Candidates
  UI-->>GW: Media (SRTP)
```

---

## مدل‌های داده، Topicها و قراردادها

- Topicها:
  - devices/{deviceId}/data
  - devices/{deviceId}/heartbeat
  - devices/{deviceId}/events
  - devices/{deviceId}/commands
  - devices/{deviceId}/response

نمونه Payload سنسورها:
```json
{
  "device_id": "ESP32-ABCD1234",
  "timestamp": 1712345678,
  "temperature": 24.6,
  "humidity": 58.2,
  "pressure": 1012.5,
  "light_level": 345.2,
  "sound_level": 12.3,
  "motion": false,
  "battery": 86,
  "rssi": -58,
  "free_heap": 197632
}
```

نمونه فرمان:
```json
{
  "command": "relay_on",
  "duration": 0,
  "source": "backend",
  "timestamp": 1712345700
}
```

پاسخ دستگاه:
```json
{
  "command": "relay_on",
  "status": "executed",
  "timestamp": 1712345701
}
```

---

## امنیت، Provisioning و مدیریت کلیدها

- Device Identity: X.509 per-device, Device ID + CSR هنگام تولید
- TLS 1.3 برای MQTT/HTTPS، اجبار به cipherهای مدرن
- احراز هویت: JWT برای کلاینت‌ها، username/password یا mTLS برای دستگاه‌ها
- Provisioning Flow:
```mermaid
graph TD
  A[Manufacturing]-->B[Generate Keys & Certs]
  B-->C[Burn to Secure Storage]
  C-->D[Register Device in Backend]
  D-->E[QR Code with bootstrap config]
  E-->F[Onboarding via Mobile/Web]
  F-->G[mTLS Join + Policy Attach]
```
- OTA امن: امضای فریمور و اعتبارسنجی قبل از فلش
- Least Privilege در MQTT: ACL بر اساس `devices/{id}/#`
- Network Segmentation: VLAN برای IoT، جدا از LAN کاربران

---

## الزامات عملکردی و SLOها

- تاخیر داده سنسور انتها به انتها: ≤ 200ms (LAN)، ≤ 500ms (WAN)
- دستورات کنترل: تحویل تضمین‌شده QoS 2 با ≤ 1s
- ویدیو: WebRTC با تاخیر ≤ 150ms، نرخ 720p@30fps (وابسته به شبکه)
- پایداری: Uptime 99.9%، MQTT HA (Replication/Cluster)
- مقیاس‌پذیری: 10k+ دستگاه، 10k msg/s با افقی‌سازی Broker/API

---

## راهنمای پیاده‌سازی لایه‌ها (Summary)

- Firmware (ESP32): PlatformIO، MQTT/TLS، OTA، سنسورهای I2C/SPI، Deep Sleep
- Gateway (Raspberry Pi): Bridge Zigbee/LoRa، Stream Transcoding، Local DB/Cache، Health
- Backend (Node.js): REST/WS، MQTT Consumer، Mongo/Influx، Auth، Alerts، Swagger
- Frontend (React): Real-time UI، نمودارها، کنترل دستگاه، اعلان‌ها، RTL
- Mobile (Expo/React Native): کنترل سریع، اعلان Push، QR Provisioning، Offline mode

ساختار موجود پروژه در `IoT_Smart_System/` پیاده‌سازی این لایه‌ها را فراهم کرده است.

---

## مانیتورینگ، لاگینگ و تست

- متریک‌ها: CPU/RAM، MQTT Throughput، API Latency، Device Online/Offline
- Logging مرکزی (ELK/EFK)
- تست‌ها: Unit/Integration/E2E/Performance/Security (اسکریپت‌ها در `docs/deployment/testing_guide.md`)

```mermaid
graph TD
  subgraph Observability
    P[Prometheus]-->G[Grafana]
    L[ELK/EFK]-->G
  end
  API-->P
  MQTT-->P
  GW-->P
  API-->L
  GW-->L
```

---

## لینک‌های مرجع داخل پروژه
- BOM کامل: `hardware/BOM_complete.csv`
- انتخاب قطعات: `docs/hardware_guide/component_selection.md`
- راهنمای تست: `docs/deployment/testing_guide.md`
- راهنمای استقرار: `docs/deployment/deployment_guide.md`
- Firmware نمونه: `hardware/esp32_firmware/`
- Gateway: `hardware/raspberry_pi/gateway_main.py`
- Backend: `backend/`
- Web Dashboard: `frontend/web_dashboard/`
- Mobile App: `frontend/mobile_app/`
