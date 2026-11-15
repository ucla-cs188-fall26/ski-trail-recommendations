/** Shapes returned by the FastAPI backend in backend/main.py (see README "Endpoints"). */

export interface Camera {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface ResortMeta {
  id: string;
  name: string;
  camera?: Camera;
  /** [[west, south], [east, north]] */
  bounds?: [[number, number], [number, number]];
}

export type FeatureKind = 'runs' | 'lifts' | 'spots' | 'ski_area';

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: string; coordinates: unknown };
    properties: Record<string, unknown>;
  }>;
}

export interface SearchHit {
  id: string;
  name: string;
  kind: 'lift' | 'trail' | string;
  difficulty: string | null;
}

import type { RouteDifficulty } from '../../models/profile';

/** The router only knows three groups: OpenSkiMap advanced + expert are both "black". */
export type { RouteDifficulty };

export type Endpoint = { feature_id: string } | { coordinate: [number, number] };

export interface RouteRequest {
  start: Endpoint;
  destination: Endpoint;
  allow: RouteDifficulty[];
  include_unknown?: boolean;
  max_snap_m?: number;
}

export interface RouteResponse {
  status: 'ok' | 'unreachable' | 'snap_failed';
  message: string;
  total_trail_distance_m: number;
  total_lift_distance_m: number;
  total_connector_distance_m: number;
  lifts_used: { id: string; name: string | null }[];
  geojson: FeatureCollection;
}

export type ApiErrorCode = 'network' | 'not_found' | 'bad_request' | 'server';
