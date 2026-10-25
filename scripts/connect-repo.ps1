$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$repoUrl = 'https://github.com/ayushp06/hackathon-fa26.git'
$remotes = @(git remote)
if ($LASTEXITCODE -ne 0) { throw 'This directory must be a Git repository.' }
$existingUrl = $null
if ($remotes -contains 'origin') {
    $existingUrl = git remote get-url origin
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect origin.' }
}
if ($existingUrl -and $existingUrl -ne $repoUrl) {
    throw "origin already points to $existingUrl. Review it before changing remotes."
}
if (-not $existingUrl) {
    git remote add origin $repoUrl
    if ($LASTEXITCODE -ne 0) { throw 'Could not add origin.' }
}
git config remote.pushDefault origin
if ($LASTEXITCODE -ne 0) { throw 'Could not set push remote.' }
git config push.default current
if ($LASTEXITCODE -ne 0) { throw 'Could not set push behavior.' }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'Could not fetch repository. Check GitHub access.' }
git remote -v
Write-Host 'Connected. Inspect remote branches with git branch -r before committing.'
