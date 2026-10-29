from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from .config import postgres_url


@contextmanager
def open_database() -> Iterator[psycopg.Connection]:
    with psycopg.connect(postgres_url, row_factory=dict_row) as connection:
        yield connection
