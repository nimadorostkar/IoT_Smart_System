# 🏠 سیستم IoT هوشمند – راهنمای کامل پروژه

یک سیستم کامل IoT برای مانیتورینگ و کنترل بلادرنگ سنسورها و دستگاه‌ها با قابلیت‌های ویدیو، امنیت سطح سازمانی، و مقیاس‌پذیری بالا.

## 🎯 ویژگی‌های کلیدی
- 📊 مانیتورینگ Real-time سنسورها (دما، رطوبت، حرکت، کیفیت هوا و…)
- 🎮 کنترل از راه دور دستگاه‌ها و خروجی‌ها (رله، دیمر و ...)
- 📹 پخش زنده ویدیو (WebRTC/RTSP)
- 🔐 امنیت: TLS/mTLS، احراز هویت، OTA امن
- 📈 ذخیره‌سازی Time-series و تحلیل داده
- ⚙️ مقیاس‌پذیر: از چند دستگاه تا هزاران دستگاه

## 🏗️ معماری لایه‌ای
1) Device Layer: سنسورها/اکچویتورها (ESP32، Zigbee، LoRa)
2) Gateway Layer: Raspberry Pi (Bridge, Video, Local DB/Cache)
3) Cloud Layer: API Server, MQTT Broker, Databases
4) Application Layer: Web Dashboard, Mobile App

برای دیاگرام‌ها و فلوها: به سند تصویری مراجعه کنید: `docs/IoT_System_Blueprint.md`

## 📁 ساختار پروژه
```
IoT_Smart_System/
├── hardware/
│   ├── esp32_firmware/          # Firmware ESP32 (PlatformIO)
│   ├── raspberry_pi/            # Gateway (Python)
│   └── pcb_designs/             # طراحی PCB (در صورت نیاز)
├── backend/                     # Backend API و سرویس‌ها
│   ├── package.json
│   └── src/
├── frontend/
│   ├── web_dashboard/           # داشبورد React
│   ├── mobile_app/              # اپ موبایل (Expo/React Native)
│   └── desktop_app/             # اپ دسکتاپ (در صورت استفاده)
├── docs/
│   ├── IoT_System_Blueprint.md  # داکیومنت تصویری کامل
│   ├── hardware_guide/
│   │   ├── component_selection.md
│   │   └── firmware_guide.md
│   ├── software_guide/README.md
│   └── deployment/
│       ├── deployment_guide.md
│       └── testing_guide.md
├── docs/business/
│   ├── production_business_guide.md
│   ├── templates/               # SLA, RMA, QC, Label
│   ├── gtm/                     # Launch plan, Messaging, ICP
│   └── costing/                 # Cost model
├── tools/
│   ├── testing/
│   └── monitoring/
└── scripts/
```

## 🚀 شروع سریع (Quickstart)
پیش‌نیازها: Node.js 18+، Python 3.9+، Docker & Docker Compose، PlatformIO

```bash
# 1) Backend
cd backend
npm install
npm run dev  # یا npm start در تولید

# 2) Web Dashboard
cd ../frontend/web_dashboard
npm install
npm start

# 3) Mobile App (Expo)
cd ../mobile_app
npm install
npm run start  # expo start

# 4) Firmware (ESP32)
cd ../../hardware/esp32_firmware
pio run --target upload
pio device monitor -b 115200
```

برای استقرار تولید با Docker Compose و راه‌اندازی کامل سرویس‌ها به `docs/deployment/deployment_guide.md` مراجعه کنید.

## 🔌 ارتباطات و پروتکل‌ها
- بین دستگاه و سرور: MQTT/TLS (QoS 1/2)
- ویدیو: WebRTC (کم‌تاخیر) یا RTSP→WebRTC
- سنسور تا برد: Zigbee 3.0 (Mesh)، LoRaWAN برای فاصلۀ طولانی
- API: HTTPS + WebSocket برای Real-time UI

## 🛡️ امنیت
- mTLS/X.509 برای دستگاه‌ها (اختیاری)
- TLS 1.3 برای API/MQTT، ACL برای Topics
- OTA امن با امضای دیجیتال
- جداسازی شبکه (VLAN) برای IoT

