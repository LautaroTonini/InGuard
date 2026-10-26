import re


def tel_uri(numero: str) -> str:
    """Convierte un telefono en un link 'tel:' que el celular abre para llamar."""
    return "tel:" + re.sub(r"[^\d+]", "", numero)
