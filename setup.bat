@echo off
echo Installing dependencies...
call npm install

echo.
echo Seeding database with default accounts...
call npm run seed

echo.
echo Setup completed!
echo.
echo You can now start the server with: npm start
echo Or for development: npm run dev
echo.
pause
