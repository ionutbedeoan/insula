"""Draw original cutout foliage for the four tree silhouettes."""
import base64
import io
import math
import pathlib
import random
from PIL import Image, ImageDraw

SIZE = 480
PLANTS = [
    ('laurel', (108, 135, 69)),
    ('dracaena', (118, 144, 85)),
    ('fig', (97, 130, 61)),
    ('pine', (88, 125, 81)),
]
TILE = 256
atlas = Image.new('RGBA', (TILE * 2, TILE * 2))

def leaf(draw, x, y, angle, length, width, color, taper, bend, rng):
    ux, uy = math.cos(angle), math.sin(angle)
    def point(t, offset=0):
        return (x + ux * t * length - uy * (bend * t * t + offset),
                y + uy * t * length + ux * (bend * t * t + offset))
    left, right = [], []
    for i in range(11):
        t = i / 10
        outline = math.sin(math.pi * t ** taper) ** .78
        edge = .92 + rng.random() * .16
        left.append(point(t, width * outline * edge))
        right.append(point(t, -width * outline / edge))
    draw.polygon(left + right[::-1], fill=color + (255,))
    draw.polygon([point(0), *left, point(1), point(.55), point(.25)],
                 fill=tuple(int(c * .83) for c in color) + (255,))
    vein = tuple(min(255, int(c * 1.18 + 8)) for c in color) + (255,)
    draw.line([point(i / 5) for i in range(6)], fill=vein, width=max(1, int(width / 9)))
    if width > 5:
        for i in range(2, 8):
            t = i / 10
            spread = width * math.sin(math.pi * t ** taper) ** .78
            for side in [-1, 1]:
                draw.line([point(t), point(t + .15, spread * side * .66)],
                          fill=tuple(min(255, int(c * 1.10 + 2)) for c in color) + (255,))

for n, (species, base) in enumerate(PLANTS):
    rng = random.Random(18432 + n)
    tile = Image.new('RGBA', (SIZE, SIZE), base + (0,))
    draw = ImageDraw.Draw(tile)
    def shade(minimum=.86, maximum=1.25):
        shade_factor = rng.uniform(minimum, maximum)
        return tuple(min(255, int(c * shade_factor + rng.uniform(-7, 7))) for c in base)
    if species == 'dracaena':
        for i in range(47):
            a = i * 2.399 + rng.uniform(-.22, .22)
            leaf(draw, SIZE * .50 + rng.uniform(-20, 20), SIZE * .51 + rng.uniform(-20, 20),
                 a, rng.uniform(85, 203), rng.uniform(2.9, 9), shade(), .86, rng.uniform(-56, 56), rng)
    else:
        for i in range(9 if species == 'pine' else 8):
            a = i * 2.399 + rng.uniform(-.20, .20)
            dx, dy = math.cos(a), math.sin(a)
            x, y = SIZE * .5 + rng.uniform(-27, 27), SIZE * .5 + rng.uniform(-28, 28)
            length = rng.uniform(104, 155)
            draw.line([(x, y), (x + length * dx, y + length * dy)], fill=(88, 78, 54, 255), width=3)
            for j in range(1, 17 if species=='pine' else 7):
                t = j / (17 if species=='pine' else 7)
                for side in [-1, 1]:
                    length_leaf = rng.uniform(32, 67) if species=='pine' else rng.uniform(38, 81)
                    width = rng.uniform(1.3, 3.2) if species=='pine' else rng.uniform(9, 16) * (1.38 if species=='fig' else 1)
                    leaf(draw, x + dx * length * t, y + dy * length * t,
                         a + side * rng.uniform(.40, 1.48), length_leaf * (1.04 - .26*t),
                         width, shade(), 1.22 if species=='fig' else .75, rng.uniform(-12, 12), rng)
    atlas.paste(tile.resize((TILE, TILE), Image.Resampling.LANCZOS), (TILE * (n % 2), TILE * (n // 2)))

image = io.BytesIO()
atlas.save(image, format='WEBP', lossless=True, exact=True)
encoded = base64.b64encode(image.getvalue()).decode()
root = pathlib.Path(__file__).resolve().parents[1]
(root/'src/assets/canopy.ts').write_text(f"export const canopyPixels='data:image/webp;base64,{encoded}'\n")
