"""Fecha y hora de operación en Lima.

El servidor (Render) y la base (Neon) corren en UTC: `date.today()` cambia de
día a las 19:00 hora de Lima. Toda regla que dependa de "hoy" (fecha por
defecto de guías y viajes, saldo diario de ha, códigos mensuales, reportes)
debe usar estas funciones.
"""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

ZONA = ZoneInfo("America/Lima")


def ahora() -> datetime:
    return datetime.now(ZONA)


def hoy() -> date:
    return ahora().date()


def hora_actual() -> time:
    return ahora().time().replace(second=0, microsecond=0, tzinfo=None)
