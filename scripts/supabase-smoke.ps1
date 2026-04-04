param(
  [Parameter(Mandatory = $true)]
  [string]$Email,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [string]$SupabaseUrl = "https://dfactzpzoyrfmhmwmdgj.supabase.co",

  [string]$AnonKey = "sb_publishable_AOpBdmAhYEbq1iFkheM24w_dbpKtCa6"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message"
}

function Invoke-SupabaseJson {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers,
    [object]$Body
  )

  $params = @{
    Method  = $Method
    Uri     = $Uri
    Headers = $Headers
  }

  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Compress)
  }

  Invoke-RestMethod @params
}

function Read-ResponseBody {
  param($Response)

  if (-not $Response) { return "" }
  $reader = New-Object System.IO.StreamReader($Response.GetResponseStream())
  $reader.ReadToEnd()
}

Write-Step "Authentification du compte test"

$authHeaders = @{
  apikey         = $AnonKey
  "Content-Type" = "application/json"
}

$authBody = @{
  email    = $Email
  password = $Password
}

try {
  $auth = Invoke-SupabaseJson -Method "Post" -Uri "$SupabaseUrl/auth/v1/token?grant_type=password" -Headers $authHeaders -Body $authBody
} catch {
  $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
  $body = Read-ResponseBody -Response $_.Exception.Response
  throw "Echec auth ($status): $body"
}

$userId = $auth.user.id
$jwt = $auth.access_token

Write-Step "Session obtenue pour $($auth.user.email) ($userId)"

$restHeaders = @{
  apikey        = $AnonKey
  Authorization = "Bearer $jwt"
}

$restWriteHeaders = @{
  apikey        = $AnonKey
  Authorization = "Bearer $jwt"
  Prefer        = "resolution=merge-duplicates,return=representation"
}

$probeUserSkin = "__probe_codex_user_skin__"
$probePublicSkin = "__probe_codex_public_skin__"

$results = [ordered]@{}

try {
  Write-Step "Lecture privee user_skins"
  $userSkins = Invoke-SupabaseJson -Method "Get" -Uri "$SupabaseUrl/rest/v1/user_skins?select=skin_id&user_id=eq.$userId&limit=5" -Headers $restHeaders -Body $null
  $results.user_skins_read = [ordered]@{ ok = $true; count = @($userSkins).Count }

  Write-Step "Ecriture reversible user_skins"
  $null = Invoke-SupabaseJson -Method "Post" -Uri "$SupabaseUrl/rest/v1/user_skins?on_conflict=user_id,skin_id" -Headers $restWriteHeaders -Body @(@{ user_id = $userId; skin_id = $probeUserSkin })
  $probeUserSkinRead = Invoke-SupabaseJson -Method "Get" -Uri "$SupabaseUrl/rest/v1/user_skins?select=skin_id&user_id=eq.$userId&skin_id=eq.$probeUserSkin" -Headers $restHeaders -Body $null
  $null = Invoke-SupabaseJson -Method "Delete" -Uri "$SupabaseUrl/rest/v1/user_skins?user_id=eq.$userId&skin_id=eq.$probeUserSkin" -Headers $restHeaders -Body $null
  $results.user_skins_write = [ordered]@{ ok = $true; inserted = (@($probeUserSkinRead).Count -gt 0); cleaned = $true }

  Write-Step "Lecture public_profiles"
  $publicProfile = Invoke-SupabaseJson -Method "Get" -Uri "$SupabaseUrl/rest/v1/public_profiles?select=user_id,display_name,bio,is_public,show_owned,updated_at&user_id=eq.$userId" -Headers $restHeaders -Body $null
  $profileRow = if (@($publicProfile).Count -gt 0) { $publicProfile[0] } else { $null }
  $results.public_profile_read = [ordered]@{
    ok           = $true
    exists       = ($null -ne $profileRow)
    display_name = if ($profileRow) { $profileRow.display_name } else { "" }
  }

  Write-Step "Upsert public_profiles sans changement visible"
  if ($null -eq $profileRow) {
    $profilePayload = @{
      user_id      = $userId
      display_name = "Codex Probe"
      bio          = "probe"
      is_public    = $true
      show_owned   = $true
      updated_at   = (Get-Date).ToUniversalTime().ToString("o")
    }
  } else {
    $profilePayload = @{
      user_id      = $profileRow.user_id
      display_name = $profileRow.display_name
      bio          = $profileRow.bio
      is_public    = $profileRow.is_public
      show_owned   = $profileRow.show_owned
      updated_at   = $profileRow.updated_at
    }
  }
  $profileWrite = Invoke-SupabaseJson -Method "Post" -Uri "$SupabaseUrl/rest/v1/public_profiles?on_conflict=user_id" -Headers $restWriteHeaders -Body @($profilePayload)
  $results.public_profile_write = [ordered]@{ ok = $true; rows = @($profileWrite).Count }

  Write-Step "Ecriture reversible public_user_skins"
  $null = Invoke-SupabaseJson -Method "Post" -Uri "$SupabaseUrl/rest/v1/public_user_skins?on_conflict=user_id,skin_id" -Headers $restWriteHeaders -Body @(@{ user_id = $userId; skin_id = $probePublicSkin })
  $probePublicSkinRead = Invoke-SupabaseJson -Method "Get" -Uri "$SupabaseUrl/rest/v1/public_user_skins?select=skin_id&user_id=eq.$userId&skin_id=eq.$probePublicSkin" -Headers $restHeaders -Body $null
  $null = Invoke-SupabaseJson -Method "Delete" -Uri "$SupabaseUrl/rest/v1/public_user_skins?user_id=eq.$userId&skin_id=eq.$probePublicSkin" -Headers $restHeaders -Body $null
  $results.public_user_skins_write = [ordered]@{ ok = $true; inserted = (@($probePublicSkinRead).Count -gt 0); cleaned = $true }
}
finally {
  try {
    Invoke-SupabaseJson -Method "Delete" -Uri "$SupabaseUrl/rest/v1/user_skins?user_id=eq.$userId&skin_id=eq.$probeUserSkin" -Headers $restHeaders -Body $null | Out-Null
  } catch {}

  try {
    Invoke-SupabaseJson -Method "Delete" -Uri "$SupabaseUrl/rest/v1/public_user_skins?user_id=eq.$userId&skin_id=eq.$probePublicSkin" -Headers $restHeaders -Body $null | Out-Null
  } catch {}
}

Write-Step "Resultat"
$results | ConvertTo-Json -Depth 6
