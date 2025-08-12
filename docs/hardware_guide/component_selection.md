# 🔧 راهنمای انتخاب کامپوننت‌های سخت‌افزاری

## 📊 جدول کامل قطعات

### 🖥️ پردازنده‌ها و Gateway

| نام قطعه | مدل | ویژگی‌ها | قیمت | کاربرد |
|----------|-----|----------|-------|--------|
| **ESP32-S3** | ESP32-S3-WROOM-1 | WiFi 6, Zigbee 3.0, 8MB PSRAM | $12-15 | Main controller |
| **Raspberry Pi 4** | Model B 4GB | ARM Cortex-A72, WiFi, Bluetooth | $75-85 | Gateway & Video |
| **NVIDIA Jetson Nano** | Developer Kit | GPU 128-core, 4GB RAM | $149 | AI Video Processing |

### 📡 ماژول‌های ارتباطی

| نام قطعه | مدل | پروتکل | برد | قیمت |
|----------|-----|---------|-----|-------|
| **ESP32-C6** | ESP32-C6-WROOM-1 | Zigbee 3.0, Thread, WiFi 6 | 30m | $8-10 |
| **SX1276** | LoRa Module | LoRaWAN | 15km | $15-20 |
| **nRF52840** | Nordic Semi | Zigbee, Thread, BLE | 50m | $25-30 |
| **Z-Wave Module** | ZM5304 | Z-Wave Plus | 40m | $35-45 |

### 🌡️ سنسورهای محیطی

| نوع سنسور | مدل | دقت | رنج | قیمت |
|-----------|-----|------|-----|-------|
| **دما/رطوبت** | SHT30 | ±0.2°C, ±2%RH | -40~125°C | $3-5 |
| **فشار هوا** | BMP280 | ±0.12hPa | 300-1100hPa | $2-3 |
| **کیفیت هوا** | BME688 | Gas, VOC, IAQ | Multiple | $12-15 |
| **نور** | BH1750 | ±20% | 1-65535 lux | $1-2 |
| **صدا** | MAX4466 | Adjustable Gain | 20Hz-20kHz | $3-4 |

### 👤 سنسورهای حرکت و حضور

| نوع | مدل | تکنولوژی | برد | قیمت |
|-----|-----|----------|-----|-------|
| **PIR Motion** | HC-SR501 | Passive Infrared | 7m | $2-3 |
| **Radar Motion** | RCWL-0516 | Microwave | 5-9m | $3-4 |
| **mmWave** | LD2410 | 24GHz Radar | 6m | $15-20 |
| **Camera PIR** | AM312 | Mini PIR | 3m | $1-2 |

### 📹 دوربین‌ها و تصویربرداری

| نوع | مدل | رزولوشن | ویژگی | قیمت |
|-----|-----|----------|-------|-------|
| **ESP32-CAM** | AI-Thinker | 2MP | WiFi, Face Detection | $8-12 |
| **Pi Camera V3** | Raspberry Pi | 12MP | AutoFocus, HDR | $25-30 |
| **USB Camera** | Logitech C920 | 1080p | H.264, AutoFocus | $50-70 |
| **IP Camera** | Hikvision DS-2CD2143G0-I | 4MP | PoE, Night Vision | $80-120 |

### 🏠 دستگاه‌های کنترلی

| نوع | مدل | ولتاژ | توان | قیمت |
|-----|-----|-------|------|-------|
| **Smart Relay** | Sonoff Basic R3 | 230V AC | 10A | $5-8 |
| **Smart Switch** | ESP32 Switch Module | 12-24V | 5A | $8-12 |
| **Smart Dimmer** | TRIAC Module | 230V AC | 300W | $12-18 |
| **Motor Driver** | L298N | 5-35V | 2A | $3-5 |

### 🔋 منابع تغذیه و انرژی

| نوع | مدل | ولتاژ خروجی | جریان | قیمت |
|-----|-----|------------|-------|-------|
| **Solar Panel** | 6V 2W | 6V | 330mA | $8-12 |
| **Battery 18650** | Samsung 25R | 3.7V | 2500mAh | $5-8 |
| **Power Bank** | Anker 10000mAh | 5V | 2.4A | $25-35 |
| **AC Adapter** | 12V 2A | 12V | 2A | $8-15 |

## 🛒 Kit‌های پیشنهادی

### 🏠 Kit خانه هوشمند (Starter)
```
- 1x ESP32-S3 Gateway
- 5x ESP32-C6 Sensor Nodes
- 3x SHT30 (دما/رطوبت)
- 2x PIR Motion
- 1x Smart Relay
- قیمت کل: ~$85-110
```

