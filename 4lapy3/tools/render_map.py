#!/usr/bin/env python3
"""Render an accurate local OpenStreetMap neighbourhood image with Pillow.

Data source (OSM map API, WGS84):
https://api.openstreetmap.org/api/0.6/map?bbox=16.9880,51.0435,17.0115,51.0526
Address: OSM node 12862580150, Chabrowa 2D, 51.0480638 / 16.9997411.
OSM data © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright

Usage: python render_map.py --source /path/to/map-source-api.json
Mobile: python render_map.py --source /path/to/map-source-api.json --mobile
Background for HTML overlays: add --background-only (can combine with --mobile).
Without --source the script fetches the documented OSM XML export.
Requires Pillow. Output is a north-up, metric 1500 × 1000 m view.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFilter, ImageFont


URL = "https://api.openstreetmap.org/api/0.6/map?bbox=16.9880,51.0435,17.0115,51.0526"
CENTER_LAT, CENTER_LON = 51.0480638, 16.9997411
WIDTH, HEIGHT, SCALE = 1800, 1200, 2
VIEW_METERS = 1500
PX_PER_M = WIDTH / VIEW_METERS
# Warm stone cartography with ink lettering; geography remains sourced from OSM.
INK = "#253447"
PIN = "#a4533e"
PAPER = "#f5f0e9"
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")


def font(size, bold=False):
    filename = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(str(FONT_DIR / filename), round(size * SCALE))


def xy(point):
    meters_x = (point["lon"] - CENTER_LON) * 111320 * math.cos(math.radians(CENTER_LAT))
    meters_y = (point["lat"] - CENTER_LAT) * 111320
    return WIDTH / 2 + meters_x * PX_PER_M, HEIGHT / 2 - meters_y * PX_PER_M


def scaled(points):
    return [(round(x * SCALE), round(y * SCALE)) for x, y in points]


def bounds(points):
    return min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)


def intersects(a, b, pad=0):
    return not (a[2] + pad <= b[0] or b[2] + pad <= a[0] or a[3] + pad <= b[1] or b[3] + pad <= a[1])


def polyline(draw, points, fill, width):
    draw.line(scaled(points), fill=fill, width=round(width * SCALE), joint="curve")


def length(points):
    return sum(math.dist(a, b) for a, b in zip(points, points[1:]))


def along(points, distance):
    for a, b in zip(points, points[1:]):
        seg = math.dist(a, b)
        if distance <= seg and seg:
            f = distance / seg
            return a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
        distance -= seg
    return points[-1]


def fetch_data():
    request = urllib.request.Request(URL, headers={"User-Agent": "CzteryLapyMapRenderer/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        root = ET.fromstring(response.read())
    nodes = {int(node.attrib["id"]): node for node in root.findall("node")}
    elements = []
    for node_id, node in nodes.items():
        elements.append({"type": "node", "id": node_id, "lat": float(node.attrib["lat"]), "lon": float(node.attrib["lon"]), "tags": {t.attrib["k"]: t.attrib["v"] for t in node.findall("tag")}})
    for way in root.findall("way"):
        points = [nodes[int(n.attrib["ref"])] for n in way.findall("nd") if int(n.attrib["ref"]) in nodes]
        elements.append({"type": "way", "id": int(way.attrib["id"]), "tags": {t.attrib["k"]: t.attrib["v"] for t in way.findall("tag")}, "geometry": [{"lat": float(n.attrib["lat"]), "lon": float(n.attrib["lon"])} for n in points]})
    return {"source": URL, "elements": elements}


def render(data, output, mobile=False, background_only=False):
    image = Image.new("RGB", (WIDTH * SCALE, HEIGHT * SCALE), PAPER)
    draw = ImageDraw.Draw(image)
    ways = []
    for element in data["elements"]:
        geometry = element.get("geometry", [])
        if element["type"] != "way" or len(geometry) < 2:
            continue
        points = [xy(p) for p in geometry]
        if intersects(bounds(points), (0, 0, WIDTH, HEIGHT)):
            ways.append((element, points))

    # Every filled shape follows the supplied OSM way geometry.
    for element, points in ways:
        tags = element.get("tags", {})
        if len(points) < 3 or math.dist(points[0], points[-1]) > 0.1:
            continue
        landuse, natural, leisure = tags.get("landuse"), tags.get("natural"), tags.get("leisure")
        fill = None
        if landuse in {"residential", "retail", "commercial", "education"}:
            fill = "#eee7de"
        elif landuse in {"construction", "brownfield", "industrial", "farmyard"}:
            fill = "#e9e1d7"
        elif landuse in {"grass", "greenfield", "meadow", "village_green", "recreation_ground", "farmland", "allotments", "orchard"} or natural in {"grassland", "scrub"}:
            fill = "#e7e5d9"
        elif landuse == "forest" or natural == "wood":
            fill = "#d6dbcc"
        elif leisure in {"park", "garden", "playground", "pitch"}:
            fill = "#e0e3d4"
        elif natural == "water" or tags.get("water"):
            fill = "#c9dbe5"
        if fill:
            draw.polygon(scaled(points), fill=fill)

    for element, points in ways:
        tags = element.get("tags", {})
        if tags.get("waterway"):
            polyline(draw, points, "#c9dbe5", 3)
        if tags.get("natural") == "tree_row":
            polyline(draw, points, "#dce0d1", 5)
        if tags.get("building") and len(points) > 2:
            draw.polygon(scaled(points), fill="#ddd5cb", outline="#c4b8ab", width=SCALE)
        elif tags.get("amenity") == "parking" and len(points) > 2 and points[0] == points[-1]:
            draw.polygon(scaled(points), fill="#e4ded5")

    roads = [(element, points) for element, points in ways if element.get("tags", {}).get("highway")]
    widths = {"tertiary": 21, "residential": 14, "living_street": 12, "service": 8, "pedestrian": 7, "footway": 3, "path": 2.5, "track": 4, "steps": 3}
    roads.sort(key=lambda item: widths.get(item[0]["tags"]["highway"], 0))
    for element, points in roads:
        road_type = element["tags"]["highway"]
        # Unopened/proposed roads are not shown as navigable streets.
        if road_type not in widths:
            continue
        width = widths[road_type]
        polyline(draw, points, "#d1c5b8", width + 2)
        polyline(draw, points, "#fffdf9" if width >= 7 else "#faf7f2", width)

    # Label only named streets whose actual geometry is in this map extent.
    groups = {}
    for element, points in roads:
        tags = element["tags"]
        if tags.get("name") and tags["highway"] in {"tertiary", "residential", "living_street", "service"}:
            groups.setdefault(tags["name"], []).append(points)

    cx, cy = WIDTH / 2, HEIGHT / 2
    occupied = [(cx-265, cy-229, cx+265, cy+18), (28, 24, 335, 122), (40, HEIGHT-100, 310, HEIGHT-10), (WIDTH-560, HEIGHT-60, WIDTH, HEIGHT)]
    names = ["Chabrowa", "Radosna"] if mobile else ["Chabrowa", "Radosna", "Bratnia", "Działkowa", "Brzozowa", "Różana", "Sezamkowa", "Irysowa", "Cztery Podkowy", "Jaśminowa", "Wiosenna", "Konna", "Ogrodowa"]
    placed = []
    for name in names:
        if name not in groups:
            continue
        size = (50 if mobile else 46) if name in {"Chabrowa", "Radosna", "Bratnia"} else 40
        typeface = font(size)
        text_box = draw.textbbox((0, 0), name, font=typeface, stroke_width=4 * SCALE)
        tw, th = text_box[2] - text_box[0], text_box[3] - text_box[1]
        label = Image.new("RGBA", (tw + 24 * SCALE, th + 16 * SCALE), (0, 0, 0, 0))
        ld = ImageDraw.Draw(label)
        ld.text((12 * SCALE - text_box[0], 8 * SCALE - text_box[1]), name, font=typeface, fill="#465261", stroke_width=4 * SCALE, stroke_fill="#f5f0e9")
        success = False
        for points in sorted(groups[name], key=length, reverse=True):
            total = length(points)
            fractions = [0.5, 0.3, 0.7, 0.18, 0.82, 0.4, 0.6]
            if mobile:
                fractions += [step / 100 for step in range(5, 96)]
            for fraction in fractions:
                distance = total * fraction
                center = along(points, distance)
                before = along(points, max(0, distance - 85))
                after = along(points, min(total, distance + 85))
                angle = math.degrees(math.atan2(after[1] - before[1], after[0] - before[0]))
                if angle > 90:
                    angle -= 180
                if angle < -90:
                    angle += 180
                rotated = label.rotate(-angle, resample=Image.Resampling.BICUBIC, expand=True)
                rw, rh = rotated.width / SCALE, rotated.height / SCALE
                box = (center[0] - rw / 2, center[1] - rh / 2, center[0] + rw / 2, center[1] + rh / 2)
                if box[0] < 25 or box[1] < 25 or box[2] > WIDTH - 25 or box[3] > HEIGHT - 35:
                    continue
                if any(intersects(box, existing, 13) for existing in occupied):
                    continue
                image.paste(rotated, (round(box[0] * SCALE), round(box[1] * SCALE)), rotated)
                occupied.append(box)
                placed.append(name)
                success = True
                break
            if success:
                break

    draw = ImageDraw.Draw(image)
    # Background-only images leave the heading and address marker to HTML.
    if not background_only:
        draw.rounded_rectangle((34*SCALE, 30*SCALE, 319*SCALE, 115*SCALE), 12*SCALE, fill="#fcf9f5")
        draw.text((60*SCALE, 45*SCALE), "Wysoka", font=font(44, True), fill=INK)
    draw.text(((WIDTH-71)*SCALE, 37*SCALE), "N", font=font(28, True), fill=INK)
    draw.polygon(scaled([(WIDTH-60, 80), (WIDTH-70, 111), (WIDTH-60, 103), (WIDTH-50, 111)]), fill=INK)

    # Pin tip sits exactly on the verified address coordinate, at the centre.
    # Keep this complete-map mode unchanged; HTML overlays use background-only.
    if not background_only:
        shadow = Image.new("RGBA", image.size)
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_draw.rounded_rectangle(((cx-250)*SCALE, (cy-218)*SCALE, (cx+250)*SCALE, (cy-89)*SCALE), 19*SCALE, fill=(37,52,71,45))
        shadow_draw.ellipse(((cx-36)*SCALE, (cy-13)*SCALE, (cx+36)*SCALE, (cy+12)*SCALE), fill=(37,52,71,60))
        shadow = shadow.filter(ImageFilter.GaussianBlur(10*SCALE))
        image.paste(shadow, (0,0), shadow)
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle(((cx-250)*SCALE, (cy-229)*SCALE, (cx+250)*SCALE, (cy-102)*SCALE), 17*SCALE, fill="#fffcf8", outline="#cfc2b4", width=SCALE)
        draw.text((cx*SCALE, (cy-198)*SCALE), "Cztery Łapy i Ty", font=font(40 if mobile else 38,True), fill=INK, anchor="mt")
        draw.text((cx*SCALE, (cy-146)*SCALE), "Chabrowa 2D", font=font(34 if mobile else 31), fill="#61564f", anchor="mt")
        draw.ellipse(((cx-38)*SCALE, (cy-101)*SCALE, (cx+38)*SCALE, (cy-25)*SCALE), fill=PIN, outline="#fffcf8", width=4*SCALE)
        draw.polygon(scaled([(cx-28,cy-38),(cx+28,cy-38),(cx,cy)]), fill=PIN)
        draw.ellipse(((cx-11)*SCALE,(cy-74)*SCALE,(cx+11)*SCALE,(cy-52)*SCALE), fill="#fffcf8")
        draw.ellipse(((cx-5)*SCALE,(cy-5)*SCALE,(cx+5)*SCALE,(cy+5)*SCALE), fill="#fffcf8", outline=PIN, width=2*SCALE)

    # Scale is tied to the metric projection rather than a decorative graphic.
    scale_width = 100 * PX_PER_M
    sx, sy = 55, HEIGHT-62
    draw.rounded_rectangle((35*SCALE,(sy-53)*SCALE,(sx+scale_width+24)*SCALE,(sy+27)*SCALE),8*SCALE,fill="#fcf9f5")
    draw.text((sx*SCALE,(sy-46)*SCALE),"100 m",font=font(26),fill=INK)
    draw.line(scaled([(sx,sy-10),(sx,sy),(sx+scale_width,sy),(sx+scale_width,sy-10)]),fill=INK,width=3*SCALE)
    attribution="© OpenStreetMap contributors"
    at_font=font(24)
    ab=draw.textbbox((0,0),attribution,font=at_font)
    aw=ab[2]-ab[0]
    ax=WIDTH*SCALE-aw-28*SCALE
    ay=(HEIGHT-45)*SCALE
    draw.rectangle((ax-15*SCALE,ay-6*SCALE,WIDTH*SCALE,HEIGHT*SCALE),fill="#fcf9f5")
    draw.text((ax,ay),attribution,font=at_font,fill="#465261")

    image=image.resize((WIDTH,HEIGHT),Image.Resampling.LANCZOS)
    output.parent.mkdir(parents=True,exist_ok=True)
    image.save(output,"WEBP",quality=91,method=6)
    print(json.dumps({"path":str(output),"width":WIDTH,"height":HEIGHT,"bytes":output.stat().st_size,"streets_labeled":placed,"source":data.get("source",URL),"center":[CENTER_LAT,CENTER_LON]},ensure_ascii=False))


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source",type=Path)
    parser.add_argument("--output",type=Path)
    parser.add_argument("--mobile",action="store_true",help="1200 × 900 px, 800 × 600 m closer mobile map")
    parser.add_argument("--background-only",action="store_true",help="Omit the address label, pin and Wysoka badge for an HTML overlay")
    arguments=parser.parse_args()
    if arguments.mobile:
        WIDTH, HEIGHT, VIEW_METERS = 1200, 900, 800
        PX_PER_M = WIDTH / VIEW_METERS
    if arguments.output is None:
        stem="map-wysoka-base" if arguments.background_only else "map-wysoka"
        arguments.output=Path(__file__).resolve().parents[1]/"assets"/(stem+("-mobile" if arguments.mobile else "")+".webp")
    data=json.loads(arguments.source.read_text(encoding="utf-8")) if arguments.source else fetch_data()
    render(data,arguments.output,arguments.mobile,arguments.background_only)
