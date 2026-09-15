import os
import sys
from pathlib import Path

# Configuración mínima para importar la app sin tocar una base real:
# el pool se crea recién en la primera consulta y estas pruebas no consultan.
os.environ.setdefault("DATABASE_URL", "postgresql://prueba:prueba@127.0.0.1:1/prueba")
os.environ.setdefault("API_KEY", "clave-movil-de-prueba-0123456789")
os.environ.setdefault("AUTH_SECRET", "secreto-de-prueba-0123456789-abcdefghij")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("TRUSTED_HOSTS", "testserver,localhost")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
