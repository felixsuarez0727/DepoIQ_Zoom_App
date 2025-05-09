import pyotp
import os
from dotenv import load_dotenv
import sys

# Carga las variables de entorno desde el .env en el directorio raíz
env_path = os.path.join(os.path.dirname(__file__), '../../.env')
load_dotenv(env_path)

try:
    secret = os.getenv('TOTP_SECRET')
    if not secret:
        raise ValueError("TOTP_SECRET no encontrado en .env")
    
    totp = pyotp.TOTP(secret)
    print(totp.now(), end='')
except Exception as e:
    print(f"ERROR: {str(e)}", file=sys.stderr)
    sys.exit(1)