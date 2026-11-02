"""
Patrón Observer para eventos del dominio (principalmente alarmas).

Subject: AlarmaSubject
Observers: LoggingObserver, SyncObserver (extensibles)
"""

from .alarma_observer import (
    AlarmaSubject,
    LoggingObserver,
    SyncObserver,
    alarma_subject,
)

__all__ = [
    "AlarmaSubject",
    "LoggingObserver",
    "SyncObserver",
    "alarma_subject",
]
