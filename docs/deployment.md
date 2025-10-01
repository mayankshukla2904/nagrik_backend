# NAGRIK Deployment Guide

## Overview
This guide covers deploying the NAGRIK grievance platform to production environments, including cloud platforms and on-premise servers.

## Architecture Summary

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│   Web Gateway   │────│   Frontend      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌────────┴────────┐
                       │   Backend API   │
                       │   (Node.js)     │
                       └────────┬────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼───────┐    ┌─────────▼─────────┐    ┌────────▼────────┐
│  WhatsApp     │    │  RAG Classifier   │    │  Call Service   │
│  Service      │    │  (Python)         │    │  (Node.js)      │
└───────────────┘    └───────────────────┘    └─────────────────┘
                                │
                       ┌────────▼────────┐
                       │   MongoDB       │
                       │   Atlas         │
                       └─────────────────┘
```

## Prerequisites

### System Requirements
- **CPU:** 2+ cores (4+ recommended for production)
- **RAM:** 4GB minimum (8GB+ recommended)
- **Storage:** 20GB minimum (SSD recommended)
- **OS:** Ubuntu 20.04 LTS or similar Linux distribution

### Software Requirements
- Node.js v18.x or higher
- Python 3.8+ with pip
- MongoDB Atlas account
- Domain name with SSL certificate
- Reverse proxy (Nginx/Apache)

### External Services
- MongoDB Atlas cluster
- OpenAI API key
- WhatsApp Business account
- Email service (optional)
- SMS service (optional)

## Environment Setup

### 1. Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python and pip
sudo apt install python3 python3-pip -y

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Install certbot for SSL
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Create Application User
```bash
# Create dedicated user
sudo adduser nagrik
sudo usermod -aG sudo nagrik

# Switch to nagrik user
su - nagrik
```

### 3. Clone and Setup Application
```bash
# Clone repository
git clone <your-repository-url> /home/nagrik/nagrik-2.0
cd /home/nagrik/nagrik-2.0

# Set permissions
sudo chown -R nagrik:nagrik /home/nagrik/nagrik-2.0
```

## Configuration

### 1. Environment Variables
Create production environment file:
```bash
cp .env.template .env
```

Edit `.env` with production values:
```bash
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/nagrik_prod?retryWrites=true&w=majority
DB_NAME=nagrik_prod

# Server Configuration
PORT=3000
NODE_ENV=production

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-actual-openai-key-here

# WhatsApp Service Configuration
WHATSAPP_SERVICE_URL=http://localhost:3001
WHATSAPP_SESSION_NAME=nagrik_prod_session

# RAG Classifier Service Configuration
RAG_SERVICE_URL=http://localhost:5000

# Security Configuration
JWT_SECRET=your-super-secure-jwt-secret-here
BCRYPT_ROUNDS=12

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=/var/log/nagrik/nagrik.log

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com
```

### 2. Create Log Directory
```bash
sudo mkdir -p /var/log/nagrik
sudo chown nagrik:nagrik /var/log/nagrik
```

### 3. Install Dependencies
```bash
# Root level
npm install

# Backend
cd backend
npm install
cd ..

# WhatsApp Service
cd whatsapp-service
npm install
cd ..

# RAG Classifier
cd rag-classifier
pip3 install -r requirements.txt
cd ..
```

## Database Setup

### 1. MongoDB Atlas Configuration
1. Create a MongoDB Atlas account
2. Create a new cluster
3. Configure database access (username/password)
4. Whitelist server IP address
5. Get connection string and update `.env`

### 2. Database Initialization
```bash
# Test database connection
cd backend
node -e "
const mongoose = require('mongoose');
require('dotenv').config({path: '../.env'});
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database error:', err));
"
```

## Service Deployment

### 1. Backend API Service
Create PM2 ecosystem file:
```bash
# /home/nagrik/nagrik-2.0/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'nagrik-backend',
      script: './backend/src/app.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/nagrik/backend-error.log',
      out_file: '/var/log/nagrik/backend-out.log',
      log_file: '/var/log/nagrik/backend.log',
      time: true
    },
    {
      name: 'nagrik-whatsapp',
      script: './whatsapp-service/src/whatsapp.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/nagrik/whatsapp-error.log',
      out_file: '/var/log/nagrik/whatsapp-out.log',
      log_file: '/var/log/nagrik/whatsapp.log',
      time: true
    },
    {
      name: 'nagrik-rag',
      script: 'python3',
      args: 'app.py',
      cwd: './rag-classifier',
      instances: 1,
      env: {
        FLASK_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/log/nagrik/rag-error.log',
      out_file: '/var/log/nagrik/rag-out.log',
      log_file: '/var/log/nagrik/rag.log',
      time: true
    }
  ]
};
```

### 2. Start Services
```bash
# Start all services
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs

# Save PM2 configuration
pm2 save
pm2 startup
```

## Nginx Configuration

### 1. Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/nagrik
```

```nginx
# /etc/nginx/sites-available/nagrik
upstream backend {
    server 127.0.0.1:3000;
}

upstream whatsapp {
    server 127.0.0.1:3001;
}

upstream rag {
    server 127.0.0.1:5000;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=whatsapp:10m rate=5r/s;

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Backend API
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WhatsApp webhook
    location /whatsapp/ {
        limit_req zone=whatsapp burst=10 nodelay;
        proxy_pass http://whatsapp/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # RAG Classifier
    location /rag/ {
        proxy_pass http://rag/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files and uploads
    location /uploads/ {
        alias /home/nagrik/nagrik-2.0/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        proxy_pass http://backend/api/health;
        access_log off;
    }

    # Frontend (if serving static files)
    location / {
        root /home/nagrik/nagrik-2.0/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public";
    }
}
```

