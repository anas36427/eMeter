# eMeter Reader — React Native (Expo) Mobile App

## For Meter Readers at Aligarh Muslim University

### Quick Start

```bash
# Fix npm cache (if you get EPERM errors)
sudo chown -R $(whoami) ~/.npm

# Install dependencies
npm install

# Start the app
npx expo start
```

### Testing on Your Phone

1. Install **Expo Go** from App Store (iOS) or Play Store (Android)
2. Run `npx expo start` in this directory
3. Scan the QR code with your phone's camera
4. The app will open in Expo Go

### Connecting to Django Backend

Edit `src/services/api.js` and change `BASE_URL` to your computer's local IP:

```javascript
// Find your IP: run `ifconfig | grep "inet "` in terminal
const BASE_URL = 'http://192.168.X.X:8000';
```

Make sure your Django server is running:
```bash
cd ../eMeter.web/electricity_system
python manage.py runserver 0.0.0.0:8000
```

### Features
- 🔐 Login (meter_reader role)
- 📊 Dashboard with live stats
- 🔍 Consumer search (by meter number, name, ID)
- ⚡ Submit meter reading with auto-bill generation
- 🧾 Instant bill preview with arrears
- 📱 SMS notification to consumer
- 📋 Reading history (edit today's readings)
- 🌐 Offline mode with auto-sync
- 🎨 Premium dark theme with AMU branding

### Project Structure
```
eMeterApp/
├── App.js                          # Entry point
├── src/
│   ├── screens/                    # All app screens
│   │   ├── LoginScreen.js
│   │   ├── DashboardScreen.js
│   │   ├── SearchScreen.js
│   │   ├── SubmitReadingScreen.js
│   │   ├── BillPreviewScreen.js
│   │   └── HistoryScreen.js
│   ├── services/
│   │   ├── api.js                  # API client + auth
│   │   └── offlineStorage.js       # Offline queue
│   ├── navigation/
│   │   └── AppNavigator.js         # Tab + Stack nav
│   └── theme/
│       └── colors.js               # Design system
```
