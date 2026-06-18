if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $key, $value = $line -split '=', 2
            [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim())
        }
    }
} else {
    Write-Host "Erreur: Fichier .env manquant. Veuillez copier .env.example vers .env et le configurer." -ForegroundColor Red
    exit 1
}

$PROJECT_ID = $env:APPWRITE_PROJECT_ID
$API_KEY    = $env:APPWRITE_API_KEY
$BASE       = $env:APPWRITE_ENDPOINT

Write-Host "Testing Appwrite connection..." -ForegroundColor Cyan

$headers = @{
    "X-Appwrite-Project" = $PROJECT_ID
    "X-Appwrite-Key"     = $API_KEY
    "Content-Type"       = "application/json"
}

try {
    $response = Invoke-WebRequest `
        -Uri "$BASE/databases" `
        -Method GET `
        -Headers $headers `
        -TimeoutSec 20 `
        -UseBasicParsing

    Write-Host "SUCCESS - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host $response.Content
} catch {
    Write-Host "FAILED: $($_.Exception.GetType().FullName)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "HTTP Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Body: $($reader.ReadToEnd())" -ForegroundColor Yellow
    }
}
