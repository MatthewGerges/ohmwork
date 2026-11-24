#!/usr/bin/env python3
"""
schematic.py — a tiny, reusable block-diagram / circuit-schematic library.

Goals (learned the hard way):
  * Components expose named *ports* (x, y) so you never hand-place a wire end.
  * Wires are ORTHOGONAL ONLY. `connect()` auto-routes with an L/Z elbow;
    `wire()` asserts every segment is horizontal or vertical.
  * Labels are anchored to a component edge with a fixed offset, so text never
    lands on top of the symbol or a wire. Pick a side; the offset handles the gap.
  * Dark theme baked in to match the app (BG #0f172a, FG #e2e8f0).

Typical use:

    s = Schematic(7, 6)
    mcu  = s.mcu(1.6, 3.0, pin_limit='20 mA / pin')
    r    = s.resistor(4.0, 4.6, label='150 Ω')
    led  = s.led(4.0, 2.8)
    gnd  = s.gnd(4.0, 1.2)
    s.wire(r.b, led.a)              # straight (same x)
    s.connect(mcu.gpio, r.t, 'HV')  # elbow: horizontal then vertical
    s.save('public/diagrams/foo.png')
"""
from __future__ import annotations

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from pathlib import Path
from types import SimpleNamespace

# ── Palette ────────────────────────────────────────────────────────────────
BG   = '#0f172a'
FG   = '#e2e8f0'
DIM  = '#475569'
MUT  = '#94a3b8'
BLUE = '#818cf8'
YLW  = '#fbbf24'
GRN  = '#4ade80'
RED  = '#f87171'
TEAL = '#2dd4bf'

EPS = 1e-6


