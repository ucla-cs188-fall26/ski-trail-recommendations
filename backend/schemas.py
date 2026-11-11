from typing import Literal

from pydantic import BaseModel, Field, model_validator


class Endpoint(BaseModel):
    """Either a raw coordinate or a named feature (lift or trail)."""
    coordinate: tuple[float, float] | None = Field(None, description="[longitude, latitude]")
    feature_id: str | None = None

    @model_validator(mode="after")
    def exactly_one(self):
        if (self.coordinate is None) == (self.feature_id is None):
            raise ValueError("Give exactly one of coordinate or feature_id")
        return self


class RouteRequest(BaseModel):
    start: Endpoint
    destination: Endpoint
    allow: list[Literal["green", "blue", "black"]] = ["green", "blue", "black"]
    include_unknown: bool = False
    max_snap_m: float = Field(10, ge=0, le=20)
