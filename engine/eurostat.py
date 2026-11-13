"""Read single values from a Eurostat JSON-stat document."""

from __future__ import annotations

from typing import Any


def value(doc: dict[str, Any], **coords: str) -> float:
    """The value at the given category codes. Dimensions with one category may be left out."""
    position, stride = 0, 1
    for dim, size in reversed(list(zip(doc["id"], doc["size"]))):
        index = doc["dimension"][dim]["category"]["index"]
        if dim in coords:
            if coords[dim] not in index:
                raise KeyError(f"{doc.get('label', 'dataset')}: no {dim}={coords[dim]}")
            position += index[coords[dim]] * stride
        elif size != 1:
            raise KeyError(f"{dim} has {size} categories; say which one")
        stride *= size
    found = doc["value"].get(str(position))
    if found is None:
        raise KeyError(f"{doc.get('label', 'dataset')}: no value at {coords}")
    return float(found)
