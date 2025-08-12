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
