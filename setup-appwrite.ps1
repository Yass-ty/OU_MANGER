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
    Write-Host " timeout (continuing)" -ForegroundColor Yellow
}

Write-Host "=== Ou On Mange - Collections Setup ===" -ForegroundColor Cyan
Write-Host "Database '$DB_ID' already exists, skipping creation." -ForegroundColor Yellow

# ── COLLECTION users ─────────────────────────────────────────
Write-Host "`n[1/2] Collection 'users'" -ForegroundColor Cyan
api "POST" "/databases/$DB_ID/collections" @{
    collectionId     = "users"
    name             = "Users"
    permissions      = @('create("any")', 'read("any")', 'update("any")', 'delete("any")')
    documentSecurity = $false
} | Out-Null
Write-Host "  [OK] Collection created" -ForegroundColor Green

Write-Host "  -> device_id"
api "POST" "/databases/$DB_ID/collections/users/attributes/string" @{ key="device_id"; size=255; required=$true } | Out-Null
wait_attr "users" "device_id"

Write-Host "  -> prenom"
api "POST" "/databases/$DB_ID/collections/users/attributes/string" @{ key="prenom"; size=100; required=$true } | Out-Null
wait_attr "users" "prenom"

Write-Host "  -> avatar_color"
api "POST" "/databases/$DB_ID/collections/users/attributes/string" @{ key="avatar_color"; size=20; required=$false; default="blue" } | Out-Null
wait_attr "users" "avatar_color"

Write-Host "  -> index device_id (unique)"
api "POST" "/databases/$DB_ID/collections/users/indexes" @{
    key="idx_device_id"; type="unique"; attributes=@("device_id")
} | Out-Null
Write-Host "  [OK] Index created" -ForegroundColor Green

# ── COLLECTION restaurants ───────────────────────────────────
Write-Host "`n[2/2] Collection 'restaurants'" -ForegroundColor Cyan
api "POST" "/databases/$DB_ID/collections" @{
    collectionId     = "restaurants"
    name             = "Restaurants"
    permissions      = @('create("any")', 'read("any")', 'update("any")', 'delete("any")')
    documentSecurity = $false
} | Out-Null
Write-Host "  [OK] Collection created" -ForegroundColor Green

$strings = @(
    @{ key="lien_video";     size=1000; required=$true  },
    @{ key="ajoute_par";     size=100;  required=$true  },
    @{ key="user_id";        size=255;  required=$true  },
    @{ key="nom_restaurant"; size=255;  required=$false },
    @{ key="type_cuisine";   size=100;  required=$false },
    @{ key="adresse";        size=500;  required=$false }
)
foreach ($a in $strings) {
    Write-Host "  -> $($a.key)"
    api "POST" "/databases/$DB_ID/collections/restaurants/attributes/string" @{
        key=$a.key; size=$a.size; required=$a.required
    } | Out-Null
    wait_attr "restaurants" $a.key
}

Write-Host "  -> statut (enum)"
api "POST" "/databases/$DB_ID/collections/restaurants/attributes/enum" @{
    key="statut"; elements=@("a_tester","deja_fait","valide"); required=$true; default="a_tester"
} | Out-Null
wait_attr "restaurants" "statut"

Write-Host "  -> prix (enum)"
api "POST" "/databases/$DB_ID/collections/restaurants/attributes/enum" @{
    key="prix"; elements=@("low","mid","high"); required=$false
} | Out-Null
wait_attr "restaurants" "prix"

Write-Host "  -> enrichi (boolean)"
api "POST" "/databases/$DB_ID/collections/restaurants/attributes/boolean" @{
    key="enrichi"; required=$false; default=$false
} | Out-Null
wait_attr "restaurants" "enrichi"

Write-Host "`n  Creating indexes..."
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
Write-Host "  users       : device_id | prenom | avatar_color" -ForegroundColor White
Write-Host "  restaurants : lien_video | ajoute_par | user_id | statut | nom_restaurant | type_cuisine | adresse | prix | enrichi" -ForegroundColor White
Write-Host "  Console     : https://cloud.appwrite.io/console/project-fra-6a1041f50005ea891757/databases/database-ou_on_mange" -ForegroundColor Cyan
