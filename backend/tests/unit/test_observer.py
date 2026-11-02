"""Pruebas unitarias del patrón Observer de alarmas."""

from app.observers.alarma_observer import AlarmaSubject, AlarmaObserver


class ObserverFake(AlarmaObserver):
    def __init__(self):
        self.creadas = []
        self.actualizadas = []
        self.eliminadas = []

    def al_crear(self, alarma, contexto=None):
        self.creadas.append((alarma, contexto))

    def al_actualizar(self, alarma, cambios, contexto=None):
        self.actualizadas.append((alarma, cambios, contexto))

    def al_eliminar(self, alarma, contexto=None):
        self.eliminadas.append((alarma, contexto))


def test_observer_notifica_creacion_actualizacion_eliminacion():
    subject = AlarmaSubject()
    fake = ObserverFake()
    subject.suscribir(fake)

    alarma = {"_id": "a1", "paciente_id": "p1", "hora": "08:00"}
    subject.notificar_creacion(alarma, contexto={"usuario_id": "u1"})
    subject.notificar_actualizacion(alarma, {"hora": "09:00"}, contexto={"usuario_id": "u1"})
    subject.notificar_eliminacion(alarma, contexto={"usuario_id": "u1"})

    assert len(fake.creadas) == 1
    assert fake.creadas[0][0]["_id"] == "a1"
    assert len(fake.actualizadas) == 1
    assert fake.actualizadas[0][1]["hora"] == "09:00"
    assert len(fake.eliminadas) == 1
