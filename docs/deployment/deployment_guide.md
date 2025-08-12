# 🚀 راهنمای کامل استقرار سیستم IoT

## 📋 جدول محتویات

1. [پیش‌نیازهای سیستم](#prerequisites)
2. [استقرار Backend](#backend-deployment)
3. [استقرار Frontend](#frontend-deployment)
4. [استقرار موبایل](#mobile-deployment)
5. [پیکربندی Hardware](#hardware-setup)
6. [مانیتورینگ و Logging](#monitoring)
7. [امنیت و SSL](#security)
8. [Backup و بازیابی](#backup)
9. [مقیاس‌پذیری](#scaling)
10. [نگهداری و به‌روزرسانی](#maintenance)

## 🛠️ Prerequisites

### سیستم‌عامل و Hardware

```bash
# مینیمم سیستم مورد نیاز:
# CPU: 4 cores, 2.4GHz
# RAM: 8GB
# Storage: 100GB SSD
# Network: 1Gbps

# سیستم‌عامل‌های پشتیبانی شده:
# - Ubuntu 20.04+ LTS
# - CentOS 8+
# - Docker (توصیه شده)
```

### نرم‌افزارهای مورد نیاز

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3.9+
sudo apt install python3.9 python3.9-pip python3.9-venv

# Install Git
sudo apt install git

# Install essential tools
sudo apt install htop nginx certbot ufw fail2ban
```

## 🔧 Backend Deployment

### Docker Compose Setup (روش توصیه شده)

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  # MongoDB Database
  mongodb:
    image: mongo:6.0
    container_name: iot_mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: iot_smart_system
    volumes:
      - mongodb_data:/data/db
      - ./mongodb/init:/docker-entrypoint-initdb.d:ro
    ports:
      - "27017:27017"
    networks:
      - iot_network

  # InfluxDB for Time Series Data
  influxdb:
    image: influxdb:2.7
    container_name: iot_influxdb
    restart: unless-stopped
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: ${INFLUX_USERNAME}
      DOCKER_INFLUXDB_INIT_PASSWORD: ${INFLUX_PASSWORD}
      DOCKER_INFLUXDB_INIT_ORG: iot_org
      DOCKER_INFLUXDB_INIT_BUCKET: iot_data
    volumes:
      - influxdb_data:/var/lib/influxdb2
    ports:
      - "8086:8086"
    networks:
      - iot_network

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: iot_redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - iot_network

  # MQTT Broker (Mosquitto)
  mosquitto:
    image: eclipse-mosquitto:2.0
    container_name: iot_mosquitto
    restart: unless-stopped
    volumes:
      - ./mosquitto/config:/mosquitto/config:ro
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
      - ./ssl:/mosquitto/certs:ro
    ports:
      - "1883:1883"
      - "8883:8883"
      - "9001:9001"
    networks:
      - iot_network

  # Backend API Server
  api_server:
    build:
      context: ./backend
      dockerfile: Dockerfile.production
    container_name: iot_api_server
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      MONGODB_URI: mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@mongodb:27017/iot_smart_system?authSource=admin
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      MQTT_BROKER: mqtt://mosquitto:1883
      MQTT_USERNAME: ${MQTT_USERNAME}
      MQTT_PASSWORD: ${MQTT_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      INFLUXDB_URL: http://influxdb:8086
      INFLUXDB_TOKEN: ${INFLUX_TOKEN}
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    ports:
      - "3000:3000"
    depends_on:
      - mongodb
      - redis
      - mosquitto
      - influxdb
    networks:
      - iot_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: iot_nginx
    restart: unless-stopped
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/sites:/etc/nginx/sites-available:ro
      - ./ssl:/etc/nginx/ssl:ro
      - web_build:/usr/share/nginx/html
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api_server
    networks:
      - iot_network

  # Grafana for Monitoring
  grafana:
    image: grafana/grafana:latest
    container_name: iot_grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_INSTALL_PLUGINS: grafana-clock-panel,grafana-simple-json-datasource
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3001:3000"
    networks:
      - iot_network

volumes:
  mongodb_data:
  influxdb_data:
  redis_data:
  grafana_data:
  web_build:

networks:
  iot_network:
    driver: bridge
```

### Environment Variables

```bash
# .env.production
# Database
MONGO_ROOT_USER=iot_admin
MONGO_ROOT_PASSWORD=secure_mongo_password_123
REDIS_PASSWORD=secure_redis_password_123

# InfluxDB
INFLUX_USERNAME=iot_influx_admin
INFLUX_PASSWORD=secure_influx_password_123
INFLUX_TOKEN=your_influx_token_here

# MQTT
MQTT_USERNAME=iot_mqtt_user
MQTT_PASSWORD=secure_mqtt_password_123

# Security
JWT_SECRET=your_very_secure_jwt_secret_here_minimum_256_bits
ENCRYPTION_KEY=your_encryption_key_here

# Grafana
GRAFANA_PASSWORD=secure_grafana_password_123

# Email (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# External APIs
WEATHER_API_KEY=your_weather_api_key
NOTIFICATION_SERVICE_KEY=your_notification_key
```

### Deployment Commands

```bash
# Clone repository
git clone https://github.com/your-username/IoT_Smart_System.git
cd IoT_Smart_System

# Setup environment
cp .env.example .env.production
# Edit .env.production with your values

# Build and start services
docker-compose -f docker-compose.production.yml up -d

# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Check status
docker-compose -f docker-compose.production.yml ps
```

## 🌐 Frontend Deployment

### Web Dashboard Build

```bash
# Build production version
cd frontend/web_dashboard

# Install dependencies
npm ci --only=production

# Build for production
npm run build

# Copy build files to nginx volume
docker cp build/. iot_nginx:/usr/share/nginx/html/
```

### Nginx Configuration

```nginx
# nginx/nginx.conf
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Include site configurations
    include /etc/nginx/sites-available/*;
}
```

```nginx
# nginx/sites/iot-system.conf
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Main Site
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Root directory
    root /usr/share/nginx/html;
    index index.html index.htm;

    # API Proxy
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://api_server:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket Proxy
    location /socket.io/ {
        proxy_pass http://api_server:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security
    location ~ /\. {
        deny all;
    }
}
```

## 📱 Mobile Deployment

### Android Build

```bash
cd frontend/mobile_app

# Install dependencies
npm install

# Build for Android
npx expo build:android --type=apk

# Or using EAS Build (recommended)
npx eas build --platform android --profile production
```

### iOS Build

```bash
# Build for iOS
npx expo build:ios --type=archive

# Or using EAS Build
npx eas build --platform ios --profile production
```

### App Store Deployment

```json
// app.json - Production Configuration
{
  "expo": {
    "name": "IoT Smart System",
    "slug": "iot-smart-system",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "updates": {
      "fallbackToCacheTimeout": 0,
      "url": "https://u.expo.dev/your-project-id"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.iotsmartsystem.app",
      "buildNumber": "1"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "com.iotsmartsystem.app",
      "versionCode": 1
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      },
      "apiUrl": "https://your-domain.com/api"
    }
  }
}
```

## 🔧 Hardware Setup

### ESP32 Configuration

```cpp
// hardware/esp32_firmware/src/config.h
#ifndef CONFIG_H
#define CONFIG_H

// Production WiFi Settings
#define WIFI_SSID "IoT_Production_Network"
#define WIFI_PASSWORD "your_secure_wifi_password"

// Production MQTT Settings
#define MQTT_SERVER "your-domain.com"
#define MQTT_PORT 8883
#define MQTT_USER "iot_device_user"
#define MQTT_PASS "secure_device_password"

// Device Configuration
#define DEVICE_TYPE "sensor"
#define UPDATE_INTERVAL 30000  // 30 seconds
#define DEEP_SLEEP_ENABLED true
#define DEEP_SLEEP_DURATION 60000000  // 60 seconds in microseconds

// Security
#define ENABLE_TLS true
#define VERIFY_CERTIFICATE true

// Debugging (disable in production)
#define DEBUG_MODE false
#define SERIAL_DEBUG false

#endif
```

### Raspberry Pi Gateway Setup

```bash
# Install Raspberry Pi OS Lite
# Flash to SD card using Raspberry Pi Imager

# Initial setup
sudo raspi-config
# Enable SSH, I2C, SPI

# Update system
sudo apt update && sudo apt upgrade -y

# Install Python dependencies
sudo apt install python3-pip python3-venv
python3 -m venv /opt/iot_gateway
source /opt/iot_gateway/bin/activate
pip install -r requirements.txt

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker pi

# Setup as service
sudo cp scripts/iot-gateway.service /etc/systemd/system/
sudo systemctl enable iot-gateway
sudo systemctl start iot-gateway
```

```ini
# scripts/iot-gateway.service
[Unit]
Description=IoT Gateway Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/iot_gateway
Environment=PATH=/opt/iot_gateway/bin
ExecStart=/opt/iot_gateway/bin/python /opt/iot_gateway/gateway_main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Device Provisioning Script

```python
# tools/device_provisioning.py
import requests
import json
import qrcode
import uuid

def provision_device(device_info):
    """Provision a new IoT device"""
    
    # Generate unique device ID
    device_id = f"IOT-{uuid.uuid4().hex[:8].upper()}"
    
    # Device configuration
    config = {
        "deviceId": device_id,
        "name": device_info["name"],
        "type": device_info["type"],
        "location": device_info["location"],
        "wifiCredentials": {
            "ssid": "IoT_Production_Network",
            "password": "your_secure_wifi_password"
        },
        "mqttCredentials": {
            "server": "your-domain.com",
            "port": 8883,
            "username": f"device_{device_id.lower()}",
            "password": generate_device_password()
        },
        "updateInterval": 30000,
        "enableTLS": True
    }
    
    # Register device in backend
    response = requests.post(
        "https://your-domain.com/api/devices",
        json=config,
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )
    
    if response.status_code == 201:
        print(f"✅ Device {device_id} provisioned successfully")
        
        # Generate QR code for easy setup
        qr_data = json.dumps(config)
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        qr_img = qr.make_image(fill_color="black", back_color="white")
        qr_img.save(f"qr_codes/{device_id}.png")
        
        print(f"📱 QR Code saved: qr_codes/{device_id}.png")
        return device_id
    else:
        print(f"❌ Failed to provision device: {response.text}")
        return None

def generate_device_password():
    """Generate secure random password for device"""
    import secrets
    import string
    
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for i in range(16))

# Usage example
if __name__ == "__main__":
    device_info = {
        "name": "Living Room Sensor",
        "type": "environmental",
        "location": {
            "room": "Living Room",
            "building": "Main House",
            "floor": 1
        }
    }
    
    provision_device(device_info)
```

## 📊 Monitoring & Logging

### Grafana Dashboard Setup

```json
// grafana/dashboards/iot-overview.json
{
  "dashboard": {
    "title": "IoT System Overview",
    "panels": [
      {
        "title": "Active Devices",
        "type": "stat",
        "targets": [
          {
            "expr": "count(iot_device_status{status=\"online\"})",
            "legendFormat": "Online Devices"
          }
        ]
      },
      {
        "title": "Temperature Trend",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(iot_sensor_temperature) by (location)",
            "legendFormat": "{{location}}"
          }
        ]
      },
      {
        "title": "System Health",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"iot-api\"}",
            "legendFormat": "API Server"
          },
          {
            "expr": "up{job=\"iot-mqtt\"}",
            "legendFormat": "MQTT Broker"
          }
        ]
      }
    ]
  }
}
```

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'iot-api'
    static_configs:
      - targets: ['api_server:3000']
    metrics_path: '/metrics'
    
  - job_name: 'iot-mqtt'
    static_configs:
      - targets: ['mosquitto:9234']
      
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
      
  - job_name: 'mongodb-exporter'
    static_configs:
      - targets: ['mongodb-exporter:9216']
```

### Log Aggregation (ELK Stack)

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.8.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.8.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline:ro
      - ./logs:/logs:ro
    ports:
      - "5044:5044"
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.8.0
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

## 🔒 Security & SSL

### SSL Certificate Setup (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
sudo crontab -e
# Add line:
0 12 * * * /usr/bin/certbot renew --quiet
```

### Firewall Configuration

```bash
# Setup UFW firewall
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow MQTT
sudo ufw allow 1883/tcp
sudo ufw allow 8883/tcp

# Allow monitoring
sudo ufw allow from 10.0.0.0/8 to any port 3001

# Enable firewall
sudo ufw --force enable
sudo ufw status
```

### Fail2Ban Configuration

```ini
# /etc/fail2ban/jail.local
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10

[iot-api]
enabled = true
filter = iot-api
logpath = /opt/iot_system/logs/api.log
port = 443
maxretry = 10
bantime = 1800
```

## 💾 Backup & Recovery

### Automated Backup Script

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backup/iot_system"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="iot_backup_$DATE"

# Create backup directory
mkdir -p $BACKUP_DIR/$BACKUP_NAME

echo "🔄 Starting IoT System Backup..."

# Backup MongoDB
echo "📊 Backing up MongoDB..."
docker exec iot_mongodb mongodump --out /backup/mongodb_$DATE
docker cp iot_mongodb:/backup/mongodb_$DATE $BACKUP_DIR/$BACKUP_NAME/

# Backup InfluxDB
echo "📈 Backing up InfluxDB..."
docker exec iot_influxdb influx backup /backup/influxdb_$DATE
docker cp iot_influxdb:/backup/influxdb_$DATE $BACKUP_DIR/$BACKUP_NAME/

# Backup configuration files
echo "⚙️ Backing up configuration..."
cp -r ./docker-compose.yml $BACKUP_DIR/$BACKUP_NAME/
cp -r ./nginx/ $BACKUP_DIR/$BACKUP_NAME/
cp -r ./mosquitto/ $BACKUP_DIR/$BACKUP_NAME/
cp .env.production $BACKUP_DIR/$BACKUP_NAME/

# Backup uploaded files
echo "📁 Backing up uploads..."
docker cp iot_api_server:/app/uploads $BACKUP_DIR/$BACKUP_NAME/

# Backup SSL certificates
echo "🔒 Backing up SSL certificates..."
cp -r /etc/letsencrypt $BACKUP_DIR/$BACKUP_NAME/

# Create compressed archive
echo "📦 Creating compressed archive..."
tar -czf $BACKUP_DIR/$BACKUP_NAME.tar.gz -C $BACKUP_DIR $BACKUP_NAME
rm -rf $BACKUP_DIR/$BACKUP_NAME

# Upload to cloud storage (optional)
if [ ! -z "$AWS_S3_BUCKET" ]; then
    echo "☁️ Uploading to S3..."
    aws s3 cp $BACKUP_DIR/$BACKUP_NAME.tar.gz s3://$AWS_S3_BUCKET/backups/
fi

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "iot_backup_*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: $BACKUP_NAME.tar.gz"
```

### Recovery Script

```bash
#!/bin/bash
# scripts/restore.sh

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    exit 1
fi

BACKUP_FILE=$1
RESTORE_DIR="/tmp/iot_restore"

echo "🔄 Starting IoT System Restore from $BACKUP_FILE..."

# Extract backup
mkdir -p $RESTORE_DIR
tar -xzf $BACKUP_FILE -C $RESTORE_DIR

BACKUP_NAME=$(basename $BACKUP_FILE .tar.gz)

# Stop services
echo "⏹️ Stopping services..."
docker-compose -f docker-compose.production.yml down

# Restore MongoDB
echo "📊 Restoring MongoDB..."
docker run --rm -v $RESTORE_DIR/$BACKUP_NAME/mongodb_*:/backup \
    -v mongodb_data:/data/db \
    mongo:6.0 \
    mongorestore --drop /backup

# Restore InfluxDB
echo "📈 Restoring InfluxDB..."
docker run --rm -v $RESTORE_DIR/$BACKUP_NAME/influxdb_*:/backup \
    -v influxdb_data:/var/lib/influxdb2 \
    influxdb:2.7 \
    influx restore /backup

# Restore configuration
echo "⚙️ Restoring configuration..."
cp -r $RESTORE_DIR/$BACKUP_NAME/nginx/ ./
cp -r $RESTORE_DIR/$BACKUP_NAME/mosquitto/ ./
cp $RESTORE_DIR/$BACKUP_NAME/.env.production ./

# Restore SSL certificates
echo "🔒 Restoring SSL certificates..."
sudo cp -r $RESTORE_DIR/$BACKUP_NAME/letsencrypt/* /etc/letsencrypt/

# Start services
echo "▶️ Starting services..."
docker-compose -f docker-compose.production.yml up -d

# Cleanup
rm -rf $RESTORE_DIR

echo "✅ Restore completed successfully!"
```

### Cron Jobs for Automation

```bash
# Setup cron jobs
sudo crontab -e

# Daily backup at 2 AM
0 2 * * * /opt/iot_system/scripts/backup.sh

# Weekly system update
0 3 * * 0 /opt/iot_system/scripts/update_system.sh

# Monthly log rotation
0 1 1 * * /opt/iot_system/scripts/rotate_logs.sh

# Health check every 5 minutes
*/5 * * * * /opt/iot_system/scripts/health_check.sh
```

## ⚡ Scaling & Performance

### Load Balancer Setup

```nginx
# nginx/upstream.conf
upstream api_backend {
    least_conn;
    server api_server_1:3000 max_fails=3 fail_timeout=30s;
    server api_server_2:3000 max_fails=3 fail_timeout=30s;
    server api_server_3:3000 max_fails=3 fail_timeout=30s;
}

upstream mqtt_backend {
    ip_hash;
    server mosquitto_1:1883;
    server mosquitto_2:1883;
    server mosquitto_3:1883;
}
```

### Docker Swarm Deployment

```yaml
# docker-compose.swarm.yml
version: '3.8'

services:
  api_server:
    image: iot_api_server:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    networks:
      - iot_overlay

  mosquitto:
    image: eclipse-mosquitto:2.0
    deploy:
      replicas: 3
      placement:
        constraints:
          - node.role == worker
    networks:
      - iot_overlay

networks:
  iot_overlay:
    driver: overlay
    attachable: true
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: iot-api-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: iot-api-server
  template:
    metadata:
      labels:
        app: iot-api-server
    spec:
      containers:
      - name: api-server
        image: iot_api_server:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: iot-secrets
              key: mongodb-uri
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: iot-api-service
spec:
  selector:
    app: iot-api-server
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## 🔧 Maintenance & Updates

### Zero-Downtime Deployment

```bash
#!/bin/bash
# scripts/zero_downtime_deploy.sh

NEW_VERSION=$1
if [ -z "$NEW_VERSION" ]; then
    echo "Usage: $0 <version>"
    exit 1
fi

echo "🚀 Starting zero-downtime deployment to version $NEW_VERSION..."

# Build new image
docker build -t iot_api_server:$NEW_VERSION ./backend/

# Tag as latest
docker tag iot_api_server:$NEW_VERSION iot_api_server:latest

# Rolling update
docker service update --image iot_api_server:$NEW_VERSION iot_api_server

# Wait for deployment
echo "⏳ Waiting for deployment to complete..."
docker service ps iot_api_server

# Health check
echo "🏥 Performing health check..."
for i in {1..30}; do
    if curl -f http://localhost/health; then
        echo "✅ Deployment successful!"
        exit 0
    fi
    echo "Waiting for health check... ($i/30)"
    sleep 10
done

echo "❌ Deployment failed health check"
exit 1
```

### System Update Script

```bash
#!/bin/bash
# scripts/update_system.sh

echo "🔄 Starting system update..."

# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.production.yml pull

# Restart services with new images
docker-compose -f docker-compose.production.yml up -d

# Cleanup old images
docker image prune -f

# Update certificates
sudo certbot renew --quiet

echo "✅ System update completed"
```

### Health Check Script

```bash
#!/bin/bash
# scripts/health_check.sh

ALERT_EMAIL="admin@your-domain.com"
LOG_FILE="/var/log/iot_health.log"

# Function to log and alert
log_and_alert() {
    echo "$(date): $1" >> $LOG_FILE
    if [ "$2" == "critical" ]; then
        echo "$1" | mail -s "IoT System Alert" $ALERT_EMAIL
    fi
}

# Check API server
if ! curl -f http://localhost/health > /dev/null 2>&1; then
    log_and_alert "❌ API server health check failed" critical
else
    log_and_alert "✅ API server healthy"
fi

# Check MQTT broker
if ! nc -z localhost 1883; then
    log_and_alert "❌ MQTT broker unreachable" critical
else
    log_and_alert "✅ MQTT broker healthy"
fi

# Check database connections
if ! docker exec iot_mongodb mongo --eval "db.adminCommand('ismaster')" > /dev/null 2>&1; then
    log_and_alert "❌ MongoDB connection failed" critical
else
    log_and_alert "✅ MongoDB healthy"
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    log_and_alert "⚠️ Disk usage high: ${DISK_USAGE}%" critical
fi

# Check memory usage
MEM_USAGE=$(free | awk 'NR==2{print $3*100/$2}')
if [ $(echo "$MEM_USAGE > 90" | bc) -eq 1 ]; then
    log_and_alert "⚠️ Memory usage high: ${MEM_USAGE}%"
fi
```

## 📋 Deployment Checklist

### Pre-Deployment

- [ ] **Environment Setup**
  - [ ] Server provisioned and configured
  - [ ] Domain name configured
  - [ ] SSL certificates obtained
  - [ ] Firewall rules configured

- [ ] **Database Setup**
  - [ ] MongoDB cluster configured
  - [ ] InfluxDB initialized
  - [ ] Redis configured with persistence

- [ ] **Security**
  - [ ] All passwords changed from defaults
  - [ ] SSH keys configured
  - [ ] Fail2Ban installed and configured
  - [ ] Regular security updates scheduled

### Deployment

- [ ] **Backend**
  - [ ] Environment variables configured
  - [ ] Docker containers started
  - [ ] Health checks passing
  - [ ] API endpoints accessible

- [ ] **Frontend**
  - [ ] Web dashboard built and deployed
  - [ ] Mobile apps built and published
  - [ ] CDN configured (if applicable)

- [ ] **Hardware**
  - [ ] Device firmware uploaded
  - [ ] Gateway configured
  - [ ] Network connectivity verified

### Post-Deployment

- [ ] **Testing**
  - [ ] End-to-end tests passing
  - [ ] Performance tests satisfactory
  - [ ] Security scans clean

- [ ] **Monitoring**
  - [ ] Grafana dashboards configured
  - [ ] Alerting rules set up
  - [ ] Log aggregation working

- [ ] **Backup**
  - [ ] Backup scripts tested
  - [ ] Recovery procedures verified
  - [ ] Backup schedules configured

- [ ] **Documentation**
  - [ ] Deployment documentation updated
  - [ ] User manuals prepared
  - [ ] Support procedures documented

---

**نکته:** این راهنمای استقرار باید بر اساس نیازهای خاص محیط production شما تطبیق داده شود.
