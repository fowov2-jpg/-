# Сборка для выпуска — 0.8.3-rc.1

Требования: JDK 17, Gradle 8.11.1, Android SDK platform 36. Android Gradle Plugin 8.10.1. Минимальная ОС: Android 8.0 с актуальным System WebView. Target/compile SDK: 36.

Требование Google Play к target SDK 36 действует с 31 августа 2026 года: https://developer.android.com/google/play/requirements/target-sdk (проверено 24.10.2026). Для RuStore или прямой установки также можно использовать APK этой сборки.

## Проверки

```sh
npm test
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
npm run test:ui
npm run test:balance
npm run test:performance
gradle -p android assembleDebug assembleRelease bundleRelease lintDebug lintRelease assembleDebugAndroidTest --no-daemon
```

В CI инструментальные тесты запускаются на Android 15 и 16 (API 35/36). Локальная сборка тестового APK сама по себе не подтверждает прохождение тестов на устройстве. Отдельные тесты проверяют реальную нативную передачу JSON через URI, отчёт смены, обучение, финансы, паузу и системные отступы.

## Подпись издателя

Без ключа издателя release APK/AAB остаются неподписанными. Debug APK подписан тестовым ключом и предназначен для проверки. Ключ предыдущего APK необходим для совместимого обновления установленной игры.

Для финальной подписи передайте в окружение сборки все четыре значения:

- `UPRAVDOM_KEYSTORE` — абсолютный путь к существующему keystore издателя;
- `UPRAVDOM_KEY_ALIAS` — алиас ключа;
- `UPRAVDOM_KEYSTORE_PASSWORD` — пароль хранилища;
- `UPRAVDOM_KEY_PASSWORD` — пароль ключа.

Затем выполните:

```sh
gradle -p android assembleRelease bundleRelease --no-daemon
```

Gradle включает подпись только при наличии всех четырёх переменных; частичная конфигурация завершается ошибкой. Пароли не включаются в исходники, вывод команд или артефакты. Keystore не добавляется в Git. Отсутствующий постоянный ключ не заменяется автоматически случайным ключом.

## Перед размещением

Издателю нужны: выбранный магазин и доступ к его кабинету; постоянный ключ/Play App Signing; контакт поддержки и публичный URL политики; анкета возрастного рейтинга и данных; визуальная приёмка и проверка на собственном Android-устройстве. Тексты подготовлены в STORE_LISTING_RU.md и PRIVACY.md.

Название «кандидат в релиз» означает подготовленную сборку для приёмки. Оно не подтверждает публикацию в магазине или прохождение ручной приёмки владельцем.
