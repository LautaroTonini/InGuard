from app.config import settings


def test_preflight_cors_permite_frontend_y_header_bearer(client):
    origin = settings.CORS_ORIGINS[0]
    response = client.options(
        "/app/snapshot",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == origin
    assert response.headers["Access-Control-Allow-Credentials"] == "true"
    allowed_headers = response.headers["Access-Control-Allow-Headers"].lower()
    assert "authorization" in allowed_headers
    assert "content-type" in allowed_headers
