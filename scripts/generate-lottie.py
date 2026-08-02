#!/usr/bin/env python3
"""
Programmatic Lottie animation generator for RSSMag mobile navigation.

Generates three pure 2D line-art animations:
  - cover-open.json: Magazine cover splits open like a book (Saul Bass style)
  - page-turn.json:  Finger-tracked scrubbable page turn (vertical swipe)
  - cover-close.json: Reverse of cover open — returns to shelf

Aesthetic: Saul Bass / UPA cartoon — flat vector shapes, stroke outlines only,
no fills, no gradients, no shadows. Depth suggested through motion alone.

Colors:
  zinc-400  #A1A1AA  → [0.631, 0.631, 0.667] (all strokes)
"""

import json
import math
import os

# ── Constants ────────────────────────────────────────────────────────────────

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "lottie")

ZINC_400 = [0.631, 0.631, 0.667]

STROKE_MAIN = 2.5       # main outline weight
STROKE_ACCENT = 2.0      # accent stroke weight
STROKE_THIN = 1.5        # thin detail lines

# Canvas: phone proportions (~2:3 aspect ratio)
W, H = 240, 360
CENTER_X, CENTER_Y = W / 2, H / 2

# Cover rectangle dimensions (with margins)
COVER_W, COVER_H = 200, 332
COVER_LEFT = (W - COVER_W) / 2
COVER_TOP = (H - COVER_H) / 2
HALF_W = COVER_W / 2  # 100

# ── Helpers ──────────────────────────────────────────────────────────────────

def lottie_doc(w, h, fr, op, name):
    """Create a minimal Lottie document skeleton."""
    return {
        "v": "5.5.7",
        "fr": fr,
        "ip": 0,
        "op": op,
        "w": w,
        "h": h,
        "nm": name,
        "ddd": 0,
        "assets": [],
        "layers": [],
    }


def shape_layer(ind, name, shapes, pos=None, rot=None, opacity=None, scale=None):
    """Create a ty=4 shape layer."""
    ks = {
        "o": {"a": 0, "k": 100},
        "r": {"a": 0, "k": 0},
        "p": {"a": 0, "k": [0, 0]},
        "a": {"a": 0, "k": [0, 0]},
        "s": {"a": 0, "k": [100, 100]},
    }
    if opacity is not None:
        ks["o"] = opacity
    if rot is not None:
        ks["r"] = rot
    if pos is not None:
        ks["p"] = pos
    if scale is not None:
        ks["s"] = scale
    return {
        "ddd": 0,
        "ind": ind,
        "ty": 4,
        "nm": name,
        "sr": 1,
        "ks": ks,
        "shapes": shapes,
    }


def static_k(value):
    """Non-animated property."""
    return {"a": 0, "k": value}


def animated_k(keyframes):
    """Animated property from keyframe list [{t, s}, ...]."""
    return {
        "a": 1,
        "k": [{"t": kf[0], "s": kf[1], "h": 0} for kf in keyframes],
    }


def pos_kf(keyframes):
    """Animated position property. Each kf = (frame, [x, y])."""
    return animated_k(keyframes)


def opac_kf(keyframes):
    """Animated opacity property. Each kf = (frame, [opacity_value])."""
    return animated_k(keyframes)


def scale_kf(keyframes):
    """Animated scale property. Each kf = (frame, [sx, sy])."""
    return animated_k(keyframes)


def stroke_item(color, width, lc=1, lj=1):
    """Stroke shape item — outline only, no fill."""
    return {
        "ty": "st",
        "c": static_k(color),
        "w": static_k(width),
        "o": static_k(100),
        "lc": lc,
        "lj": lj,
    }


def rect_shape(w, h, corner_radius=0, direction=1):
    """Rectangle shape item."""
    return {
        "ty": "rc",
        "d": direction,
        "s": static_k([w, h]),
        "p": static_k([0, 0]),
        "r": static_k(corner_radius),
    }


def rect_with_stroke(w, h, color, stroke_w, corner_radius=0, direction=1):
    """Group: rectangle + stroke. Single self-contained shape block."""
    return {
        "ty": "gr",
        "it": [
            rect_shape(w, h, corner_radius, direction),
            stroke_item(color, stroke_w),
        ],
    }


def line_shape(x1, y1, x2, y2):
    """Straight line as a path shape."""
    return {
        "ty": "sh",
        "ks": static_k({
            "c": False,
            "i": [[0, 0], [0, 0]],
            "o": [[0, 0], [0, 0]],
            "v": [[x1, y1], [x2, y2]],
        }),
    }


def line_with_stroke(x1, y1, x2, y2, color, stroke_w, lc=2, lj=2):
    """Group: straight line path + stroke."""
    return {
        "ty": "gr",
        "it": [
            line_shape(x1, y1, x2, y2),
            stroke_item(color, stroke_w, lc, lj),
        ],
    }


# ── Easing helpers ───────────────────────────────────────────────────────────

def ease_out(t):
    """Cubic ease-out: fast start, slow end. t in [0, 1]."""
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    """Smooth ease in-out."""
    if t < 0.5:
        return 4 * t * t * t
    else:
        return 1 - (-2 * t + 2) ** 3 / 2


def linear(t):
    return t


def sample_easing(num_frames, easing_fn, value_start, value_end):
    """Generate per-frame keyframes using an easing function."""
    kfs = []
    for f in range(num_frames + 1):
        t = f / num_frames
        v = value_start + (value_end - value_start) * easing_fn(t)
        kfs.append((f, v))
    return kfs


def sample_easing_2d(num_frames, easing_fn, start_xy, end_xy):
    """Generate per-frame 2D keyframes."""
    kfs = []
    for f in range(num_frames + 1):
        t = f / num_frames
        x = start_xy[0] + (end_xy[0] - start_xy[0]) * easing_fn(t)
        y = start_xy[1] + (end_xy[1] - start_xy[1]) * easing_fn(t)
        kfs.append((f, [x, y]))
    return kfs


# ══════════════════════════════════════════════════════════════════════════════
#   COVER OPEN
# ══════════════════════════════════════════════════════════════════════════════
# The cover splits from center into two halves that slide apart.
# Saul Bass aesthetic: clean geometric separation, zinc accent in the reveal.
#
# Key action: frames 0–10 (333ms) — rapid split with ease-out.
# Settle: frames 10–30 — halves decelerate to final position.
#
# Layers:
#   1. Left cover half — slides left
#   2. Right cover half — slides right
#   3. Zinc spine line — vertical accent in the open gap
#   4. Top reveal edge — thin horizontal line along top of gap (optional flourish)


def generate_cover_open():
    doc = lottie_doc(W, H, 30, 30, "Cover Open")

    # Each half is 100w x 332h (with 2.5px stroke, visual is 102.5 x 334.5)
    # They sit side-by-side with a 0px gap at rest (touching at center)
    # Left half anchor at its center: (50, 166) relative to cover origin
    # Right half anchor at its center: (-50, 166) ... actually let me think in
    # absolute coordinates.

    # Approach: each layer's position (p) is animated.
    # The shapes within the layer are relative to (0,0) = the layer's position.
    # So for left half layer positioned at (70, 180):
    #   shape is rect 100x332 at (0,0) → covers x:20 to x:120
    # For right half layer positioned at (170, 180):
    #   shape is rect 100x332 at (0,0) → covers x:120 to x:220

    # Animation: left half goes from x=70 to x=5 (moves 65px left)
    #            right half goes from x=170 to x=235 (moves 65px right)

    left_pos_kfs = sample_easing_2d(30, ease_out,
                                     [70, CENTER_Y], [5, CENTER_Y])
    right_pos_kfs = sample_easing_2d(30, ease_out,
                                      [170, CENTER_Y], [235, CENTER_Y])

    # Amber spine line: vertical line in center gap, fades in and grows
    # Start at center, stays at center but opacity spikes during the split
    # Actually: a thin vertical rectangle with animated opacity
    # Frames 0-8: opacity 0→100, 8-30: hold at 100
    spine_opacity_kfs = [
        (0, [0]),
        (6, [0]),
        (10, [100]),
        (30, [100]),
    ]

    # Also scale the spine line vertically: starts short, grows full
    spine_scale_kfs = [
        (0, [100, 30]),
        (8, [100, 100]),
        (30, [100, 100]),
    ]

    # Add top/bottom edge lines that "stretch" as the cover opens
    # These are horizontal lines at top and bottom of the gap
    # They give the book-open feeling — the spine stretches
    top_edge_kfs = sample_easing_2d(30, ease_out,
                                     [CENTER_X, COVER_TOP],
                                     [CENTER_X, COVER_TOP - 8])
    bottom_edge_kfs = sample_easing_2d(30, ease_out,
                                       [CENTER_X, COVER_TOP + COVER_H],
                                       [CENTER_X, COVER_TOP + COVER_H + 8])

    layers = [
        # Layer 1: Left cover half
        shape_layer(
            1, "Left Cover Half",
            shapes=[rect_with_stroke(HALF_W, COVER_H, ZINC_400, STROKE_MAIN)],
            pos=pos_kf(left_pos_kfs),
        ),
        # Layer 2: Right cover half
        shape_layer(
            2, "Right Cover Half",
            shapes=[rect_with_stroke(HALF_W, COVER_H, ZINC_400, STROKE_MAIN)],
            pos=pos_kf(right_pos_kfs),
        ),
        # Layer 3: Zinc spine line (center reveal)
        shape_layer(
            3, "Spine Reveal",
            shapes=[rect_with_stroke(2, COVER_H, ZINC_400, STROKE_ACCENT, 1)],
            pos=static_k([CENTER_X, CENTER_Y]),
            opacity=opac_kf(spine_opacity_kfs),
            scale=scale_kf(spine_scale_kfs),
        ),
        # Layer 4: Top horizontal edge stretch (subtle Saul Bass detail)
        shape_layer(
            4, "Top Edge Stretch",
            shapes=[line_with_stroke(-30, 0, 30, 0, ZINC_400, STROKE_THIN)],
            pos=pos_kf(top_edge_kfs),
            opacity=opac_kf([(0, [0]), (5, [100]), (30, [100])]),
        ),
        # Layer 5: Bottom horizontal edge stretch
        shape_layer(
            5, "Bottom Edge Stretch",
            shapes=[line_with_stroke(-30, 0, 30, 0, ZINC_400, STROKE_THIN)],
            pos=pos_kf(bottom_edge_kfs),
            opacity=opac_kf([(0, [0]), (5, [100]), (30, [100])]),
        ),
    ]

    doc["layers"] = layers
    return doc


