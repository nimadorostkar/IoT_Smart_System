/**
 * Device Model - مدل دستگاه‌های IoT
 * ==================================
 * 
 * این مدل اطلاعات دستگاه‌های IoT را ذخیره می‌کند
 */

const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        match: /^[A-Z0-9-]{8,50}$/
    },
    
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    
    type: {
        type: String,
        required: true,
        enum: ['sensor', 'actuator', 'camera', 'gateway', 'hybrid'],
        default: 'sensor'
    },
    
    category: {
        type: String,
        enum: ['environmental', 'security', 'automation', 'energy', 'health', 'other'],
        default: 'environmental'
    },
    
    location: {
        room: { type: String, trim: true },
        building: { type: String, trim: true },
        floor: { type: Number },
        coordinates: {
            latitude: { type: Number, min: -90, max: 90 },
            longitude: { type: Number, min: -180, max: 180 }
        },
        description: { type: String, maxlength: 500 }
    },
    
    specifications: {
        manufacturer: { type: String, trim: true },
        model: { type: String, trim: true },
        firmwareVersion: { type: String, trim: true },
        hardwareVersion: { type: String, trim: true },
        serialNumber: { type: String, trim: true },
        macAddress: { 
            type: String, 
            match: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
        }
    },
    
    capabilities: {
        sensors: [{
            type: {
                type: String,
                enum: ['temperature', 'humidity', 'pressure', 'light', 'motion', 'sound', 'gas', 'smoke', 'door', 'window', 'other']
            },
            unit: { type: String },
            range: {
                min: { type: Number },
                max: { type: Number }
            },
            accuracy: { type: Number },
            resolution: { type: Number }
        }],
        
        actuators: [{
            type: {
                type: String,
                enum: ['relay', 'dimmer', 'motor', 'valve', 'speaker', 'display', 'led', 'other']
            },
            powerRating: { type: Number }, // watts
            controlType: {
                type: String,
                enum: ['on_off', 'dimming', 'variable_speed', 'position']
            }
        }],
        
        communication: [{
            protocol: {
                type: String,
                enum: ['wifi', 'zigbee', 'zwave', 'lora', 'bluetooth', 'ethernet', 'cellular']
            },
            frequency: { type: String },
            range: { type: Number }, // meters
            powerConsumption: { type: Number } // mW
        }]
    },
    
    status: {
        isOnline: { type: Boolean, default: false },
        lastSeen: { type: Date, default: Date.now },
        batteryLevel: { type: Number, min: 0, max: 100 },
        signalStrength: { type: Number }, // dBm
        uptime: { type: Number }, // seconds
        freeMemory: { type: Number }, // bytes
        temperature: { type: Number }, // device temperature
        errorCount: { type: Number, default: 0 },
        lastError: {
            message: { type: String },
            timestamp: { type: Date },
            code: { type: String }
        }
    },
    
    network: {
        ipAddress: { 
            type: String,
            match: /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
        },
        macAddress: { type: String },
        gateway: { type: String },
        subnet: { type: String },
        dns: [{ type: String }],
        ssid: { type: String }, // for WiFi devices
        bssid: { type: String }
    },
    
    configuration: {
        updateInterval: { type: Number, default: 30000 }, // ms
        retryAttempts: { type: Number, default: 3 },
        timeout: { type: Number, default: 5000 }, // ms
        enableLogging: { type: Boolean, default: true },
        logLevel: {
            type: String,
            enum: ['error', 'warn', 'info', 'debug'],
            default: 'info'
        },
        autoUpdate: { type: Boolean, default: true },
        customSettings: { type: mongoose.Schema.Types.Mixed }
    },
    
    alarmRules: [{
        name: { type: String, required: true },
        parameter: { type: String, required: true },
        operator: {
            type: String,
            enum: ['>', '<', '>=', '<=', '==', '!='],
            required: true
        },
        threshold: { type: Number, required: true },
        severity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        },
        enabled: { type: Boolean, default: true },
        cooldown: { type: Number, default: 300000 }, // ms
        lastTriggered: { type: Date }
    }],
    
    maintenance: {
        lastMaintenance: { type: Date },
        nextMaintenance: { type: Date },
        maintenanceInterval: { type: Number }, // days
        warrantyExpiry: { type: Date },
        notes: [{ 
            date: { type: Date, default: Date.now },
            text: { type: String, maxlength: 1000 },
            author: { type: String }
        }]
    },
    
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    tags: [{ type: String, trim: true, maxlength: 50 }],
    
    isActive: { type: Boolean, default: true },
    isVisible: { type: Boolean, default: true }
    
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
deviceSchema.index({ deviceId: 1, owner: 1 });
deviceSchema.index({ 'status.isOnline': 1 });
deviceSchema.index({ 'status.lastSeen': -1 });
deviceSchema.index({ type: 1, category: 1 });
deviceSchema.index({ 'location.room': 1, 'location.building': 1 });
deviceSchema.index({ tags: 1 });