class Schematic:
    """A drawing canvas. Units are arbitrary; aspect ratio is locked to 1:1."""

    def __init__(self, width=7.0, height=6.0, pad=0.4):
        self.w, self.h, self.pad = width, height, pad
        self.fig, self.ax = plt.subplots(figsize=(width, height))
        self.fig.patch.set_facecolor(BG)
        self.ax.set_facecolor(BG)
        self.ax.set_aspect('equal')
        self.ax.axis('off')
        self.ax.set_xlim(0, width)
        self.ax.set_ylim(0, height)

    # ── low-level primitives ────────────────────────────────────────────
    def _line(self, x0, y0, x1, y1, c=FG, lw=2.0, z=2):
        self.ax.plot([x0, x1], [y0, y1], color=c, lw=lw, zorder=z,
                     solid_capstyle='round', solid_joinstyle='round')

    def text(self, x, y, s, c=FG, size=10, ha='center', va='center',
             weight='normal', style='normal', z=5):
        self.ax.text(x, y, s, color=c, fontsize=size, ha=ha, va=va,
                     fontweight=weight, style=style, zorder=z, linespacing=1.35)

    # ── orthogonal wiring ───────────────────────────────────────────────
    def wire(self, *pts, c=FG, lw=2.0, z=2):
        """Draw a polyline. Every segment must be horizontal or vertical."""
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            if abs(x0 - x1) > EPS and abs(y0 - y1) > EPS:
                raise ValueError(
                    f'Diagonal segment {(x0, y0)}->{(x1, y1)} not allowed; '
                    'route through an intermediate point.')
            self._line(x0, y0, x1, y1, c=c, lw=lw, z=z)

    def connect(self, a, b, mode='HV', c=FG, lw=2.0, z=2):
        """Auto-route an orthogonal wire from port a to port b.
        mode 'HV' = go horizontal first then vertical (elbow);
        mode 'VH' = vertical first then horizontal.
        Straight wires (shared x or y) are drawn directly.
        """
        ax_, ay = a
        bx, by = b
        if abs(ax_ - bx) < EPS or abs(ay - by) < EPS:
            self.wire(a, b, c=c, lw=lw, z=z)
        elif mode == 'HV':
            self.wire(a, (bx, ay), b, c=c, lw=lw, z=z)
        else:
            self.wire(a, (ax_, by), b, c=c, lw=lw, z=z)

    def junction(self, x, y, c=FG, r=0.045, z=4):
        self.ax.add_patch(plt.Circle((x, y), r, color=c, zorder=z))

    # ── current-flow arrow ──────────────────────────────────────────────
    def arrow(self, x0, y0, x1, y1, c=YLW, lw=1.6):
        self.ax.annotate('', xy=(x1, y1), xytext=(x0, y0),
                         arrowprops=dict(arrowstyle='->', color=c, lw=lw,
                                         mutation_scale=13), zorder=4)

    # ── components ──────────────────────────────────────────────────────
    def resistor(self, x, y, h=0.62, w=0.24, label=None, label_side='right',
                 sub=None, sub_side='left', lead=0.0):
        """Vertical IEC-box resistor. Ports: .t (top), .b (bottom)."""
        self.ax.add_patch(mpatches.Rectangle(
            (x - w/2, y - h/2), w, h, lw=2.0, edgecolor=FG,
            facecolor=BG, zorder=3))
        top, bot = (x, y + h/2 + lead), (x, y - h/2 - lead)
        if lead:
            self._line(x, y + h/2, *top)
            self._line(x, y - h/2, *bot)
        if label:
            self._side_label(x, y, w, label, label_side, FG, 10, weight='bold')
        if sub:
            self._side_label(x, y, w, sub, sub_side, YLW, 9)
        return SimpleNamespace(t=top, b=bot, c=(x, y))

    def led(self, x, y, size=0.26, lead=0.34, label='LED', label_side='right',
            vf='Vf = 2V', vf_side='left'):
        """Vertical LED, current flows top→bottom. Always drawn with lead
        stubs at top and bottom so a floating LED still reads as connectable.
        Ports: .a (anode/top), .k (cathode/bottom)."""
        base_y, tip_y, hw = y + size, y - size, size * 0.92
        # triangle (anode at top, apex points down to cathode)
        self.ax.fill([x - hw, x + hw, x], [base_y, base_y, tip_y],
                     color=BLUE, alpha=0.45, zorder=2)
        self.ax.plot([x - hw, x + hw, x, x - hw],
                     [base_y, base_y, tip_y, base_y],
                     color=FG, lw=1.8, zorder=3)
        # cathode bar
        self._line(x - hw*1.15, tip_y, x + hw*1.15, tip_y, lw=2.2, z=3)
        # lead stubs
        a = (x, base_y + lead)
        k = (x, tip_y - lead)
        self._line(x, base_y, *a, z=3)
        self._line(x, tip_y, *k, z=3)
        if label:
            self.text(x + hw*1.15 + 0.12, y, label, c=FG, size=9, ha='left')
        if vf:
            self.text(x - hw*1.15 - 0.12, y, vf, c=BLUE, size=9, ha='right',
                      style='italic')
        return SimpleNamespace(a=a, k=k, c=(x, y))

    def gnd(self, x, y, lead=0.30):
        """Ground symbol. Port: .t (top connection point, lead above bars)."""
        top = (x, y + lead)
        self._line(x, y, *top)
        for ww, dy in [(0.22, 0.0), (0.13, 0.09), (0.05, 0.18)]:
            self._line(x - ww, y - dy, x + ww, y - dy, c=DIM, lw=2.4, z=3)
        return SimpleNamespace(t=top, c=(x, y))

    def vcc(self, x, y, label='Vcc = 3.3V', c=GRN):
        """A power-rail tick + label. Port: .b (bottom connection point)."""
        self._line(x - 0.28, y, x + 0.28, y, c=c, lw=2.4, z=3)
        self.text(x, y + 0.16, label, c=c, size=11, ha='center', va='bottom',
                  weight='bold')
        return SimpleNamespace(b=(x, y), c=(x, y))

    def node_label(self, x, y, label, c=GRN, size=11):
        """A free-floating labelled node (e.g. a GPIO-as-source top rail)."""
        self.text(x, y + 0.16, label, c=c, size=size, ha='center', va='bottom',
                  weight='bold')
        return SimpleNamespace(b=(x, y), c=(x, y))

    def mcu(self, cx, cy, w=1.3, h=1.7, title='MCU', vcc='3.3V',
            pin_limit='20 mA / pin', pin_label='GPIO', pin_frac=0.0):
        """Microcontroller block with one GPIO pin stub on the right side.
        Text rows are kept on separate lines; the pin label sits OUTSIDE the
        box so it can never collide with the title. Port: .gpio (pin tip)."""
        PAD = 0.04
        self.ax.add_patch(mpatches.FancyBboxPatch(
            (cx - w/2, cy - h/2), w, h, boxstyle=f'round,pad={PAD}',
            lw=1.8, edgecolor=TEAL, facecolor='#0a1a20', zorder=2))
        self.text(cx, cy + h*0.30, title, c=FG, size=13, weight='bold')
        self.text(cx, cy + h*0.00, f'Vcc = {vcc}', c=MUT, size=9)
        self.text(cx, cy - h*0.30, pin_limit, c=RED, size=8.5)
        pin_y = cy + h * pin_frac
        edge  = cx + w/2 + PAD          # true outer edge of the rounded box
        stub  = 0.42
        tip   = (edge + stub, pin_y)
        self._line(edge, pin_y, *tip, c=TEAL, lw=2.0, z=3)   # meets edge exactly
        if pin_label:
            self.text(edge + stub*0.5, pin_y + 0.18, pin_label, c=TEAL,
                      size=8.5, ha='center', va='bottom')
        return SimpleNamespace(gpio=tip, c=(cx, cy))

    def nfet(self, cx, cy, label='NFET\n(logic-level)', label_side='right',
             show_g=True):
        """Enhancement-mode N-channel MOSFET matching the standard schematic symbol:
          gate plate  |  visible gap  |  body bar  |  short D/S stubs → rail
        Three broken channel segments (enhancement mode). Arrow on source stub
        pointing right (outward). Ports: .d, .s, .g"""
        bx   = cx - 0.26   # body bar x
        gpx  = cx - 0.52   # gate plate x  (gap = 0.26, clearly visible)
        TH   = 0.72         # half-height to D/S terminals on the rail
        chh  = 0.34         # body bar half-height
        stub = 0.24         # stub length (bx → bx+stub, short horizontal lines)

        # ── body bar: three separate segments (enhancement mode) ──────────
        seg = chh * 0.36     # half-gap between segments
        self._line(bx, cy + seg,  bx, cy + chh, lw=3.2, z=4)  # drain seg
        self._line(bx, cy - seg*0.5, bx, cy + seg*0.5, lw=3.2, z=4)  # middle seg
        self._line(bx, cy - chh, bx, cy - seg,  lw=3.2, z=4)  # source seg

        # ── gate plate (parallel bar, clearly separated from body bar) ────
        self._line(gpx, cy - chh, gpx, cy + chh, lw=3.2, z=4)

        # ── drain stub: from body bar right, then up to rail ──────────────
        drain_y = cy + chh * 0.68
        self._line(bx, drain_y, bx + stub, drain_y, lw=2.4, z=4)
        d = (cx, cy + TH)
        self._line(bx + stub, drain_y, cx, drain_y, lw=2.4, z=3)
        self._line(cx, drain_y, *d, lw=2.4, z=3)

        # ── source stub: from body bar right, arrow, vertical drop ──────
        src_y = cy - chh * 0.68
        stub_end = bx + stub
        self._line(bx, src_y, stub_end - 0.04, src_y, lw=2.4, z=4)
        # arrow head ends at cx (not past it), tail near stub end
        self.ax.annotate('', xy=(cx - 0.02, src_y),
                         xytext=(stub_end - 0.06, src_y),
                         arrowprops=dict(arrowstyle='->', color=FG, lw=2.2,
                                         mutation_scale=18), zorder=5)
        s = (cx, cy - TH)
        self._line(cx, src_y, *s, lw=2.4, z=3)

        # ── gate lead exits left ──────────────────────────────────────────
        g = (gpx - 0.44, cy)
        self._line(gpx, cy, *g, lw=2.0, z=3)

        # ── labels ────────────────────────────────────────────────────────
        self.text(cx + 0.14, cy + TH - 0.04, 'D', c=DIM, size=9, ha='left')
        self.text(cx + 0.14, cy - TH + 0.04, 'S', c=DIM, size=9, ha='left')
        if show_g:
            self.text(g[0] - 0.06, cy + 0.15, 'G', c=DIM, size=9, ha='right',
                      va='bottom')
        if label:
            lx = cx + 0.22 if label_side == 'right' else gpx - 0.50
            ha = 'left' if label_side == 'right' else 'right'
            self.text(lx, cy - 0.04, label, c=DIM, size=8.5, ha=ha, va='center')
        return SimpleNamespace(d=d, s=s, g=g, c=(cx, cy))

    def nfet_alt(self, cx, cy, label='NFET\n(logic-level)', label_side='right',
                 show_g=True):
        """Alternative NFET: same gate/body/stubs but arrow on the vertical
        source lead (pointing down = conventional current out of source to GND).
        Ports: .d, .s, .g  (same as nfet)."""
        bx   = cx - 0.18
        gpx  = bx - 0.14
        TH   = 0.72
        chh  = 0.33

        self._line(bx, cy - chh, bx, cy + chh, lw=3.0, z=4)
        self._line(gpx, cy - chh, gpx, cy + chh, lw=3.0, z=4)
        drain_y = cy + chh * 0.67
        src_y   = cy - chh * 0.67
        self._line(bx, drain_y, cx, drain_y, lw=2.2, z=4)
        self._line(bx, src_y,   cx, src_y,   lw=2.2, z=4)
        g = (gpx - 0.52, cy)
        self._line(gpx, cy, *g, lw=2.0, z=3)

        d = (cx, cy + TH)
        s = (cx, cy - TH)
        self._line(cx, drain_y, *d, lw=2.2, z=3)

        # source vertical lead — draw upper half, then arrow, then lower half
        mid_s = cy - TH * 0.55        # midpoint on the source lead
        self._line(cx, src_y, cx, mid_s + 0.16, lw=2.2, z=3)
        self.ax.annotate('', xy=(cx, mid_s - 0.01), xytext=(cx, mid_s + 0.27),
                         arrowprops=dict(arrowstyle='->', color=FG, lw=2.2,
                                         mutation_scale=18), zorder=5)
        self._line(cx, mid_s - 0.01, *s, lw=2.2, z=3)

        self.text(cx + 0.14, cy + TH - 0.04, 'D', c=DIM, size=9, ha='left')
        self.text(cx + 0.14, cy - TH + 0.04, 'S', c=DIM, size=9, ha='left')
        if show_g:
            self.text(g[0] - 0.06, cy + 0.15, 'G', c=DIM, size=9, ha='right',
                      va='bottom')
        if label:
            lx = cx + 0.22 if label_side == 'right' else gpx - 0.62
            ha = 'left' if label_side == 'right' else 'right'
            self.text(lx, cy - 0.04, label, c=DIM, size=8.5, ha=ha, va='center')
        return SimpleNamespace(d=d, s=s, g=g, c=(cx, cy))

    # ── helpers ─────────────────────────────────────────────────────────
    def _side_label(self, x, y, w, text, side, color, size, weight='normal'):
        if side == 'right':
            self.text(x + w/2 + 0.13, y, text, c=color, size=size, ha='left',
                      weight=weight)
        else:
            self.text(x - w/2 - 0.13, y, text, c=color, size=size, ha='right',
                      weight=weight)

    # ── output ──────────────────────────────────────────────────────────
    def save(self, relpath):
        out = Path(__file__).parent.parent / relpath
        out.parent.mkdir(parents=True, exist_ok=True)
        self.fig.savefig(out, dpi=150, bbox_inches='tight', facecolor=BG,
                         pad_inches=0.18)
        plt.close(self.fig)
        print(f'Saved {relpath}')
