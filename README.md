# DependencyCheck VSCode extension

Данное расширение было разработано в рамках выполнения INT-31 PT_Start_2024.1.

Расширение предназначено для запуска OWASP dependency-check для текущего открытого проекта в VSCode с предоставлением отчета о найденных уязвимостях в файлах с зависимостями проекта.
Результат сканирования, файл dependency-check-report, помещается в корень текущего проекта.

## Features

### Список доступных команд:
 - "showExtensionWindow": Основная команда, её необходимо вызвать, чтобы показать окно расширения.
 - "checkInstrumentsInstallation": Команда проверяющая наличие установки обязательных для работы dependency-check анализа инструментов. Так-же проверяет наличие часто используемых пакетов.
 - "updateDependencyCheck": Команда, проверяющая сравнивающая текущую версию dependency-check с актуальной (на github разработчиков), в случае обнаружения отличий в версиях, скачивает новейшую.
   
![image](https://github.com/StrayDeR28/PT_Start_DependencyCheck_VS_Code_extension/assets/79637474/05e524a8-c77a-4034-88d1-089eae7c17a1)

### Запуск сканирования:
  - Реализовано автоматическое уведомление пользователя при изменении файлов с зависимостями ('package.json', 'packages-lock.json', 'pom.xml', 'build.gradle', 'yarn.lock').
  - Проведено исследование, на возможность запуска анализа при коммите/пуше в git. Вероятно, возможно реализовать данную фичу, воспользовавшись хуками (pre-commit, pre-push) на bash.

### Отображение результата:
  - Создана отдельная вкладка - webview, для управления расширением и вывода результатов сканирования. На ней представлены кнопка запуска сканирования, кнопка показа распаршенного результата (только отчета формата JSON), прогрессбар для сканирования и текстовая информация о текущих настройках расширения.
    
![image](https://github.com/StrayDeR28/PT_Start_DependencyCheck_VS_Code_extension/assets/79637474/952e3a49-7464-4326-8b6b-238db364c98c)


![Dependency-check-enxtension-show-compressed](https://github.com/StrayDeR28/PT_Start_DependencyCheck_VS_Code_extension/assets/79637474/4fd3a776-a4bd-48b3-89ce-562483ab852c)


## Список глобальных настроек расширения:
  - "disableAutoUpdate": Эквивалентно включению свойства --noupdate для dependency-check. Отключает автообновление локальной базы данных о уязвимостях, чем заметно ускоряет выполнение проверки.
  - "pathToDC": Путь до папки 'bin', в папке, в которой находится dependency-check на устройстве. По этому же пути будет установливаться новая версия dependency-check при необходимости.
  - "pathToJava": Путь до Java. Не используется, т.к. dependency-check автоматически определяет доступную на устройстве Java.
  - "pathToMaven": Путь до Maven. Не используется, т.к. использовал только CLI версию dependency-check.
  - "reportFileFormat": Настройка формата для файла с отчетом о найденных уязвимых зависимостях. Варианты: {"JSON","XML","HTML"}

![image](https://github.com/StrayDeR28/PT_Start_DependencyCheck_VS_Code_extension/assets/79637474/619a3e10-0a5f-495f-bc7f-81daa5845f26)

## Требования для работы:

Для работы dependency-check необходимо иметь актуальную версию Java. 

Для запуска расширения ест два варианта:
* Cкопировать папку с репозиторием в папку с расширениями VS Code (по стандарту путь: C:\Users\Username\.vscode\extensions)
* В VS Code перейти в раздел с расширениями, сверху-справа нажать на три точки, выбрать варианта "Install from VSIX" и выбрать файл .vsix из репозитория.

![image](https://github.com/StrayDeR28/PT_Start_DependencyCheck_VS_Code_extension/assets/79637474/87c88018-638d-42dc-8a95-7c4c567218c6)