### 2. Enable Site and Get SSL Certificate
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/nagrik /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Restart nginx
sudo systemctl restart nginx
```

## Security Configuration

### 1. Firewall Setup
```bash
# Enable UFW
sudo ufw enable

# Allow SSH, HTTP, HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Block direct access to application ports
sudo ufw deny 3000
sudo ufw deny 3001
sudo ufw deny 5000

# Check status
sudo ufw status
```

### 2. Fail2Ban for Protection
```bash
# Install fail2ban
sudo apt install fail2ban

# Create jail configuration
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/error.log
findtime = 600
bantime = 7200
maxretry = 10
```

### 3. Regular Security Updates
```bash
# Create update script
sudo nano /home/nagrik/update-system.sh
```

```bash
#!/bin/bash
apt update
apt upgrade -y
apt autoremove -y

# Restart services if needed
if [ -f /var/run/reboot-required ]; then
    echo "Reboot required"
fi
```

```bash
# Make executable
sudo chmod +x /home/nagrik/update-system.sh

# Add to crontab
sudo crontab -e
```

Add line:
```bash
0 2 * * 0 /home/nagrik/update-system.sh
```

## Monitoring and Logging

### 1. Log Rotation
```bash
sudo nano /etc/logrotate.d/nagrik
```

```
/var/log/nagrik/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 nagrik nagrik
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 2. System Monitoring
```bash
# Install htop for monitoring
sudo apt install htop

# Check system resources
htop

# Check disk usage
df -h

# Check memory usage
free -h

# Check service status
pm2 status
sudo systemctl status nginx
```

### 3. Application Monitoring
Create monitoring script:
```bash
nano /home/nagrik/monitor.sh
```

```bash
#!/bin/bash
# Health check script

echo "=== NAGRIK System Health Check ==="
echo "Date: $(date)"
echo

# Check services
echo "PM2 Services:"
pm2 jlist | jq '.[] | {name: .name, status: .pm2_env.status, uptime: .pm2_env.pm_uptime}'

echo
echo "System Resources:"
echo "CPU: $(top -bn1 | grep load | awk '{printf "%.2f%%\t\t\n", $(NF-2)}')"
echo "Memory: $(free | grep Mem | awk '{printf "%.2f%%\t\t\n", $3/$2 * 100.0}')"
echo "Disk: $(df -h / | awk 'NR==2{printf "%s\t\t\n", $5}')"

echo
echo "API Health:"
curl -s http://localhost:3000/api/health | jq '.data.status' || echo "Backend API Down"
curl -s http://localhost:5000/health | jq '.status' || echo "RAG Service Down"

echo
echo "Recent Errors (last 10 lines):"
tail -n 10 /var/log/nagrik/*error.log 2>/dev/null || echo "No recent errors"
```

Make executable:
```bash
chmod +x /home/nagrik/monitor.sh
```

## Backup and Recovery

### 1. Database Backup
```bash
# Create backup script
nano /home/nagrik/backup-db.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/nagrik/backups"
mkdir -p $BACKUP_DIR

# MongoDB backup (if using self-hosted)
# mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/mongodb_$DATE"

# For Atlas, use automated backups in Atlas console

# Backup uploaded files
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" /home/nagrik/nagrik-2.0/uploads/

# Backup configuration
cp /home/nagrik/nagrik-2.0/.env "$BACKUP_DIR/env_$DATE"

# Clean old backups (keep 30 days)
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

### 2. Schedule Backups
```bash
# Add to crontab
crontab -e
```

Add:
```bash
# Daily backup at 2 AM
0 2 * * * /home/nagrik/backup-db.sh
```

## Performance Optimization

### 1. Node.js Optimization
```javascript
// In ecosystem.config.js
module.exports = {
  apps: [{
    name: 'nagrik-backend',
    script: './backend/src/app.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    env: {
      NODE_ENV: 'production',
      UV_THREADPOOL_SIZE: 128
    }
  }]
};
```

### 2. MongoDB Optimization
- Enable compression
- Create appropriate indexes
- Use read replicas for analytics
- Set up connection pooling

### 3. Nginx Optimization
```nginx
# Add to nginx.conf
worker_processes auto;
worker_connections 1024;

# Enable gzip compression
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

# Enable caching
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m inactive=60m;
```

## Scaling Considerations

### 1. Horizontal Scaling
- Use load balancer (AWS ALB, GCP Load Balancer)
- Deploy multiple instances across regions
- Use CDN for static assets
- Implement database sharding if needed

### 2. Auto-scaling
```yaml
# Example Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nagrik-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nagrik-backend
  template:
    metadata:
      labels:
        app: nagrik-backend
    spec:
      containers:
      - name: backend
        image: nagrik/backend:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## Troubleshooting

### Common Issues

1. **Service Won't Start**
   - Check logs: `pm2 logs`
   - Verify environment variables
   - Check port availability

2. **Database Connection Issues**
   - Verify MongoDB URI
   - Check network connectivity
   - Validate credentials

3. **High Memory Usage**
   - Monitor with `htop`
   - Check for memory leaks in logs
   - Restart services if needed

4. **SSL Certificate Issues**
   - Renew with: `sudo certbot renew`
   - Check expiration: `sudo certbot certificates`

### Emergency Procedures

1. **Service Recovery**
```bash
# Restart all services
pm2 restart all

# If PM2 is unresponsive
pm2 kill
pm2 resurrect
```

2. **Database Recovery**
```bash
# Check database status
mongo $MONGODB_URI --eval "db.adminCommand('ping')"

# Restore from backup if needed
```

3. **Full System Recovery**
```bash
# Reboot server
sudo reboot

# After reboot, services should auto-start
pm2 resurrect
```

This deployment guide provides a comprehensive setup for production deployment. Adjust configurations based on your specific requirements and infrastructure.
