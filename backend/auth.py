import os
from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, ExpiredSignatureError, jwt

JWT_SECRET = os.getenv("JWT_SECRET", "lab7-super-secret-key-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_SECONDS = int(os.getenv("JWT_EXPIRE_SECONDS", "60"))

# Permisiunile disponibile in aplicatie si ce pot face:
#
#   READ    — vede lista de cheltuieli, categorii, salariu
#   WRITE   — adauga si editeaza cheltuieli, categorii, salariu
#   DELETE  — sterge cheltuieli si categorii
#   ANALYZE — acceseaza /stats, exporturi CSV/LLM, dashboard cu grafice
#
# Nu exista roluri. Tokenul stocheaza direct lista de permisiuni.
# Exemplu token payload: { "permissions": ["READ", "ANALYZE"], "exp": ... }

ALL_PERMISSIONS = ["READ", "WRITE", "DELETE", "ANALYZE"]

bearer_scheme = HTTPBearer()


def create_token(permissions: List[str]) -> str:
    payload = {
        "permissions": permissions,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=JWT_EXPIRE_SECONDS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_permission(permission: str):
    """FastAPI dependency — verifica o permisiune specifica din token."""

    def dependency(
        credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    ) -> dict:
        payload = _decode(credentials.credentials)
        permissions: List[str] = payload.get("permissions", [])

        if permission not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden — requires '{permission}' permission",
                headers={"X-Your-Permissions": ", ".join(permissions)},
            )
        return payload

    return dependency


# Shorthand-uri folosite in route decorators
READ    = Depends(require_permission("READ"))
WRITE   = Depends(require_permission("WRITE"))
DELETE  = Depends(require_permission("DELETE"))
ANALYZE = Depends(require_permission("ANALYZE"))