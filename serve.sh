#!/bin/sh
# Lance le jeu sur http://localhost:8000 (nécessite Python 3)
cd "$(dirname "$0")"
echo "Ouvre http://localhost:8000 dans Chrome ou Edge (Ctrl+C pour arrêter)"
python3 -m http.server 8000