// Virtual fields
deviceSchema.virtual('isOffline').get(function() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.status.lastSeen < fiveMinutesAgo;
});

deviceSchema.virtual('batteryStatus').get(function() {
    const level = this.status.batteryLevel;
    if (level === undefined) return 'unknown';
    if (level > 75) return 'good';
    if (level > 50) return 'fair';
    if (level > 25) return 'low';
    return 'critical';
});

deviceSchema.virtual('signalQuality').get(function() {
    const rssi = this.status.signalStrength;
    if (rssi === undefined) return 'unknown';
    if (rssi > -50) return 'excellent';
    if (rssi > -60) return 'good';
    if (rssi > -70) return 'fair';
    return 'poor';
});

// Pre-save middleware
deviceSchema.pre('save', function(next) {
    // Update lastSeen if device comes online
    if (this.isModified('status.isOnline') && this.status.isOnline) {
        this.status.lastSeen = new Date();
    }
    
    // Reset error count if device comes back online
    if (this.isModified('status.isOnline') && this.status.isOnline && this.status.errorCount > 0) {
        this.status.errorCount = 0;
        this.status.lastError = undefined;
    }
    
    next();
});

// Instance methods
deviceSchema.methods.updateStatus = function(statusUpdate) {
    Object.assign(this.status, statusUpdate);
    this.status.lastSeen = new Date();
    return this.save();
};

deviceSchema.methods.recordError = function(error) {
    this.status.errorCount += 1;
    this.status.lastError = {
        message: error.message,
        timestamp: new Date(),
        code: error.code || 'UNKNOWN'
    };
    return this.save();
};

deviceSchema.methods.addAlarmRule = function(rule) {
    this.alarmRules.push(rule);
    return this.save();
};

deviceSchema.methods.removeAlarmRule = function(ruleId) {
    this.alarmRules.id(ruleId).remove();
    return this.save();
};

deviceSchema.methods.addMaintenanceNote = function(text, author) {
    this.maintenance.notes.push({ text, author });
    return this.save();
};

// Static methods
deviceSchema.statics.findOnlineDevices = function() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.find({ 
        'status.isOnline': true,
        'status.lastSeen': { $gte: fiveMinutesAgo }
    });
};

deviceSchema.statics.findOfflineDevices = function() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.find({
        $or: [
            { 'status.isOnline': false },
            { 'status.lastSeen': { $lt: fiveMinutesAgo } }
        ]
    });
};

deviceSchema.statics.findByLocation = function(room, building) {
    const query = {};
    if (room) query['location.room'] = room;
    if (building) query['location.building'] = building;
    return this.find(query);
};

deviceSchema.statics.findByType = function(type, category) {
    const query = { type };
    if (category) query.category = category;
    return this.find(query);
};

deviceSchema.statics.getStatistics = function() {
    return this.aggregate([
        {
            $group: {
                _id: null,
                totalDevices: { $sum: 1 },
                onlineDevices: {
                    $sum: {
                        $cond: [
                            { 
                                $and: [
                                    { $eq: ['$status.isOnline', true] },
                                    { $gte: ['$status.lastSeen', new Date(Date.now() - 5 * 60 * 1000)] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                lowBatteryDevices: {
                    $sum: {
                        $cond: [
                            { $lt: ['$status.batteryLevel', 25] },
                            1,
                            0
                        ]
                    }
                },
                deviceTypes: { $push: '$type' },
                deviceCategories: { $push: '$category' }
            }
        },
        {
            $project: {
                _id: 0,
                totalDevices: 1,
                onlineDevices: 1,
                offlineDevices: { $subtract: ['$totalDevices', '$onlineDevices'] },
                lowBatteryDevices: 1,
                uptime: { 
                    $multiply: [
                        { $divide: ['$onlineDevices', '$totalDevices'] },
                        100
                    ]
                }
            }
        }
    ]);
};

const Device = mongoose.model('Device', deviceSchema);

module.exports = { Device, deviceSchema };