### 🌾 Kit کشاورزی هوشمند
```
- 1x Raspberry Pi 4 Gateway
- 3x ESP32 + LoRa Modules
- 5x SHT30 Sensors
- 2x Soil Moisture Sensors
- 1x Solar Panel + Battery
- قیمت کل: ~$150-200
```

### 🏢 Kit نظارت تصویری
```
- 1x NVIDIA Jetson Nano
- 4x ESP32-CAM
- 2x IP Cameras
- 1x NVR Storage
- Network Switch PoE
- قیمت کل: ~$400-550
```

## 🔌 اتصالات و رابط‌ها

### GPIO Pinout ESP32-S3
```
Pin 1-2:   Power (3.3V, GND)
Pin 4-5:   I2C (SDA, SCL)
Pin 6-7:   SPI (MOSI, MISO)
Pin 8:     SPI Clock
Pin 9-10:  UART (RX, TX)
Pin 11-14: Digital GPIO
Pin 15-18: Analog ADC
```

### Interface پروتکل‌ها
- **I2C:** سنسورهای دقیق (SHT30, BMP280)
- **SPI:** ماژول‌های سریع (LoRa, SD Card)
- **UART:** ارتباط با سایر MCU
- **ADC:** سنسورهای آنالوگ
- **PWM:** کنترل dimmer و motor

## ⚡ محاسبه مصرف انرژی

### حالت عادی (Active)
```
ESP32-S3:          80mA @ 3.3V = 264mW
SHT30 Sensor:      1.5mA @ 3.3V = 5mW
PIR Motion:        65μA @ 3.3V = 0.2mW
LoRa Module:       120mA @ 3.3V = 396mW (TX)
جمع کل:           ~665mW
```

### حالت خواب (Deep Sleep)
```
ESP32-S3:          10μA @ 3.3V = 0.033mW
SHT30:             0.6μA @ 3.3V = 0.002mW
PIR:               65μA @ 3.3V = 0.2mW
جمع کل:           ~0.235mW
```

### تخمین عمر باتری
```
باتری 18650 (2500mAh):
- حالت عادی: ~15 ساعت
- حالت ترکیبی (90% sleep): ~45 روز
- با panel خورشیدی: نامحدود
```

## 🛠️ ابزارآلات مورد نیاز

### برای مونتاژ
- **هویه:** Weller WE1010NA (60W)
- **Multimeter:** Fluke 117
- **Oscilloscope:** Rigol DS1054Z
- **Power Supply:** Rigol DP832

### برای PCB
- **KiCad:** طراحی مدار
- **JLCPCB:** ساخت PCB
- **Pick & Place:** مونتاژ SMD

## 📦 تأمین‌کنندگان

### بین‌المللی
- **Digikey:** قطعات الکترونیکی
- **Mouser:** کامپوننت‌های تخصصی
- **AliExpress:** قطعات ارزان
- **Arrow:** سنسورها و MCU

### ایران
- **الکتروشاپ:** قطعات عمومی
- **رباتیک شاپ:** ماژول‌های آماده
- **ایران IC:** میکروکنترلر
- **فیدار:** سنسورها

## 🎯 نکات کلیدی انتخاب

### عوامل مهم:
1. **سازگاری:** پروتکل‌های ارتباطی
2. **مصرف انرژی:** برای دستگاه‌های باتری‌دار
3. **قیمت:** تعادل cost/performance
4. **در دسترس بودن:** تأمین آسان قطعات
5. **پشتیبانی:** documentation و کامیونیتی

### اولویت‌بندی:
1. **ESP32-S3** - بهترین MCU همه‌کاره
2. **Zigbee 3.0** - بهترین پروتکل سنسور
3. **MQTT/TLS** - بهترین ارتباط cloud
4. **InfluxDB** - بهترین time-series DB

## 📈 مقیاس‌پذیری

### تولید کم (1-100 واحد)
- استفاده از ماژول‌های آماده
- مونتاژ دستی
- تست تک‌تک

### تولید متوسط (100-1000 واحد)
- PCB سفارشی
- مونتاژ نیمه‌اتوماتیک
- تست خودکار

### تولید انبوه (1000+ واحد)
- طراحی ASIC
- خط تولید اتوماتیک
- کنترل کیفیت ISO

---

**نکته:** قیمت‌ها در دلار آمریکا و قابل تغییر هستند. برای خرید عمده تخفیف قابل توجهی در نظر بگیرید.
