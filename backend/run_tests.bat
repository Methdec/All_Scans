@echo off
REM Script pour exécuter les tests du backend
echo 🚀 Exécution des tests du backend All Scans
echo.

cd /d "%~dp0"

REM Vérifier si l'environnement virtuel existe
if not exist "venv\Scripts\activate.bat" (
    echo ❌ Environnement virtuel non trouvé
    echo Veuillez exécuter d'abord : python -m venv venv
    pause
    exit /b 1
)

REM Activer l'environnement virtuel
call venv\Scripts\activate.bat

REM Exécuter les tests
echo 📊 Lancement des tests de performance...
python tests\test_import_performance.py

REM Garder la fenêtre ouverte
echo.
echo ✅ Tests terminés
pause