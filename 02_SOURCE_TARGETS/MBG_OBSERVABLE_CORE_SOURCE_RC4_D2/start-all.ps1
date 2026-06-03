Start-Process powershell -ArgumentList "-NoExit","-ExecutionPolicy","Bypass","-File","$PSScriptRoot\start-core.ps1"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit","-ExecutionPolicy","Bypass","-File","$PSScriptRoot\start-frontend.ps1"
