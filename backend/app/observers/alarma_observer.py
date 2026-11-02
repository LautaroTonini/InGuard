"""
Patrón Observer aplicado a las alarmas de medicación.

Problema que resuelve
---------------------
Cuando se crea, actualiza o elimina una alarma, varios componentes
necesitan reaccionar (logging de auditoría, marcar sincronización,
posibles notificaciones futuras) sin que el controlador conozca
cada uno de ellos. El Observer desacopla el emisor del evento de
los suscriptores.

Por qué es adecuado
-------------------
- Permite agregar nuevos comportamientos (notificaciones push,
  auditoría clínica, métricas) sin modificar alarma_controller.
- Cumple el principio abierto/cerrado.
- Es liviano y no introduce dependencias externas.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger("inguard.observers.alarma")


class AlarmaObserver(ABC):
    """Interfaz que deben implementar los observadores de alarmas."""

    @abstractmethod
    def al_crear(self, alarma: dict, contexto: dict[str, Any] | None = None) -> None:
        ...

    @abstractmethod
    def al_actualizar(self, alarma: dict, cambios: dict, contexto: dict[str, Any] | None = None) -> None:
        ...

    @abstractmethod
    def al_eliminar(self, alarma: dict, contexto: dict[str, Any] | None = None) -> None:
        ...


class LoggingObserver(AlarmaObserver):
    """Registra eventos de alarma para auditoría (sin datos clínicos sensibles)."""

    def al_crear(self, alarma: dict, contexto: dict[str, Any] | None = None) -> None:
        usuario_id = (contexto or {}).get("usuario_id", "?")
        logger.info(
            "Alarma creada id=%s paciente_id=%s medicamento_id=%s por=%s hora=%s",
            alarma.get("_id"),
            alarma.get("paciente_id"),
            alarma.get("medicamento_id"),
            usuario_id,
            alarma.get("hora"),
        )

    def al_actualizar(self, alarma: dict, cambios: dict, contexto: dict[str, Any] | None = None) -> None:
        usuario_id = (contexto or {}).get("usuario_id", "?")
        logger.info(
            "Alarma actualizada id=%s campos=%s por=%s",
            alarma.get("_id"),
            list(cambios.keys()),
            usuario_id,
        )

    def al_eliminar(self, alarma: dict, contexto: dict[str, Any] | None = None) -> None:
        usuario_id = (contexto or {}).get("usuario_id", "?")
        logger.info(
            "Alarma eliminada id=%s paciente_id=%s por=%s",
            alarma.get("_id"),
            alarma.get("paciente_id"),
            usuario_id,
        )


class SyncObserver(AlarmaObserver):
    """
    Observador de ejemplo que podría disparar lógica extra de sincronización
    o notificaciones. Por ahora solo deja traza; es el punto de extensión
    para notificaciones push, WebSocket, etc.
    """

    def al_crear(self, alarma: dict, contexto: dict[str, Any] | None = None) -> None:
        logger.debug("SyncObserver: nueva alarma pendiente de sync id=%s", alarma.get("_id"))

    def al_actualizar(self, alarma: dict, cambios: dict, contexto: dict[str, Any] | None = None) -> None:
        logger.debug("SyncObserver: alarma modificada id=%s", alarma.get("_id"))

    def al_eliminar(self, alarma: dict, contexto: dict[str, Any] | None = None) -> None:
        logger.debug("SyncObserver: alarma eliminada (borrado lógico) id=%s", alarma.get("_id"))


class AlarmaSubject:
    """
    Sujeto observable de eventos de alarma.
    Los controladores notifican; los observers reaccionan.
    """

    def __init__(self) -> None:
        self._observers: list[AlarmaObserver] = []

    def suscribir(self, observer: AlarmaObserver) -> None:
        if observer not in self._observers:
            self._observers.append(observer)

    def desuscribir(self, observer: AlarmaObserver) -> None:
        if observer in self._observers:
            self._observers.remove(observer)

    def notificar_creacion(self, alarma: dict, contexto: dict[str, Any] | None = None) -> None:
        for obs in list(self._observers):
            try:
                obs.al_crear(alarma, contexto)
            except Exception:
                logger.exception("Error en observer al_crear")

    def notificar_actualizacion(
        self, alarma: dict, cambios: dict, contexto: dict[str, Any] | None = None
    ) -> None:
        for obs in list(self._observers):
            try:
                obs.al_actualizar(alarma, cambios, contexto)
            except Exception:
                logger.exception("Error en observer al_actualizar")

    def notificar_eliminacion(self, alarma: dict, contexto: dict[str, Any] | None = None) -> None:
        for obs in list(self._observers):
            try:
                obs.al_eliminar(alarma, contexto)
            except Exception:
                logger.exception("Error en observer al_eliminar")


# Instancia global lista para usar desde los controladores
alarma_subject = AlarmaSubject()
alarma_subject.suscribir(LoggingObserver())
alarma_subject.suscribir(SyncObserver())
