@echo off
echo ========================================
echo    صيدلية السيادة - Pharmacie Seyada
echo    Build and Deploy
echo ========================================
echo.

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 ( echo ERROR: npm install failed & pause & exit /b 1 )

echo.
echo [2/3] Building for production...
call npm run build
if %errorlevel% neq 0 ( echo ERROR: Build failed & pause & exit /b 1 )

echo.
echo [3/3] Deploying to Firebase...
call npx firebase deploy
if %errorlevel% neq 0 ( echo ERROR: Deploy failed & pause & exit /b 1 )

echo.
echo ========================================
echo SUCCESS! App is live on Firebase!
echo ========================================
pause
