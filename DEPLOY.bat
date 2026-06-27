@echo off
echo ================================
echo   صيدلية السيادة - Firebase Deploy
echo ================================
echo.

cd /d "%~dp0"

echo [1/3] تثبيت المكتبات...
call npm install
if errorlevel 1 (
    echo خطأ في npm install
    pause
    exit /b 1
)

echo.
echo [2/3] بناء المشروع...
call npm run build
if errorlevel 1 (
    echo خطأ في البناء
    pause
    exit /b 1
)

echo.
echo [3/3] رفع على Firebase...
call npx firebase deploy --only hosting
if errorlevel 1 (
    echo خطأ في الرفع
    pause
    exit /b 1
)

echo.
echo ================================
echo   تم النشر بنجاح!
echo ================================
pause