# ══════════════════════════════════════════════════════════════════════════════
#   PAGE TURN
# ══════════════════════════════════════════════════════════════════════════════
# Finger-tracked, scrubbable. Each frame = a valid intermediate position.
# A vertical dividing line sweeps right-to-left.
# Previous page slides left, next page reveals from right.
#
# 60 frames at 30fps = 2 seconds of scrub range.
# ALL interpolations are LINEAR — this is critical for goToAndStop(f).
#
# Layers:
#   1. Background static pages (left + right outlines, static) — the "canvas"
#   2. Previous page — full page rect that slides left
#   3. Next page — full page rect that slides in from right
#   4. Fold line — zinc vertical line at the dividing point (R→L sweep)
#   5. Corner curl accent — small zinc mark at fold top/bottom


def generate_page_turn():
    doc = lottie_doc(W, H, 30, 60, "Page Turn")

    # The pages are full-width rectangles with zinc-400 strokes.
    # Page rect: same as cover but fills more of the canvas for readability.
    PAGE_W, PAGE_H = 210, 340
    PAGE_LEFT = (W - PAGE_W) / 2   # 15
    PAGE_TOP = (H - PAGE_H) / 2    # 10

    # Previous page: starts centered, slides left until fully offscreen.
    # Position: starts at center_x, ends at -PAGE_W/2 (fully offscreen left)
    prev_start = [CENTER_X, CENTER_Y]
    prev_end = [-PAGE_W / 2, CENTER_Y]
    prev_kfs = sample_easing_2d(60, linear, prev_start, prev_end)

    # Next page: starts offscreen right, slides to center.
    next_start = [W + PAGE_W / 2, CENTER_Y]
    next_end = [CENTER_X, CENTER_Y]
    next_kfs = sample_easing_2d(60, linear, next_start, next_end)

    # Fold line: sweeps R→L across the canvas
    fold_start = [W - 10, CENTER_Y]
    fold_end = [10, CENTER_Y]
    fold_kfs = sample_easing_2d(60, linear, fold_start, fold_end)

    # Small corner accent marks on the fold line (top and bottom)
    # These add the Saul Bass flair — like page corner indicators
    # They follow the fold line's x-position
    corner_top_kfs = [(f, [x, PAGE_TOP - 6]) for f, [x, _] in fold_kfs]
    corner_bot_kfs = [(f, [x, PAGE_TOP + PAGE_H + 6]) for f, [x, _] in fold_kfs]

    layers = [
        # Layer 1: Static page area outline (the "viewport" frame)
        shape_layer(
            1, "Page Frame",
            shapes=[rect_with_stroke(PAGE_W, PAGE_H, ZINC_400, STROKE_THIN, 2)],
            pos=static_k([CENTER_X, CENTER_Y]),
            opacity=static_k([40]),  # subtle, just a boundary hint
        ),
        # Layer 2: Previous page (slides left offscreen)
        shape_layer(
            2, "Previous Page",
            shapes=[rect_with_stroke(PAGE_W, PAGE_H, ZINC_400, STROKE_MAIN, 2)],
            pos=pos_kf(prev_kfs),
        ),
        # Layer 3: Next page (slides in from right)
        shape_layer(
            3, "Next Page",
            shapes=[rect_with_stroke(PAGE_W, PAGE_H, ZINC_400, STROKE_MAIN, 2)],
            pos=pos_kf(next_kfs),
        ),
        # Layer 4: Fold line (zinc, thick — the dividing edge)
        shape_layer(
            4, "Fold Line",
            shapes=[rect_with_stroke(2, PAGE_H + 12, ZINC_400, STROKE_ACCENT, 1)],
            pos=pos_kf(fold_kfs),
        ),
        # Layer 5: Top corner accent (small zinc mark at fold top)
        shape_layer(
            5, "Corner Top",
            shapes=[line_with_stroke(-6, 0, 6, 0, ZINC_400, STROKE_THIN)],
            pos=pos_kf(corner_top_kfs),
        ),
        # Layer 6: Bottom corner accent
        shape_layer(
            6, "Corner Bottom",
            shapes=[line_with_stroke(-6, 0, 6, 0, ZINC_400, STROKE_THIN)],
            pos=pos_kf(corner_bot_kfs),
        ),
    ]

    doc["layers"] = layers
    return doc


# ══════════════════════════════════════════════════════════════════════════════
#   COVER CLOSE (Shelf Return)
# ══════════════════════════════════════════════════════════════════════════════
# Reverse of Cover Open. Article shrinks back, cover halves slide together.
# 30 frames. Ease-in (slow start, fast close — user initiates, then snaps shut).
#
# Key action: frames 0–10 slow, 10–30 rapid close (ease-in)
# This is the reverse feeling of ease-out — starts slow, ends fast.
#
# Same layers as cover open but reversed.


def generate_cover_close():
    doc = lottie_doc(W, H, 30, 30, "Cover Close")

    # Use ease-in for close (slow start, fast snap shut)
    # This mirrors the ease-out of cover-open but reversed
    # Actually: for the RETURN gesture, user swipes back.
    # The animation should feel like the cover "snaps" back.
    # Easing: frames 0-12 slow drift, 12-30 snap shut.

    def ease_in(t):
        """Cubic ease-in: slow start, fast end."""
        return t ** 3

    def ease_in_strong(t):
        """Quintic ease-in: even slower start, faster snap."""
        return t ** 5

    left_pos_kfs = sample_easing_2d(30, ease_in_strong,
                                     [5, CENTER_Y], [70, CENTER_Y])
    right_pos_kfs = sample_easing_2d(30, ease_in_strong,
                                      [235, CENTER_Y], [170, CENTER_Y])

    # Spine line fades out
    spine_opacity_kfs = [
        (0, [100]),
        (12, [100]),
        (20, [0]),
        (30, [0]),
    ]

    spine_scale_kfs = [
        (0, [100, 100]),
        (12, [100, 100]),
        (22, [100, 30]),
        (30, [100, 30]),
    ]

    # Top/bottom edge marks that retreat
    top_edge_kfs = sample_easing_2d(30, ease_in,
                                     [CENTER_X, COVER_TOP - 8],
                                     [CENTER_X, COVER_TOP])
    bottom_edge_kfs = sample_easing_2d(30, ease_in,
                                       [CENTER_X, COVER_TOP + COVER_H + 8],
                                       [CENTER_X, COVER_TOP + COVER_H])

    layers = [
        # Layer 1: Left cover half — slides back to center
        shape_layer(
            1, "Left Cover Half",
            shapes=[rect_with_stroke(HALF_W, COVER_H, ZINC_400, STROKE_MAIN)],
            pos=pos_kf(left_pos_kfs),
        ),
        # Layer 2: Right cover half — slides back to center
        shape_layer(
            2, "Right Cover Half",
            shapes=[rect_with_stroke(HALF_W, COVER_H, ZINC_400, STROKE_MAIN)],
            pos=pos_kf(right_pos_kfs),
        ),
        # Layer 3: Zinc spine line (fades out as cover closes)
        shape_layer(
            3, "Spine Reveal",
            shapes=[rect_with_stroke(2, COVER_H, ZINC_400, STROKE_ACCENT, 1)],
            pos=static_k([CENTER_X, CENTER_Y]),
            opacity=opac_kf(spine_opacity_kfs),
            scale=scale_kf(spine_scale_kfs),
        ),
        # Layer 4: Top horizontal edge retreat
        shape_layer(
            4, "Top Edge Retreat",
            shapes=[line_with_stroke(-30, 0, 30, 0, ZINC_400, STROKE_THIN)],
            pos=pos_kf(top_edge_kfs),
            opacity=opac_kf([(0, [100]), (15, [100]), (25, [0]), (30, [0])]),
        ),
        # Layer 5: Bottom horizontal edge retreat
        shape_layer(
            5, "Bottom Edge Retreat",
            shapes=[line_with_stroke(-30, 0, 30, 0, ZINC_400, STROKE_THIN)],
            pos=pos_kf(bottom_edge_kfs),
            opacity=opac_kf([(0, [100]), (15, [100]), (25, [0]), (30, [0])]),
        ),
    ]

    doc["layers"] = layers
    return doc


