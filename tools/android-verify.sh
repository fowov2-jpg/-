#!/usr/bin/env bash
set -eu
if gradle -p android connectedDebugAndroidTest --no-daemon; then
  mkdir -p test-results/android
  for mode in threebutton gestural; do
    adb exec-out cat "/sdcard/Pictures/UpravdomVerification/${mode}.jpg" > "test-results/android/${mode}.jpg"
  done
  adb exec-out cat /sdcard/Pictures/UpravdomVerification/dispatch-restored.png > test-results/android/dispatch-restored.png
  python3 -c "from pathlib import Path; files=list(Path('test-results/android').glob('*.jpg')); assert len(files)==2; assert all(p.read_bytes().startswith(bytes([255,216,255])) and p.stat().st_size>1000 for p in files)"
  for mode in threebutton gestural; do
    echo "UPRAVDOM_ANDROID_PREVIEW_${mode} $(base64 -w0 test-results/android/${mode}.jpg)"
  done
else
  mkdir -p test-results/android
  if ! adb exec-out cat /sdcard/Pictures/UpravdomVerification/dispatch-restored.png > test-results/android/failure.png; then
    adb exec-out screencap -p > test-results/android/failure.png || true
  fi
  adb logcat -d -t 2000 -v threadtime > test-results/android/logcat.txt || true
  adb shell dumpsys window windows > test-results/android/windows.txt || true
  adb shell dumpsys activity activities > test-results/android/activities.txt || true
  python3 -c "from pathlib import Path; import xml.etree.ElementTree as E; [print(E.tostring(n, encoding='unicode')) for p in Path('android/app/build/outputs/androidTest-results').rglob('*.xml') for n in E.parse(p).iter('failure')]"
  exit 1
fi
