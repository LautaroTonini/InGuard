class ApiError(Exception):
    """Error controlado de la API. Se convierte en JSON {"detail": ...} con su status."""

    def __init__(self, status_code: int, detail):
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail
