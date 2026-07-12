import re

from fastapi import HTTPException, status


def canonicalize_msisdn(value: str) -> str:
    if re.search(r"[A-Za-z]", value):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"code": "INVALID_MSISDN", "message": "The submitted mobile number could not be standardised."})
    compact = re.sub(r"[\s()\-]", "", value)
    if compact.startswith("0"):
        compact = "+256" + compact[1:]
    elif compact.startswith("256"):
        compact = "+" + compact
    if not re.fullmatch(r"\+256\d{9}", compact):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"code": "INVALID_MSISDN", "message": "Use a valid Ugandan number such as 0772315500."})
    return compact


def canonicalize_nin(value: str) -> str:
    compact = re.sub(r"[\s\-]", "", value).upper()
    # Prototype shape validation only; this does not establish a genuine NIRA identity.
    if not re.fullmatch(r"[A-Z]{2}[A-Z0-9]{10,18}", compact):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"code": "INVALID_NIN", "message": "The identifier does not meet the prototype NIN format rule."})
    return compact


def canonicalize_identifier(identifier_type: str, value: str) -> str:
    if identifier_type == "MSISDN":
        return canonicalize_msisdn(value)
    if identifier_type == "NIN":
        return canonicalize_nin(value)
    compact = re.sub(r"[\s\-]", "", value).upper()
    if not compact or len(compact) > 80:
        raise HTTPException(422, detail={"code": "INVALID_IDENTIFIER", "message": "The submitted identifier is invalid."})
    return compact

