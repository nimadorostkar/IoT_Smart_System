# 🧪 راهنمای کامل تست سیستم IoT

## 📋 جدول محتویات

1. [تست‌های واحد (Unit Tests)](#unit-tests)
2. [تست‌های یکپارچگی (Integration Tests)](#integration-tests)
3. [تست‌های عملکرد (Performance Tests)](#performance-tests)
4. [تست‌های امنیت (Security Tests)](#security-tests)
5. [تست‌های مقاومت (Stress Tests)](#stress-tests)
6. [تست‌های End-to-End](#end-to-end-tests)
7. [تست‌های Hardware](#hardware-tests)
8. [مانیتورینگ و Logging](#monitoring)

## 🔧 Unit Tests

### Backend API Tests

```bash
# نصب dependencies
cd backend
npm install --save-dev jest supertest

# اجرای تست‌ها
npm test

# اجرای تست‌ها با coverage
npm run test:coverage
```

#### مثال تست API:

```javascript
// backend/tests/api/devices.test.js
const request = require('supertest');
const app = require('../../src/server');
const { Device } = require('../../src/models/Device');

describe('Device API Tests', () => {
  beforeEach(async () => {
    await Device.deleteMany({});
  });

  test('Should create a new device', async () => {
    const deviceData = {
      deviceId: 'TEST-001',
      name: 'Test Sensor',
      type: 'sensor',
      location: { room: 'Living Room' }
    };

    const response = await request(app)
      .post('/api/devices')
      .send(deviceData)
      .expect(201);

    expect(response.body.deviceId).toBe(deviceData.deviceId);
    expect(response.body.name).toBe(deviceData.name);
  });

  test('Should get all devices', async () => {
    // Create test devices
    await Device.create([
      { deviceId: 'TEST-001', name: 'Device 1', type: 'sensor' },
      { deviceId: 'TEST-002', name: 'Device 2', type: 'actuator' }
    ]);

    const response = await request(app)
      .get('/api/devices')
      .expect(200);

    expect(response.body.length).toBe(2);
  });

  test('Should update device status', async () => {
    const device = await Device.create({
      deviceId: 'TEST-001',
      name: 'Test Device',
      type: 'sensor'
    });

    const updateData = {
      'status.isOnline': true,
      'status.batteryLevel': 85
    };

    const response = await request(app)
      .patch(`/api/devices/${device.deviceId}/status`)
      .send(updateData)
      .expect(200);

    expect(response.body.status.isOnline).toBe(true);
    expect(response.body.status.batteryLevel).toBe(85);
  });
});
```

### Frontend Tests

```bash
# Web Dashboard Tests
cd frontend/web_dashboard
npm test

# Mobile App Tests  
cd frontend/mobile_app
npm test
```

#### مثال تست React Component:

```javascript
// frontend/web_dashboard/src/components/__tests__/Dashboard.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import Dashboard from '../pages/Dashboard';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

describe('Dashboard Component', () => {
  test('renders dashboard with stats', async () => {
    const queryClient = createTestQueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    expect(screen.getByText('داشبورد مدیریت')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('کل دستگاه‌ها')).toBeInTheDocument();
    });
  });

  test('handles device control', async () => {
    const queryClient = createTestQueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    const controlButton = await screen.findByText('روشن کردن رله');
    fireEvent.click(controlButton);

    await waitFor(() => {
      expect(screen.getByText('دستور ارسال شد')).toBeInTheDocument();
    });
  });
});
```

### ESP32 Firmware Tests

```cpp
// hardware/esp32_firmware/test/test_sensors.cpp
#include <unity.h>
#include "main.cpp"

void test_sht31_reading() {
    float temp = sht31.readTemperature();
    float humidity = sht31.readHumidity();
    
    TEST_ASSERT_TRUE(!isnan(temp));
    TEST_ASSERT_TRUE(!isnan(humidity));
    TEST_ASSERT_TRUE(temp > -40 && temp < 125);
    TEST_ASSERT_TRUE(humidity >= 0 && humidity <= 100);
}

void test_mqtt_connection() {
    bool connected = mqtt.connected();
    TEST_ASSERT_TRUE(connected);
}

void test_sensor_data_format() {
    StaticJsonDocument<512> doc;
    doc["device_id"] = deviceId;
    doc["temperature"] = 25.5;
    doc["humidity"] = 60.0;
    
    String payload;
    serializeJson(doc, payload);
    
    TEST_ASSERT_TRUE(payload.length() > 0);
    TEST_ASSERT_TRUE(payload.indexOf("device_id") > 0);
}

void setup() {
    UNITY_BEGIN();
    RUN_TEST(test_sht31_reading);
    RUN_TEST(test_mqtt_connection);
    RUN_TEST(test_sensor_data_format);
    UNITY_END();
}

void loop() {}
```

## 🔗 Integration Tests

### MQTT Communication Test

```python
# tools/testing/mqtt_integration_test.py
import paho.mqtt.client as mqtt
import json
import time
import pytest

class MQTTIntegrationTest:
    def __init__(self):
        self.client = mqtt.Client()
        self.received_messages = []
        self.client.on_message = self.on_message
        
    def on_message(self, client, userdata, msg):
        payload = json.loads(msg.payload.decode())
        self.received_messages.append({
            'topic': msg.topic,
            'payload': payload,
            'timestamp': time.time()
        })
    
    def test_device_data_flow(self):
        # Connect to MQTT broker
        self.client.connect("localhost", 1883, 60)
        self.client.subscribe("devices/+/data")
        self.client.loop_start()
        
        # Simulate device data
        test_data = {
            "device_id": "TEST-001",
            "temperature": 25.5,
            "humidity": 60.0,
            "timestamp": int(time.time())
        }
        
        self.client.publish("devices/TEST-001/data", json.dumps(test_data))
        
        # Wait for message
        time.sleep(2)
        
        # Verify message received
        assert len(self.received_messages) > 0
        assert self.received_messages[0]['payload']['device_id'] == "TEST-001"
        
        self.client.loop_stop()
        self.client.disconnect()

if __name__ == "__main__":
    test = MQTTIntegrationTest()
    test.test_device_data_flow()
    print("✅ MQTT Integration Test Passed")
```

### Database Integration Test

```javascript
// backend/tests/integration/database.test.js
const mongoose = require('mongoose');
const { Device } = require('../../src/models/Device');
const { SensorData } = require('../../src/models/SensorData');

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Device.deleteMany({});
    await SensorData.deleteMany({});
  });

  test('Should save and retrieve sensor data', async () => {
    // Create device
    const device = await Device.create({
      deviceId: 'TEST-001',
      name: 'Test Sensor',
      type: 'sensor'
    });

    // Create sensor data
    const sensorData = await SensorData.create({
      deviceId: device.deviceId,
      temperature: 25.5,
      humidity: 60.0,
      timestamp: new Date()
    });

    // Retrieve data
    const retrievedData = await SensorData.findOne({ deviceId: device.deviceId });
    
    expect(retrievedData.temperature).toBe(25.5);
    expect(retrievedData.humidity).toBe(60.0);
  });

  test('Should handle device status updates', async () => {
    const device = await Device.create({
      deviceId: 'TEST-001',
      name: 'Test Device',
      type: 'sensor'
    });

    // Update status
    await device.updateStatus({
      isOnline: true,
      batteryLevel: 85,
      lastSeen: new Date()
    });

    const updatedDevice = await Device.findOne({ deviceId: 'TEST-001' });
    expect(updatedDevice.status.isOnline).toBe(true);
    expect(updatedDevice.status.batteryLevel).toBe(85);
  });
});
```

## ⚡ Performance Tests

### Load Testing with Artillery

```yaml
# tools/testing/load_test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "High load"

scenarios:
  - name: "API Load Test"
    weight: 70
    flow:
      - get:
          url: "/api/devices"
      - get:
          url: "/api/dashboard/stats"
      - post:
          url: "/api/devices/TEST-001/commands"
          json:
            command: "get_status"

  - name: "WebSocket Load Test"
    weight: 30
    engine: ws
    flow:
      - connect:
          url: "ws://localhost:3000"
      - send:
          payload: '{"type": "subscribe", "topic": "devices"}'
      - think: 10
```

اجرای تست:
```bash
npm install -g artillery
artillery run tools/testing/load_test.yml
```

### MQTT Performance Test

```python
# tools/testing/mqtt_performance_test.py
import paho.mqtt.client as mqtt
import threading
import time
import json
import statistics

class MQTTPerformanceTest:
    def __init__(self, num_clients=100, messages_per_client=100):
        self.num_clients = num_clients
        self.messages_per_client = messages_per_client
        self.results = []
        
    def client_worker(self, client_id):
        client = mqtt.Client(f"perf_test_{client_id}")
        
        start_time = time.time()
        client.connect("localhost", 1883, 60)
        
        for i in range(self.messages_per_client):
            data = {
                "device_id": f"PERF-{client_id:03d}",
                "temperature": 20 + (i % 20),
                "humidity": 40 + (i % 40),
                "timestamp": int(time.time())
            }
            
            publish_start = time.time()
            client.publish(f"devices/PERF-{client_id:03d}/data", json.dumps(data))
            publish_end = time.time()
            
            self.results.append(publish_end - publish_start)
            
            time.sleep(0.1)  # 10 Hz
        
        client.disconnect()
        
    def run_test(self):
        threads = []
        
        print(f"Starting performance test with {self.num_clients} clients...")
        start_time = time.time()
        
        for i in range(self.num_clients):
            thread = threading.Thread(target=self.client_worker, args=(i,))
            threads.append(thread)
            thread.start()
            
        for thread in threads:
            thread.join()
            
        end_time = time.time()
        
        # Calculate statistics
        total_messages = len(self.results)
        avg_latency = statistics.mean(self.results)
        max_latency = max(self.results)
        min_latency = min(self.results)
        throughput = total_messages / (end_time - start_time)
        
        print(f"\n📊 Performance Test Results:")
        print(f"Total Messages: {total_messages}")
        print(f"Average Latency: {avg_latency:.4f}s")
        print(f"Max Latency: {max_latency:.4f}s")
        print(f"Min Latency: {min_latency:.4f}s")
        print(f"Throughput: {throughput:.2f} msg/s")

if __name__ == "__main__":
    test = MQTTPerformanceTest(num_clients=50, messages_per_client=200)
    test.run_test()
```

## 🔒 Security Tests

### API Security Test

```javascript
// tools/testing/security_test.js
const request = require('supertest');
const app = require('../backend/src/server');

describe('Security Tests', () => {
  test('Should reject requests without authentication', async () => {
    await request(app)
      .get('/api/devices')
      .expect(401);
  });

  test('Should prevent SQL injection', async () => {
    const maliciousPayload = {
      deviceId: "'; DROP TABLE devices; --",
      name: "Malicious Device"
    };

    await request(app)
      .post('/api/devices')
      .send(maliciousPayload)
      .expect(400);
  });

  test('Should enforce rate limiting', async () => {
    const requests = Array(101).fill().map(() =>
      request(app).get('/api/devices')
    );

    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(res => res.status === 429);
    
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });

  test('Should validate input data', async () => {
    const invalidDevice = {
      deviceId: "", // Empty ID
      name: "A".repeat(1000), // Too long name
      type: "invalid_type" // Invalid type
    };

    await request(app)
      .post('/api/devices')
      .send(invalidDevice)
      .expect(400);
  });
});
```

### MQTT Security Test

```python
# tools/testing/mqtt_security_test.py
import paho.mqtt.client as mqtt
import ssl
import json

def test_mqtt_authentication():
    client = mqtt.Client()
    
    # Test without credentials
    try:
        client.connect("localhost", 1883, 60)
        assert False, "Should not connect without authentication"
    except:
        print("✅ Authentication required - PASS")
    
    # Test with invalid credentials
    client.username_pw_set("invalid_user", "invalid_pass")
    try:
        client.connect("localhost", 1883, 60)
        assert False, "Should not connect with invalid credentials"
    except:
        print("✅ Invalid credentials rejected - PASS")
    
    # Test with valid credentials
    client.username_pw_set("valid_user", "valid_pass")
    result = client.connect("localhost", 1883, 60)
    assert result == 0, "Should connect with valid credentials"
    print("✅ Valid credentials accepted - PASS")
    
    client.disconnect()

def test_mqtt_tls():
    client = mqtt.Client()
    
    # Configure TLS
    context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    
    client.tls_set_context(context)
    client.username_pw_set("test_user", "test_pass")
    
    try:
        client.connect("localhost", 8883, 60)
        print("✅ TLS connection successful - PASS")
        client.disconnect()
    except Exception as e:
        print(f"❌ TLS connection failed: {e}")

if __name__ == "__main__":
    test_mqtt_authentication()
    test_mqtt_tls()
```

## 💪 Stress Tests

### Memory Leak Test

```javascript
// tools/testing/memory_test.js
const request = require('supertest');
const app = require('../backend/src/server');

async function memoryLeakTest() {
  const initialMemory = process.memoryUsage();
  console.log('Initial memory:', initialMemory);
  
  // Simulate heavy load
  for (let i = 0; i < 10000; i++) {
    await request(app)
      .get('/api/devices')
      .expect(200);
    
    if (i % 1000 === 0) {
      const currentMemory = process.memoryUsage();
      const heapGrowth = currentMemory.heapUsed - initialMemory.heapUsed;
      console.log(`Iteration ${i}: Heap growth: ${heapGrowth / 1024 / 1024} MB`);
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
    }
  }
  
  const finalMemory = process.memoryUsage();
  const totalGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
  
  console.log('Final memory:', finalMemory);
  console.log('Total heap growth:', totalGrowth / 1024 / 1024, 'MB');
  
  // Check if memory growth is within acceptable limits
  if (totalGrowth > 100 * 1024 * 1024) { // 100MB
    console.error('❌ Potential memory leak detected!');
  } else {
    console.log('✅ Memory usage within acceptable limits');
  }
}

// Run with: node --expose-gc tools/testing/memory_test.js
memoryLeakTest();
```

### Connection Stress Test

```python
# tools/testing/connection_stress_test.py
import asyncio
import websockets
import json
import time

async def stress_test_websockets():
    connections = []
    
    async def create_connection(connection_id):
        try:
            uri = "ws://localhost:3000"
            websocket = await websockets.connect(uri)
            
            # Send periodic messages
            for i in range(100):
                message = {
                    "type": "sensor_data",
                    "device_id": f"STRESS-{connection_id:03d}",
                    "data": {
                        "temperature": 20 + i % 20,
                        "timestamp": int(time.time())
                    }
                }
                
                await websocket.send(json.dumps(message))
                await asyncio.sleep(0.1)
                
            await websocket.close()
            
        except Exception as e:
            print(f"Connection {connection_id} failed: {e}")
    
    # Create 1000 concurrent connections
    tasks = [create_connection(i) for i in range(1000)]
    
    start_time = time.time()
    await asyncio.gather(*tasks, return_exceptions=True)
    end_time = time.time()
    
    print(f"Stress test completed in {end_time - start_time:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(stress_test_websockets())
```

## 🔄 End-to-End Tests

### Cypress E2E Tests

```javascript
// frontend/web_dashboard/cypress/integration/dashboard.spec.js
describe('Dashboard E2E Tests', () => {
  beforeEach(() => {
    cy.login('admin@example.com', 'password');
    cy.visit('/dashboard');
  });

  it('should display dashboard with stats', () => {
    cy.get('[data-testid="dashboard-title"]').should('contain', 'داشبورد مدیریت');
    cy.get('[data-testid="total-devices"]').should('be.visible');
    cy.get('[data-testid="online-devices"]').should('be.visible');
  });

  it('should control device from dashboard', () => {
    cy.get('[data-testid="device-TEST-001"]').within(() => {
      cy.get('[data-testid="device-control-button"]').click();
    });
    
    cy.get('[data-testid="control-modal"]').should('be.visible');
    cy.get('[data-testid="turn-on-button"]').click();
    
    cy.get('.snackbar').should('contain', 'دستور ارسال شد');
  });

  it('should show real-time updates', () => {
    // Simulate real-time data
    cy.window().its('socket').invoke('emit', 'sensorData', {
      deviceId: 'TEST-001',
      data: { temperature: 25.5, humidity: 60 }
    });
    
    cy.get('[data-testid="device-TEST-001"]').within(() => {
      cy.get('[data-testid="temperature"]').should('contain', '25.5');
      cy.get('[data-testid="humidity"]').should('contain', '60');
    });
  });
});
```

### Mobile E2E Tests (Detox)

```javascript
// frontend/mobile_app/e2e/dashboard.e2e.js
const { device, expect, element, by } = require('detox');

describe('Mobile Dashboard', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should display dashboard screen', async () => {
    await expect(element(by.text('داشبورد مدیریت'))).toBeVisible();
    await expect(element(by.id('stats-container'))).toBeVisible();
  });

  it('should navigate to device details', async () => {
    await element(by.id('device-TEST-001')).tap();
    await expect(element(by.text('جزئیات دستگاه'))).toBeVisible();
  });

  it('should scan QR code', async () => {
    await element(by.id('fab-scan-qr')).tap();
    await expect(element(by.text('اسکن QR Code'))).toBeVisible();
  });
});
```

## 🔧 Hardware Tests

### ESP32 Hardware-in-Loop Test

```python
# tools/testing/hardware_test.py
import serial
import time
import json
import paho.mqtt.client as mqtt

class ESP32HardwareTest:
    def __init__(self, serial_port='/dev/ttyUSB0', baud_rate=115200):
        self.serial = serial.Serial(serial_port, baud_rate)
        self.mqtt_client = mqtt.Client()
        self.received_data = []
        
    def setup_mqtt(self):
        self.mqtt_client.on_message = self.on_mqtt_message
        self.mqtt_client.connect("localhost", 1883, 60)
        self.mqtt_client.subscribe("devices/+/data")
        self.mqtt_client.loop_start()
        
    def on_mqtt_message(self, client, userdata, msg):
        payload = json.loads(msg.payload.decode())
        self.received_data.append(payload)
        
    def test_sensor_readings(self):
        print("Testing sensor readings...")
        
        # Send command to ESP32
        command = {"command": "read_sensors"}\n"
        self.serial.write(command.encode())
        
        # Wait for response
        time.sleep(2)
        
        # Check serial output
        if self.serial.in_waiting:
            response = self.serial.readline().decode().strip()
            data = json.loads(response)
            
            assert 'temperature' in data
            assert 'humidity' in data
            assert data['temperature'] > -40 and data['temperature'] < 125
            assert data['humidity'] >= 0 and data['humidity'] <= 100
            
            print("✅ Sensor readings valid")
        else:
            assert False, "No response from ESP32"
            
    def test_mqtt_communication(self):
        print("Testing MQTT communication...")
        
        # Clear received data
        self.received_data.clear()
        
        # Wait for MQTT data
        time.sleep(10)
        
        assert len(self.received_data) > 0, "No MQTT data received"
        
        latest_data = self.received_data[-1]
        assert 'device_id' in latest_data
        assert 'temperature' in latest_data
        
        print("✅ MQTT communication working")
        
    def test_wifi_connectivity(self):
        print("Testing WiFi connectivity...")
        
        command = {"command": "wifi_status"}\n"
        self.serial.write(command.encode())
        
        time.sleep(1)
        
        if self.serial.in_waiting:
            response = self.serial.readline().decode().strip()
            data = json.loads(response)
            
            assert data['wifi_connected'] == True
            assert data['rssi'] < 0  # RSSI should be negative
            
            print(f"✅ WiFi connected, RSSI: {data['rssi']} dBm")
        else:
            assert False, "No WiFi status response"
            
    def run_all_tests(self):
        self.setup_mqtt()
        
        try:
            self.test_sensor_readings()
            self.test_wifi_connectivity()
            self.test_mqtt_communication()
            print("\n🎉 All hardware tests passed!")
            
        except Exception as e:
            print(f"\n❌ Hardware test failed: {e}")
            
        finally:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
            self.serial.close()

if __name__ == "__main__":
    test = ESP32HardwareTest()
    test.run_all_tests()
```

## 📊 Monitoring & Logging

### Test Monitoring Dashboard

```javascript
// tools/testing/test_monitor.js
const express = require('express');
const app = express();
const WebSocket = require('ws');

let testResults = {
  unit: { passed: 0, failed: 0, total: 0 },
  integration: { passed: 0, failed: 0, total: 0 },
  e2e: { passed: 0, failed: 0, total: 0 },
  performance: { avgResponseTime: 0, throughput: 0 },
  coverage: { lines: 0, functions: 0, branches: 0 }
};

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify(testResults));
});

function updateTestResults(type, result) {
  testResults[type] = { ...testResults[type], ...result };
  
  // Broadcast to all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(testResults));
    }
  });
}

// REST API for test results
app.use(express.json());

app.post('/api/test-results/:type', (req, res) => {
  const { type } = req.params;
  const result = req.body;
  
  updateTestResults(type, result);
  res.json({ success: true });
});

app.get('/api/test-results', (req, res) => {
  res.json(testResults);
});

app.listen(3001, () => {
  console.log('Test monitor running on port 3001');
});
```

### Automated Test Pipeline

```yaml
# .github/workflows/test-pipeline.yml
name: IoT System Test Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        cd backend && npm install
        cd ../frontend/web_dashboard && npm install
        
    - name: Run unit tests
      run: |
        cd backend && npm test -- --coverage
        cd ../frontend/web_dashboard && npm test -- --coverage
        
    - name: Upload coverage
      uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:latest
        ports:
          - 27017:27017
      redis:
        image: redis:latest
        ports:
          - 6379:6379
      mosquitto:
        image: eclipse-mosquitto:latest
        ports:
          - 1883:1883
          
    steps:
    - uses: actions/checkout@v3
    
    - name: Run integration tests
      run: |
        python tools/testing/mqtt_integration_test.py
        cd backend && npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup test environment
      run: |
        docker-compose -f docker-compose.test.yml up -d
        sleep 30
        
    - name: Run Cypress tests
      uses: cypress-io/github-action@v5
      with:
        working-directory: frontend/web_dashboard
        start: npm start
        wait-on: 'http://localhost:3000'
        
    - name: Run Detox tests
      run: |
        cd frontend/mobile_app
        detox test

  performance-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Install Artillery
      run: npm install -g artillery
      
    - name: Run load tests
      run: artillery run tools/testing/load_test.yml
      
    - name: Run MQTT performance tests
      run: python tools/testing/mqtt_performance_test.py

  security-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Run security tests
      run: |
        node tools/testing/security_test.js
        python tools/testing/mqtt_security_test.py
        
    - name: OWASP ZAP Scan
      uses: zaproxy/action-full-scan@v0.4.0
      with:
        target: 'http://localhost:3000'
```

## 📈 Test Reports

### Generate Comprehensive Test Report

```bash
#!/bin/bash
# tools/testing/generate_report.sh

echo "🧪 Generating IoT System Test Report..."

# Create report directory
mkdir -p reports

# Run all tests and collect results
echo "Running unit tests..."
cd backend && npm test -- --coverage --json > ../reports/unit-test-results.json

echo "Running integration tests..."
python ../tools/testing/mqtt_integration_test.py > ../reports/integration-results.txt

echo "Running performance tests..."
artillery run ../tools/testing/load_test.yml -o ../reports/performance-results.json

echo "Running security tests..."
node ../tools/testing/security_test.js > ../reports/security-results.txt

# Generate HTML report
python ../tools/testing/generate_html_report.py

echo "✅ Test report generated in reports/index.html"
```

## 🎯 Test Checklist

### Pre-Production Checklist

- [ ] **Unit Tests**
  - [ ] Backend API tests (>90% coverage)
  - [ ] Frontend component tests (>80% coverage)
  - [ ] ESP32 firmware tests
  - [ ] Mobile app tests

- [ ] **Integration Tests**
  - [ ] MQTT communication
  - [ ] Database operations
  - [ ] WebSocket connections
  - [ ] API endpoints

- [ ] **Performance Tests**
  - [ ] Load testing (1000+ concurrent users)
  - [ ] MQTT throughput (>10k msg/s)
  - [ ] Memory usage (stable over 24h)
  - [ ] Response time (<200ms API)

- [ ] **Security Tests**
  - [ ] Authentication/Authorization
  - [ ] Input validation
  - [ ] Rate limiting
  - [ ] TLS/SSL encryption

- [ ] **Hardware Tests**
  - [ ] Sensor accuracy
  - [ ] Wireless connectivity
  - [ ] Battery life
  - [ ] Environmental conditions

- [ ] **End-to-End Tests**
  - [ ] Complete user workflows
  - [ ] Cross-platform compatibility
  - [ ] Real-time features
  - [ ] Error handling

- [ ] **Monitoring**
  - [ ] Logging configured
  - [ ] Metrics collection
  - [ ] Alerting setup
  - [ ] Health checks

---

**نکته:** این راهنمای تست باید به طور مرتب به‌روزرسانی شود و تست‌های جدید با اضافه شدن ویژگی‌های جدید افزوده شوند.
