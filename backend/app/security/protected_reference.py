import hashlib
import hmac

from ..config import get_settings
from ..services.identifier_service import canonicalize_identifier


def create_protected_reference(identifier_type: str, value: str) -> tuple[str, str]:
    settings = get_settings()
    category = identifier_type.upper()
    canonical = canonicalize_identifier(category, value)
    digest = hmac.new(
        settings.protected_reference_secret.encode(),
        f"{category}|{canonical}".encode(),
        hashlib.sha256,
    ).hexdigest().upper()
    return canonical, f"{category}:{settings.protected_reference_version}:{digest[:16]}"

