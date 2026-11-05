"""Metric topology in UTM 11N; output stays in the original lon/lat system."""
import math

from pyproj import Geod, Transformer
from shapely.geometry import LineString, Point

TO_XY = Transformer.from_crs(4326, 32611, always_xy=True)
TO_LL = Transformer.from_crs(32611, 4326, always_xy=True)
GEOD = Geod(ellps="WGS84")


def xy(coordinate):
    return TO_XY.transform(*coordinate[:2])


def length(coordinates):
    return sum(GEOD.inv(*a[:2], *b[:2])[2] for a, b in zip(coordinates, coordinates[1:]))


def interpolate(a, b, fraction):
    if fraction <= 0:
        return list(a)
    if fraction >= 1:
        return list(b)
    ax, ay = xy(a)
    bx, by = xy(b)
    lon, lat = TO_LL.transform(ax + fraction * (bx - ax), ay + fraction * (by - ay))
    # Micrometer rounding prevents projection round-off from inventing an
    # uphill step at an otherwise exactly level junction. Original vertices
    # (handled above) remain untouched.
    return [lon, lat, round(a[2] + fraction * (b[2] - a[2]), 6)]


def project(coordinate, a, b):
    line = LineString([xy(a), xy(b)])
    fraction = line.project(Point(xy(coordinate)), normalized=True)
    snapped = interpolate(a, b, fraction)
    return fraction, Point(xy(coordinate)).distance(Point(xy(snapped))), snapped


def valid_coordinate(coordinate, elevation=False):
    count = 3 if elevation else 2
    return (isinstance(coordinate, (list, tuple)) and len(coordinate) >= count
            and all(isinstance(x, (float, int)) and not isinstance(x, bool) and math.isfinite(x)
                    for x in coordinate[:count])
            and -180 <= coordinate[0] <= 180 and -90 <= coordinate[1] <= 90)
