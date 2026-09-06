$ErrorActionPreference = "Stop"

$projectRoot = "c:\Users\LENOVO\Desktop\please do not delete\MindStream"
$localesDir = Join-Path $projectRoot "src\i18n\locales"
$enTranslationFile = Join-Path $localesDir "en\translation.json"
$srcDir = Join-Path $projectRoot "src"

$enData = Get-Content -Raw -Path $enTranslationFile | ConvertFrom-Json
$keys = $enData.PSObject.Properties.Name

$files = Get-ChildItem -Path $srcDir -Include *.ts,*.tsx,*.js,*.jsx -Recurse
$fileContents = foreach ($file in $files) {
    Get-Content -Raw -Path $file.FullName
}

$unusedKeys = @()

foreach ($key in $keys) {
    $isUsed = $false
    # using simple .Contains for speed and safety
    $q1 = "'$key'"
    $q2 = "`"$key`""
    $q3 = "``$key``"
    foreach ($content in $fileContents) {
        if ($content.Contains($q1) -or $content.Contains($q2) -or $content.Contains($q3) -or $content.Contains("=$key ")) {
            $isUsed = $true
            break
        }
    }
    if (-not $isUsed) {
        $unusedKeys += $key
    }
}

$unusedKeys | ConvertTo-Json
