@echo off
echo Starting Feasibility Study Platform...
echo =======================================
echo Ports: AI=8080, Vite=5173. Do NOT run python -m http.server on 5173.
echo =======================================

:: Start Python Backend in background (port 8080)
echo Starting AI Server (Python) on 8080...
start "AI Server" cmd /k "python ai_server_enhanced.py"

:: Start Vite Frontend (port 5173)
echo Starting Web Interface (Vite) on 5173...
npm run dev

echo =======================================
echo Both services are running.
