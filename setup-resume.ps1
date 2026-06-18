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
$DB_ID      = $env:APPWRITE_DB_ID

$h = @{
    "X-Appwrite-Project" = $PROJECT_ID
    "X-Appwrite-Key"     = $API_KEY
    "Content-Type"       = "application/json"
}

function api($method, $path, $body = $null) {
    $params = @{
        Uri             = "$BASE$path"
        Method          = $method
        Headers         = $h
        TimeoutSec      = 30
        UseBasicParsing = $true
        ErrorAction     = "Stop"
    }
    if ($body) { $params["Body"] = ($body | ConvertTo-Json -Depth 10 -Compress) }
    try {
        $r = Invoke-WebRequest @params
        return $r.Content | ConvertFrom-Json
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 409) { Write-Host "  [SKIP] Already exists" -ForegroundColor Yellow; return $null }
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errMsg = $reader.ReadToEnd()
        } catch { $errMsg = $_.Exception.Message }
        Write-Host "  [ERR] $method $path => HTTP $code : $errMsg" -ForegroundColor Red
        throw
    }
}

function wait_attr($col, $key) {
    Write-Host "    Waiting for $key..." -NoNewline
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 2
        $r = api "GET" "/databases/$DB_ID/collections/$col/attributes"
        $a = $r.attributes | Where-Object { $_.key -eq $key -and $_.status -eq "available" }
        if ($a) { Write-Host " ready" -ForegroundColor Green; return }
        Write-Host "." -NoNewline
    }
    Write-Host " timeout" -ForegroundColor Yellow
}

Write-Host "=== Resuming restaurants attributes ===" -ForegroundColor Cyan

# statut — NOT required so we can set a default
Write-Host "  -> statut (enum, default=a_tester)"
api "POST" "/databases/$DB_ID/collections/restaurants/attributes/enum" @{
    key      = "statut"
    elements = @("a_tester","deja_fait","valide")
    required = $false
    default  = "a_tester"
} | Out-Null
wait_attr "restaurants" "statut"

# prix
Write-Host "  -> prix (enum)"
api "POST" "/databases/$DB_ID/collections/restaurants/attributes/enum" @{
    key      = "prix"
    elements = @("low","mid","high")
    required = $false
} | Out-Null
wait_attr "restaurants" "prix"

# enrichi
Write-Host "  -> enrichi (boolean)"
api "POST" "/databases/$DB_ID/collections/restaurants/attributes/boolean" @{
    key     = "enrichi"
    required = $false
    default = $false
} | Out-Null
wait_attr "restaurants" "enrichi"

# Indexes
Write-Host "`n  Creating indexes..." -ForegroundColor Cyan
@(
    @{ key="idx_ajoute_par";        type="key"; attributes=@("ajoute_par") },
    @{ key="idx_statut";            type="key"; attributes=@("statut") },
    @{ key="idx_user_id";           type="key"; attributes=@("user_id") },
    @{ key="idx_ajoute_par_statut"; type="key"; attributes=@("ajoute_par","statut") }
) | ForEach-Object {
    Write-Host "  -> $($_.key)"
    api "POST" "/databases/$DB_ID/collections/restaurants/indexes" $_ | Out-Null
    Write-Host "    [OK]" -ForegroundColor Green
}

Write-Host "`n=== ALL DONE ===" -ForegroundColor Green
Write-Host ""
Write-Host "  Collection users:" -ForegroundColor White
Write-Host "    device_id | prenom | avatar_color" -ForegroundColor Gray
Write-Host ""
Write-Host "  Collection restaurants:" -ForegroundColor White
Write-Host "    lien_video | ajoute_par | user_id | statut | nom_restaurant | type_cuisine | adresse | prix | enrichi" -ForegroundColor Gray
Write-Host ""
Write-Host "  Console: https://cloud.appwrite.io/console/project-fra-6a1041f50005ea891757/databases" -ForegroundColor Cyan
