# Run the Enhanced AI Server (8080). واجهة الويب عبر Vite على 5173.
# لتجنب تضارب المنافذ: لا تشغّل python -m http.server على 5173 (مخصص لـ Vite).

Write-Host "🚀 بدء خدمات محاكي الجدوى (Vite + AI)..." -ForegroundColor Green

# 1. Start AI Server (منفذ 8080)
Write-Host "🤖 Starting Enhanced AI Server on port 8080..."
Start-Process "python" -ArgumentList "ai_server_enhanced.py" -WindowStyle Minimized

Write-Host "✅ AI Server is running in background."
Write-Host "👉 To start the Frontend: npm run dev   (Vite on 5173, /api -> 8080)"
Write-Host "🌐 AI backend: http://localhost:8080  |  Web: http://localhost:5173"
