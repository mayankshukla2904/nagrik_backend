@echo off
echo 🚀 Installing Enhanced NAGRIK WhatsApp Bot Features...
echo.

cd /d "%~dp0"

echo 📦 Installing new dependencies...
npm install openai

echo.
echo ✅ Enhanced WhatsApp Bot Setup Complete!
echo.
echo 🎯 New Features Available:
echo   • AI-Powered Conversations (requires OPENAI_API_KEY)
echo   • Smart Category Detection
echo   • Multi-Language Support (Hindi, Santali)
echo   • Community Features (Upvoting, Trending)
echo   • Enhanced Status Tracking
echo.
echo 🔧 Configuration:
echo   • Add OPENAI_API_KEY to your .env file for AI features
echo   • All enhanced features are backward compatible
echo   • Falls back to basic functionality if modules unavailable
echo.
echo 📱 Bot will automatically detect and use enhanced features!
echo.
pause
