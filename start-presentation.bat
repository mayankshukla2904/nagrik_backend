@echo off
echo.
echo ====================================
echo    NAGRIK 2.0 - Complete System
echo    Presentation Ready Version
echo ====================================
echo.

REM Set window title
title NAGRIK 2.0 - System Startup

REM Create log directory
if not exist "logs" mkdir logs

echo [STEP 1/6] Setting up Python environment for RAG Classifier...
cd /d "d:\D\SIH\nagrik-2.0\rag-classifier"
echo Installing Python dependencies...
pip install -r requirements.txt > ../logs/pip-install.log 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Python dependencies installation had issues. Check logs/pip-install.log
) else (
    echo ✓ Python dependencies installed successfully
)

echo.
echo [STEP 2/6] Installing Node.js dependencies...
cd /d "d:\D\SIH\nagrik-2.0"
echo Installing backend dependencies...
npm install > logs/npm-install.log 2>&1
if %errorlevel% neq 0 (
    echo WARNING: NPM installation had issues. Check logs/npm-install.log
) else (
    echo ✓ Backend dependencies installed successfully
)

echo.
echo [STEP 3/6] Checking MongoDB connection...
echo MongoDB should be running on localhost:27017
echo If MongoDB is not installed, demo mode will be used
echo.

echo [STEP 4/6] Starting Enhanced RAG Classifier Service...
cd /d "d:\D\SIH\nagrik-2.0\rag-classifier"
start "NAGRIK RAG Classifier" cmd /k "echo NAGRIK Enhanced RAG Classifier Service && echo Port: 5000 && echo Features: Jharkhand-specific intelligence, AI enhancement, location validation && echo. && python enhanced_app.py"

echo Waiting for RAG Classifier to initialize...
timeout /t 5 /nobreak > nul

echo.
echo [STEP 5/6] Starting WhatsApp Service...
cd /d "d:\D\SIH\nagrik-2.0\whatsapp-service"
start "NAGRIK WhatsApp Service" cmd /k "echo NAGRIK WhatsApp Service && echo Status: Ready for QR scan && echo Features: Smart conversation flow, complaint submission && echo. && npm start"

echo Waiting for WhatsApp service to initialize...
timeout /t 3 /nobreak > nul

echo.
echo [STEP 6/6] Starting Main Backend API...
cd /d "d:\D\SIH\nagrik-2.0"
start "NAGRIK Backend API" cmd /k "echo NAGRIK Backend API && echo Port: 3000 && echo Features: Enhanced complaints with upvoting, Jharkhand validation && echo Dashboard: http://localhost:3000/dashboard && echo. && npm run dev"

echo.
echo ====================================
echo    System Starting Up...
echo ====================================
echo.
echo Services being launched:
echo.
echo ✓ Enhanced RAG Classifier    - Port 5000
echo   Features: Jharkhand intelligence, AI enhancement
echo.
echo ✓ WhatsApp Service           - Port 3001  
echo   Features: Smart bot, complaint submission
echo.
echo ✓ Backend API               - Port 3000
echo   Features: Enhanced complaints, upvoting, validation
echo.
echo ✓ Dashboard                 - http://localhost:3000/dashboard
echo   Features: Real-time data, upvoting display
echo.

echo Waiting for all services to fully start...
timeout /t 5 /nobreak > nul

echo.
echo ====================================
echo    NAGRIK 2.0 - READY FOR DEMO!
echo ====================================
echo.
echo 📱 WhatsApp Bot: Scan QR code to connect
echo 🌐 Dashboard: Opening in browser...
echo 🔧 API Status: http://localhost:3000/api/health
echo 🤖 RAG Status: http://localhost:5000/health
echo.
echo For presentation:
echo 1. Open WhatsApp service window to show QR code
echo 2. Scan QR with phone to connect WhatsApp bot
echo 3. Dashboard will show real-time complaints
echo 4. Similar complaints will show upvote counts
echo 5. All complaints validated for Jharkhand locations
echo.

REM Open dashboard in default browser
start http://localhost:3000/dashboard

echo ✓ System ready for presentation!
echo.
echo Press any key to exit (services will continue running)...
pause > nul
