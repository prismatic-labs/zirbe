import type { SiteId } from "../data/types";
import { MAP_FRAME, MAP_PATHS, MAP_WIDTH } from "./map-outlines";

const MID_LAT = (MAP_FRAME.north + MAP_FRAME.south) / 2;
const COS = Math.cos((MID_LAT * Math.PI) / 180);
const SPAN_X = (MAP_FRAME.east - MAP_FRAME.west) * COS;
const SPAN_Y = MAP_FRAME.north - MAP_FRAME.south;
const HEIGHT = (SPAN_Y / SPAN_X) * MAP_WIDTH;

export interface MapDot {
  id: SiteId;
  label: string;
  x: number;
  y: number;
  mark: string;
  hit: number;
  ring: string;
  selected: boolean;
  tabIndex: number;
  nameX: string;
  nameY: string;
  nameAnchor: "start" | "middle" | "end";
  name: string;
}

export interface MapShape {
  viewBox: string;
  paths: { id: string; kind: string; d: string }[];
  labels: { id: string; text: string; x: number; y: number; anchor: "start" | "middle" | "end" }[];
  sites: MapDot[];
}

function project(lon: number, lat: number): { x: number; y: number } {
  return {
    x: ((lon - MAP_FRAME.west) * COS / SPAN_X) * MAP_WIDTH,
    y: ((MAP_FRAME.north - lat) / SPAN_Y) * HEIGHT,
  };
}

const PAD_LEFT = 2;
const PAD_RIGHT = 4;
const PAD_TOP = 6;
const PAD_BOTTOM = 5;

const PLACED: Record<SiteId, { x: string; y: string; anchor: MapDot["nameAnchor"] }> = {
  vienna: { x: "1.2", y: "5.6", anchor: "end" },
  innsbruck: { x: "0", y: "-3.4", anchor: "middle" },
  linz: { x: "0", y: "-3.4", anchor: "middle" },
  zurich: { x: "0", y: "-3.4", anchor: "middle" },
  geneva: { x: "-1", y: "-3.2", anchor: "start" },
  lugano: { x: "0", y: "5.6", anchor: "middle" },
};

function diamond(radius: number): string {
  const edge = radius.toFixed(2);
  return `M 0 -${edge} L ${edge} 0 L 0 ${edge} L -${edge} 0 Z`;
}

const COUNTRY_MARKS: { id: "AT" | "CH"; lon: number; lat: number }[] = [
  { id: "AT", lon: 15.2, lat: 47.15 },
  { id: "CH", lon: 8.75, lat: 46.95 },
];

export function mapShape(
  sites: { id: SiteId; label: string; lat: number; lon: number }[],
  selected: SiteId,
  places: { AT: string; CH: string },
): MapShape {
  return {
    viewBox: `${-PAD_LEFT} ${-PAD_TOP} ${MAP_WIDTH + PAD_LEFT + PAD_RIGHT} ${(HEIGHT + PAD_TOP + PAD_BOTTOM).toFixed(3)}`,
    paths: MAP_PATHS.map((shape) => ({ id: shape.id, kind: shape.kind, d: shape.d })),
    labels: COUNTRY_MARKS.map((mark) => {
      const point = project(mark.lon, mark.lat);
      return { id: mark.id, text: places[mark.id], x: point.x, y: point.y, anchor: "middle" as const };
    }),
    sites: sites.map((site) => {
      const point = project(site.lon, site.lat);
      const on = site.id === selected;
      const place = PLACED[site.id];
      return {
        id: site.id,
        label: site.label,
        x: point.x,
        y: point.y,
        mark: diamond(on ? 2.1 : 1.4),
        hit: 4.4,
        ring: on ? diamond(3.3) : "",
        selected: on,
        tabIndex: 0,
        nameX: place.x,
        nameY: place.y,
        nameAnchor: place.anchor,
        name: site.label,
      };
    }),
  };
}
