; Meridian Installer — Minimal, Modern UI inspired by Discord
; Builds a clean installation experience with progress bar and no unnecessary wizardry

!include "MUI2.nsh"
!include "x64.nsh"

; ─────────────────────────────────────────────────────────────────────────────
; Configuration
; ─────────────────────────────────────────────────────────────────────────────

Name "Meridian"
OutFile "$%DIST_DIR%\${INSTALLER_NAME}"
InstallDir "$PROGRAMFILES64\Meridian"
InstallDirRegKey HKLM "Software\Meridian" "InstallLocation"

; Enforce admin rights for system-wide install
RequestExecutionLevel admin

; ─────────────────────────────────────────────────────────────────────────────
; UI: Modern Installer, Minimal Pages
; ─────────────────────────────────────────────────────────────────────────────

!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "build\icon.ico"

; Modern dark theme colors (Discord-inspired)
!define MUI_BGCOLOR "1e1e1e"
!define MUI_TEXTCOLOR "ffffff"
!define MUI_BGCOLOR_BUTTON "2d2d2d"

; Disable unnecessary pages
!define MUI_ABORTWARNING_TEXT "Are you sure you want to exit Meridian Setup?"

; Only show: Welcome, Installing, Finish
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

; ─────────────────────────────────────────────────────────────────────────────
; Install Section
; ─────────────────────────────────────────────────────────────────────────────

Section "Install"
  SectionIn RO  ; Make this section mandatory (grayed out)
  
  SetOutPath "$INSTDIR"
  
  ; Copy all app files
  File /r "dist\${BUILD_ARCH}\*.*"
  
  ; Create Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\Meridian"
  CreateShortCut "$SMPROGRAMS\Meridian\Meridian.lnk" "$INSTDIR\Meridian.exe"
  CreateShortCut "$SMPROGRAMS\Meridian\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  
  ; Create Desktop shortcut
  CreateShortCut "$DESKTOP\Meridian.lnk" "$INSTDIR\Meridian.exe"
  
  ; Registry entries
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Meridian" \
    "DisplayName" "Meridian"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Meridian" \
    "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Meridian" \
    "DisplayIcon" "$INSTDIR\Meridian.exe"
  WriteRegStr HKLM "Software\Meridian" "InstallLocation" "$INSTDIR"
  
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  DetailPrint "Meridian installed successfully"
SectionEnd

; ─────────────────────────────────────────────────────────────────────────────
; Uninstall Section
; ─────────────────────────────────────────────────────────────────────────────

Section "Uninstall"
  ; Remove shortcuts
  Delete "$DESKTOP\Meridian.lnk"
  RMDir /r "$SMPROGRAMS\Meridian"
  
  ; Remove app directory
  RMDir /r "$INSTDIR"
  
  ; Remove registry entries
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Meridian"
  DeleteRegKey HKLM "Software\Meridian"
  
  DetailPrint "Meridian uninstalled"
SectionEnd

; ─────────────────────────────────────────────────────────────────────────────
; Helper Functions & Custom UI Callbacks
; ─────────────────────────────────────────────────────────────────────────────

Function .onInit
  ${If} ${RunningX64}
    SetRegView 64
  ${Else}
    MessageBox MB_OK "Meridian requires 64-bit Windows"
    Quit
  ${EndIf}
FunctionEnd

Function .onInstSuccess
  SetAutoClose true
FunctionEnd