## 📚 مستندات مهم
- نقشه و دیاگرام‌های کامل: `docs/IoT_System_Blueprint.md`
- انتخاب قطعات: `docs/hardware_guide/component_selection.md`
- راهنمای Firmware/Hardware: `docs/hardware_guide/firmware_guide.md`
- راهنمای نرم‌افزار: `docs/software_guide/README.md`
- راهنمای تست کامل: `docs/deployment/testing_guide.md`
- راهنمای استقرار: `docs/deployment/deployment_guide.md`
- تولید انبوه و بازاریابی: `docs/business/production_business_guide.md`

## ��️ تکنولوژی‌ها
- Hardware: ESP32-S3/C6، Zigbee 3.0، LoRa (SX1276)، Raspberry Pi
- Software: Node.js/Express، React/React Native، WebRTC، MQTT
- Databases: MongoDB، InfluxDB، Redis
- Observability: Grafana/Prometheus، ELK/EFK (اختیاری)

## 🧪 تست و کیفیت
- Unit/Integration/E2E/Performance/Security
- اسکریپت‌ها و نمونه‌ها: `docs/deployment/testing_guide.md`

## 💰 هزینه نمونه (تقریبی)
- ESP32-S3 ~ $15، Raspberry Pi ~ $75، سنسورها $30–50، PCB+مونتاژ ~$25
- جمع تقریبی واحد: ~$145–165 (متغیر)

## 📄 لایسنس
MIT (در صورت نیاز تغییر دهید)

## 👥 مشارکت
- Fork → Branch → Commit → PR

## 📞 پشتیبانی
- ایمیل: iot.support@yourcompany.com
- اسناد: `docs/`


<hr>

IoT Smart System is a full-stack solution for building and operating robust IoT products across smart homes, smart agriculture, and remote surveillance. It combines low-latency data ingestion (MQTT/TLS), reliable device control, secure OTA, and live video streaming (WebRTC/RTSP) with a modern web dashboard and mobile app. The system is designed to be scalable, secure, and maintainable from prototype to mass production.

### Core capabilities
- • Real-time telemetry: temperature, humidity, motion, air quality, light, sound, battery, RSSI.
- • Device control: relays, dimmers, motors, valves, scenes, schedules.
- • Live video: sub-150 ms WebRTC (browser/mobile) with RTSP→WebRTC gateway.
- • Automations: threshold rules, presence/motion triggers, schedules, scenes.
- • Alerts & notifications: MQTT events → backend rules → push/email/WS updates.
- • OTA updates: signed images, staged rollouts, automatic rollback on failure.
- • Multi-tenant, role-based: secure access to sites, rooms, devices.
- • Observability: metrics, logs, traces; dashboards for system health and usage.

### Architecture at a glance
- • Device layer: ESP32 S3/C6 nodes (Wi‑Fi, Zigbee 3.0, LoRa) with deep‑sleep for battery devices.
- • Edge/Gateway: Raspberry Pi (optional Jetson) bridges Zigbee/LoRa/Wi‑Fi, buffers data offline, and converts RTSP to WebRTC.
- • Cloud/Core:
  - Backend API (Node.js/Express) with JWT auth, REST, WebSocket.
  - MQTT broker (Mosquitto/HiveMQ) with ACLs and QoS 1/2.
  - Databases: MongoDB (entities, config, events), InfluxDB (time‑series), Redis (cache).
- • Apps: React web dashboard and Expo/React‑Native mobile app.

### Data and control planes
- • Telemetry: MQTT/TLS topics `devices/{id}/data|heartbeat|events` (QoS 1).
- • Commands: `devices/{id}/commands` (QoS 2, idempotent, deduplicated via message IDs).
- • Responses: `devices/{id}/response` for execution results and timing.
- • Video: RTSP from IP/ESP32‑CAM → WebRTC to browser/app via STUN/TURN; adaptive bitrate.

### Protocol and hardware choices
- • Sensors → MCU: Zigbee 3.0 mesh for low power and resilience; LoRaWAN for long range; Wi‑Fi for high bandwidth nodes.
- • MCU → Cloud: MQTT over TLS 1.3; optional mTLS per device.
- • Reference hardware:
  - ESP32‑S3 (Wi‑Fi/BT; optional Zigbee/Thread with C6), SHT31, BMP280, BME680, BH1750, PIR/mmWave.
  - Gateway: Raspberry Pi 4 (bridge + AI/video), optional Jetson for heavy CV.
  - Cameras: IP cams (RTSP/PoE) and ESP32‑CAM.

