#!/bin/bash
# eMeter AMU Automated Deployment Script for Ubuntu
# Make sure to run this script as a user with sudo privileges!

set -e

echo "==================================================="
echo "🚀 Starting eMeter AMU Automated Deployment"
echo "==================================================="

# 1. Update and install dependencies
echo "📦 Installing system dependencies..."
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3-pip postgresql-16 postgresql-contrib nginx curl git

# Install Node.js 20.x
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Setup PostgreSQL
echo "🗄️ Setting up PostgreSQL database..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create DB and User (Will ignore if already exists)
sudo -u postgres psql -c "CREATE DATABASE emeter_db;" || true
sudo -u postgres psql -c "CREATE USER emeter_user WITH PASSWORD 'secure_amu_password_here';" || true
sudo -u postgres psql -c "ALTER ROLE emeter_user SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE emeter_user SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE emeter_user SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE emeter_db TO emeter_user;"
sudo -u postgres psql -c "ALTER DATABASE emeter_db OWNER TO emeter_user;"

# 3. Setup Django Backend
echo "⚙️ Setting up Django backend..."
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$DIR/electricity_system"
FRONTEND_DIR="$DIR/energy-hub-ui"

cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn psycopg2-binary

# Create production .env if it doesn't exist
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "Creating backend .env file..."
    cat > "$BACKEND_DIR/.env" << EOF
DJANGO_SECRET_KEY=$(openssl rand -hex 32)
DEBUG=False
ALLOWED_HOSTS=127.0.0.1,localhost,172.16.1.64,amuelectricity.amu.ac.in
DB_ENGINE=django.db.backends.postgresql
DB_NAME=emeter_db
DB_USER=emeter_user
DB_PASSWORD=secure_amu_password_here
DB_HOST=localhost
DB_PORT=5432
EOF
fi

echo "🔄 Running database migrations..."
python manage.py migrate
echo "📂 Collecting static files..."
python manage.py collectstatic --noinput

# 4. Setup Gunicorn Systemd Services
echo "🔧 Configuring Gunicorn service..."
sudo bash -c 'cat > /etc/systemd/system/gunicorn.socket << EOF
[Unit]
Description=gunicorn socket

[Socket]
ListenStream=/run/gunicorn.sock

[Install]
WantedBy=sockets.target
EOF'

CURRENT_USER=$(whoami)
sudo bash -c "cat > /etc/systemd/system/gunicorn.service << EOF
[Unit]
Description=gunicorn daemon
Requires=gunicorn.socket
After=network.target

[Service]
User=$CURRENT_USER
Group=www-data
WorkingDirectory=$BACKEND_DIR
ExecStart=$BACKEND_DIR/venv/bin/gunicorn \\
          --access-logfile - \\
          --workers 3 \\
          --bind unix:/run/gunicorn.sock \\
          electricity_system.wsgi:application

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl restart gunicorn.socket gunicorn.service
sudo systemctl enable gunicorn.socket gunicorn.service

# 5. Build React Frontend
echo "⚛️ Building React frontend..."
cd "$FRONTEND_DIR"
npm install
npm run build

# 6. Configure Nginx
echo "🌐 Configuring Nginx..."
sudo bash -c "cat > /etc/nginx/sites-available/emeter << EOF
server {
    listen 80;
    server_name 172.16.1.64 amuelectricity.amu.ac.in;

    location / {
        root $FRONTEND_DIR/dist;
        index index.html;
        try_files \\\$uri \\\$uri/ /index.html;
    }

    location /static/ {
        alias $BACKEND_DIR/staticfiles/;
    }

    location /media/ {
        alias $BACKEND_DIR/media/;
    }

    location /api/ {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
    }

    location /admin/ {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
    }
}
EOF"

sudo ln -sf /etc/nginx/sites-available/emeter /etc/nginx/sites-enabled
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 7. Configure Firewall
echo "🛡️ Configuring UFW Firewall..."
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw --force enable

echo "==================================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "You can now access the system at http://amuelectricity.amu.ac.in or http://172.16.1.64"
echo "==================================================="
