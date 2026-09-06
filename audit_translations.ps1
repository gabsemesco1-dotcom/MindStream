$ErrorActionPreference = "Stop"

$projectRoot = "c:\Users\LENOVO\Desktop\please do not delete\MindStream"
$localesDir = Join-Path $projectRoot "src\i18n\locales"
$langs = @("fr", "id", "es", "ar")
$enFile = Join-Path $localesDir "en\translation.json"

$enData = Get-Content -Raw -Path $enFile | ConvertFrom-Json
$enKeys = $enData.PSObject.Properties.Name | Sort-Object

foreach ($lang in $langs) {
    $file = Join-Path $localesDir "$lang\translation.json"
    $data = Get-Content -Raw -Path $file | ConvertFrom-Json
    $keys = $data.PSObject.Properties.Name | Sort-Object
    
    $diff1 = Compare-Object $enKeys $keys -PassThru
    if ($diff1) {
        Write-Host "Mismatch found in $lang!"
        $diff1 | Out-String | Write-Host
        exit 1
    } else {
        Write-Host "$lang is identical to en in structure."
    }
}
Write-Host "All translation files match English perfectly."