### Security model
- • Device identity: per‑device X.509 (mTLS) or scoped MQTT credentials with ACLs.
- • Transport: TLS 1.3 for MQTT/HTTPS; modern ciphers; strict certificate pinning where applicable.
- • OTA security: signed firmware; integrity checks; staged rollout; rollback on failed health.
- • Backend: JWT with short‑lived tokens, rate limiting, input validation, audit logging.
- • Network: VLAN segmentation for IoT, least‑privilege firewall rules.
- • Secrets: separate KMS or vault where available; rotated credentials and keys.

### Reliability and scale
- • Broker HA: clustered MQTT or active/standby with persistence; retained LWT topics for presence.
- • Backpressure/resilience: gateway store‑and‑forward, bounded queues, exponential backoff, jitter.
- • SLOs: end‑to‑end telemetry ≤ 200 ms (LAN), ≤ 500 ms (WAN); command execution ≤ 1 s; WebRTC latency ≤ 150 ms.
- • Throughput: 10k+ devices and 10k msg/s supported with horizontal scaling (API/broker/db sharding).

### Data model and topics
- • Canonical payload fields: `device_id`, `timestamp`, `temperature`, `humidity`, `pressure`, `gas_resistance`, `light_level`, `sound_level`, `motion`, `battery`, `rssi`, `free_heap`.
- • Namespacing and conventions: kebab‑case topic suffixes, versioned schemas where needed, server‑side validation.

### Automations and rules
- • Thresholds: fire alerts when values cross configured bounds (with cooldowns).
- • Schedules: cron‑style or calendar‑based device control.
- • Scenes: orchestrate multiple actuators atomically.
- • Presence/motion: instant event → action mapping via gateway or backend rules engine.

### Developer experience
- • Repos and structure: devices/gateway/backend/frontend under `IoT_Smart_System/`.
- • Quickstart: npm scripts for API/UI, PlatformIO for firmware, Docker Compose for infra.
- • API docs: Swagger at `/api-docs`; WS event contracts documented.
- • Code style: typed models, explicit error handling, early returns, and readable naming.

### Testing and CI/CD
- • Unit/integration/E2E/security tests; realistic MQTT and WS integration harnesses.
- • Performance/load: Artillery for API, custom MQTT stress tools.
- • Hardware‑in‑loop: serial/MQTT test scripts for ESP32 and gateway.
- • CI pipelines: build, test, coverage, container builds, and deploy gates.

### Observability and operations
- • Metrics: Prometheus exporters for API, broker, and node; Grafana dashboards (uptime, msg rate, latencies).
- • Logs: ELK/EFK stack integration; correlation IDs across services.
- • Backups and DR: automated Mongo/Influx backups, restore scripts, periodic recovery drills.
- • Health checks: HTTP and broker probes; alerting on error budgets and SLA breaches.

### Deployment options
- • Single node: Docker Compose (quick production or pilot).
- • Cluster: Kubernetes (HA API/broker/db), Nginx ingress with TLS, horizontal autoscaling.
- • On‑prem/edge: gateway‑only with intermittent sync to cloud; local control keeps functioning offline.

### Business and GTM (optional)
- • SKU kits and costing models; CE/FCC/RoHS readiness; QC (IQC/IPQC/FQC), AOI/ICT/FCT, burn‑in workflows.
- • Launch plan, messaging, ICP personas; SLA and RMA templates.
- • See `docs/business/` for production and marketing materials.

### Primary use cases
- • Smart home/buildings: environmental comfort, safety, energy, presence‑aware automations.
- • Smart agriculture: long‑range sensing (LoRa), irrigation control, solar power, offline‑friendly.
- • Remote surveillance: low‑latency video, motion alerts, video analytics (optional Jetson).

### Roadmap highlights
- • Matter/Thread integration; multi‑region clusters; fine‑grained policy engine.
- • Edge analytics on gateway (TinyML/TFLite) for anomaly detection.
- • Plug‑in marketplace for device drivers and automations.

Where to start:
- • Architecture and diagrams: `docs/IoT_System_Blueprint.md`
- • Hardware/firmware: `docs/hardware_guide/firmware_guide.md` and `hardware/esp32_firmware/`
- • Backend/API: `backend/` (Swagger docs at `/api-docs`)
- • Web/Mobile apps: `frontend/web_dashboard/`, `frontend/mobile_app/`
- • Deployment/testing: `docs/deployment/`

- I added a comprehensive English overview you can paste into `README.md` or use on your website and collateral.