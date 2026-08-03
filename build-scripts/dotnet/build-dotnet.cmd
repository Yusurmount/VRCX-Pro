@echo off
cd ../../
dotnet build Dotnet\VRCX-Sidecar.csproj -p:Configuration=Release -p:Platform=x64 -p:WarningLevel=0
pause
