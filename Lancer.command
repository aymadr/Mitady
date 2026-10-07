#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Installe-le (une seule fois) : https://nodejs.org"
  open "https://nodejs.org" 2>/dev/null
  read -n 1 -s -r -p "Appuie sur une touche pour fermer."
  exit 1
fi
node scripts/launch.js