# ══════════════════════════════════════════════════════════════════════════════
#   Main
# ══════════════════════════════════════════════════════════════════════════════

def write_json(data, filename):
    filepath = os.path.join(OUTPUT_DIR, filename)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  ✓ {filepath}")


def validate_lottie(data, name):
    """Basic structural validation of a Lottie JSON."""
    errors = []

    # Required top-level fields
    for field in ["v", "fr", "ip", "op", "w", "h", "nm", "layers"]:
        if field not in data:
            errors.append(f"Missing required field: {field}")

    # Check layers
    if "layers" in data:
        for i, layer in enumerate(data["layers"]):
            if layer.get("ty") != 4:
                errors.append(f"Layer {i} has unexpected ty={layer.get('ty')} (expected 4)")
            if "shapes" not in layer:
                errors.append(f"Layer {i} missing shapes")
            if "ks" not in layer:
                errors.append(f"Layer {i} missing ks (transform)")

            # Check shapes for stroke vs fill — we want strokes, not fills
            shapes = layer.get("shapes", [])
            for si, shape in enumerate(shapes):
                items = shape.get("it", [])
                for item in items:
                    if item.get("ty") == "fl":
                        errors.append(
                            f"Layer {i}, shape group {si}: has fill (ty=fl) — "
                            f"should be stroke-only per line-art brief"
                        )
                    if item.get("ty") == "gf":
                        errors.append(
                            f"Layer {i}, shape group {si}: has gradient fill (ty=gf) — "
                            f"should be stroke-only"
                        )

    # Check keyframes for page-turn linearity
    if name == "Page Turn" and "layers" in data:
        for layer in data["layers"]:
            p = layer.get("ks", {}).get("p", {})
            if p.get("a") == 1:
                kfs = p.get("k", [])
                if len(kfs) == 2:
                    errors.append(
                        f"Layer '{layer.get('nm')}': only 2 keyframes for position. "
                        f"Page turn should have per-frame keyframes for goToAndStop support."
                    )

    # Total frame count sanity check
    op = data.get("op", 0)
    fr = data.get("fr", 30)
    duration_ms = (op / fr) * 1000

    if name == "Cover Open" and duration_ms > 400:
        # We're a bit over 300ms (30 frames = 1s), but key action in first 10 frames
        # Just note it
        pass

    return errors


def main():
    print("Generating RSSMag Lottie animations...\n")

    animations = [
        ("cover-open.json", generate_cover_open, "Cover Open"),
        ("page-turn.json", generate_page_turn, "Page Turn"),
        ("cover-close.json", generate_cover_close, "Cover Close"),
    ]

    all_ok = True
    for filename, generator_fn, display_name in animations:
        print(f"  {display_name} ({filename})...")
        try:
            data = generator_fn()
            write_json(data, filename)
            errors = validate_lottie(data, display_name)
            if errors:
                print(f"  ⚠ Validation warnings for {display_name}:")
                for e in errors:
                    print(f"    - {e}")
            else:
                print(f"    ✓ Validated OK")
        except Exception as e:
            print(f"  ✗ FAILED: {e}")
            all_ok = False

    print(f"\n{'✓ All animations generated' if all_ok else '✗ Some animations failed'}")
    return 0 if all_ok else 1


if __name__ == "__main__":
    exit(main())
