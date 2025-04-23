@echo off
echo Kompilowanie programu C# do pliku wykonywalnego...

:: Ustaw ścieżkę do kompilatora C#
set CSC="C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"

:: Kompiluj program
%CSC% /target:winexe /out:KeyboardMacro.exe /reference:System.Windows.Forms.dll KeyboardMacro.cs

:: Sprawdź, czy kompilacja się powiodła
if exist KeyboardMacro.exe (
    echo Kompilacja zakończona sukcesem! Plik KeyboardMacro.exe został utworzony.
) else (
    echo Kompilacja nie powiodła się.
)

echo.
echo Naciśnij dowolny klawisz, aby zakończyć...
pause > nul