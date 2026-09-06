$ErrorActionPreference = "Stop"

$projectRoot = "c:\Users\LENOVO\Desktop\please do not delete\MindStream"
$localesDir = Join-Path $projectRoot "src\i18n\locales"
$langs = @("en", "fr", "id")

$unusedKeys = @(
    "signOut",
    "createTask",
    "save",
    "welcome",
    "deepFocus",
    "aiAnalysisSuccess",
    "taskProgressionSynced",
    "organizeYourStudies",
    "organizeYourStudiesDesc",
    "achieveYourGoals",
    "achieveYourGoalsDesc",
    "searchTaskDatabase",
    "levelUp",
    "deepStudyModulesActive",
    "yearCompletion",
    "upcomingExams",
    "inProgress",
    "noScheduleBlocks",
    "upcomingHighlights",
    "academicTasks",
    "manageChecklists",
    "academicStreakTracker",
    "keepStudyingDaily",
    "currentStudyCategory",
    "tutorTopics",
    "addNewTask",
    "subjectLabel",
    "subjectPlaceholder",
    "selectSubject",
    "subjectComputerScience",
    "subjectMathematics",
    "subjectModernHistory",
    "subjectAppliedPhysics",
    "subjectBiology",
    "subjectGeneralStudy",
    "statusLabel",
    "noUpcomingHighlights",
    "levelHighSchool",
    "levelUndergradFirst",
    "levelUndergradSophomore",
    "levelUndergradJunior",
    "levelUndergradSenior",
    "levelPostgrad",
    "levelLifelong"
)

foreach ($lang in $langs) {
    $file = Join-Path $localesDir "$lang\translation.json"
    if (Test-Path $file) {
        # Read as string, parse json
        $content = Get-Content -Raw -Path $file | ConvertFrom-Json
        
        # Remove unused keys
        foreach ($key in $unusedKeys) {
            if ($content.PSObject.Properties.Match($key).Count -gt 0) {
                $content.PSObject.Properties.Remove($key)
            }
        }

        # Convert back to JSON and write to file
        # ConvertTo-Json uses 2 spaces by default and sorts if we don't be careful, but ConvertFrom-Json -> ConvertTo-Json in PS maintains order mostly.
        # Let's specify depth 100 just in case.
        $jsonStr = $content | ConvertTo-Json -Depth 100
        # ConvertTo-Json in PS5 sometimes escapes unicode. Let's fix utf8 encoding.
        [System.IO.File]::WriteAllText($file, $jsonStr, [System.Text.Encoding]::UTF8)
        Write-Host "Updated $file"
    }
}
