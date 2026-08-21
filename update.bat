@echo off
rem barehands, anatomy edition — check upstream for changes worth taking.
rem Copyright (C) 2026 Jared Rhodenizer
rem Fork additions copyright (C) 2026 the anatomy-edition authors
rem SPDX-License-Identifier: AGPL-3.0-or-later
rem
rem THIS IS A FORK, so updating is not what upstream's updater did. Upstream
rem fast-forwarded main onto jaredrhod/barehands — on a fork that either
rem refuses (divergent history) or, forced, buries the medical layer. So this
rem script never merges. It fetches upstream, shows what is new, and tells
rem you how to take it. See update.sh for the same logic on Mac and Linux.

rem run from a temp copy so updating this very file mid-run cannot garble it
if "%~1"=="__run__" goto run
copy /y "%~f0" "%TEMP%\barehands-update.bat" >nul
call "%TEMP%\barehands-update.bat" __run__ "%~dp0"
exit /b %errorlevel%

:run
setlocal
cd /d "%~2"

if exist ".git\" goto havegit
echo This folder isn't a git repository, so there's nothing to compare.
echo Clone the fork with git if you want upstream tracking.
exit /b 1
:havegit

rem the upstream remote is added if missing, never silently repointed
git remote get-url upstream >nul 2>nul
if not errorlevel 1 goto haveremote
echo adding the 'upstream' remote -^> https://github.com/jaredrhod/barehands.git
git remote add upstream https://github.com/jaredrhod/barehands.git
:haveremote

echo fetching upstream...
git fetch -q upstream
if errorlevel 1 (
  echo couldn't reach upstream ^(offline?^)
  exit /b 1
)

rem where this fork left upstream's history
for /f %%i in ('git merge-base HEAD upstream/main 2^>nul') do set BASE=%%i
if not defined BASE (
  echo no shared history with upstream — nothing sensible to compare.
  exit /b 1
)

for /f %%i in ('git rev-list --count %BASE%..HEAD 2^>nul') do set AHEAD=%%i
for /f %%i in ('git rev-list --count %BASE%..upstream/main 2^>nul') do set NEW=%%i

echo.
echo this fork is %AHEAD% commit(s) ahead of where it left upstream.
if "%NEW%"=="0" (
  echo upstream has nothing new. You're current.
  exit /b 0
)

echo upstream has %NEW% new commit(s):
git log --oneline %BASE%..upstream/main

echo.
echo files upstream changed that this fork also carries edits to:
rem js/medical/, schemas/, cases/, pathology/, review/ and skills/ are ours
rem alone and can never conflict; stage.html and server.py are the shared
rem surface, and that is what to read before merging.
git diff --name-only %BASE%..upstream/main > "%TEMP%\bh_up.txt"
git diff --name-only %BASE%..HEAD > "%TEMP%\bh_our.txt"
findstr /g:"%TEMP%\bh_our.txt" /x "%TEMP%\bh_up.txt" || echo   (none — upstream touched nothing this fork has modified)
del "%TEMP%\bh_up.txt" "%TEMP%\bh_our.txt" >nul 2>nul

echo.
echo Nothing has been merged. To take these changes:
echo.
echo   git diff HEAD...upstream/main -- stage.html   ^(read the shared surface first^)
echo   git merge upstream/main                       ^(then merge deliberately^)
echo.
echo If a MEDICAL HOOK line conflicts, keep BOTH sides: upstream's rewritten
echo line plus the hook comment beside it. The hooks are single lines by
echo design so this stays a two-second resolution.
echo.
echo Your barehands.json is untracked and cannot be touched by any of this.
