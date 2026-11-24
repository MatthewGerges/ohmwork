#!/usr/bin/env python3
"""
Generate LED current-limiting resistor flashcard diagrams.
  public/diagrams/led1_question.png
  public/diagrams/led2_explanation.png
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUT  = ROOT / 'public' / 'diagrams'
OUT.mkdir(parents=True, exist_ok=True)

BG   = '#0f172a'
FG   = '#e2e8f0'
DIM  = '#475569'
BLUE = '#818cf8'
YLW  = '#fbbf24'
GRN  = '#4ade80'
RED  = '#f87171'


def new_fig(w=5.5, h=5.5):
    fig, ax = plt.subplots(figsize=(w, h))
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.set_aspect('equal')
    ax.axis('off')
    return fig, ax


def wire(ax, pts, c=FG, lw=2.0):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    ax.plot(xs, ys, color=c, lw=lw, solid_capstyle='round', solid_joinstyle='round')


def vsource(ax, x, y, r=0.28, label='Vcc = 5V'):
    circle = plt.Circle((x, y), r, color=FG, fill=False, lw=2.0)
    ax.add_patch(circle)
    ax.text(x, y + r * 0.42, '+', ha='center', va='center', color=GRN,
            fontsize=14, fontweight='bold')
    ax.text(x, y - r * 0.42, '−', ha='center', va='center', color=RED,
            fontsize=14, fontweight='bold')
    ax.text(x - r - 0.14, y, label, ha='right', va='center', color=FG,
            fontsize=11, fontweight='bold')


def draw_resistor(ax, x, y, h=0.55, w=0.22, label='R = ?', left_label=None):
    rect = mpatches.Rectangle((x - w / 2, y - h / 2), w, h,
                               lw=1.8, edgecolor=FG, facecolor='none')
    ax.add_patch(rect)
    ax.text(x + w / 2 + 0.12, y, label, ha='left', va='center',
            color=FG, fontsize=11, fontweight='bold')
    if left_label:
        ax.text(x - w / 2 - 0.12, y, left_label, ha='right', va='center',
                color=YLW, fontsize=10)
    return h / 2


def draw_led(ax, x, y, size=0.26, vf_label='Vf = 2V', component_label='LED'):
    base_y = y + size
    tip_y  = y - size
    hw     = size * 0.85

    # Triangle: base at top, apex at bottom (current flows ↓)
    tx = [x - hw, x + hw, x, x - hw]
    ty = [base_y, base_y, tip_y, base_y]
    ax.fill(tx[:-1], ty[:-1], color=BLUE, alpha=0.45, zorder=2)
    ax.plot(tx, ty, color=FG, lw=1.8, zorder=3)

    # Cathode bar
    ax.plot([x - hw * 1.12, x + hw * 1.12], [tip_y, tip_y], color=FG, lw=2.2, zorder=3)

    # Component label to the right of the LED body (no light arrows)
    if component_label:
        ax.text(x + hw * 1.12 + 0.12, y, component_label, ha='left', va='center',
                color=FG, fontsize=10)

    # Vf label to the left
    if vf_label:
        ax.text(x - hw * 1.12 - 0.12, y, vf_label, ha='right', va='center',
                color=BLUE, fontsize=10, style='italic')

    return size


def draw_gnd(ax, x, y):
    """Ground symbol with its topmost point at y."""
    for w, dy in [(0.22, 0.00), (0.13, 0.09), (0.05, 0.18)]:
        ax.plot([x - w, x + w], [y - dy, y - dy], color=DIM, lw=2.2)


# ─── Diagram 1: Question ──────────────────────────────────────────────────

def make_question():
    fig, ax = new_fig(5.5, 5.5)

    LX, RX  = 1.3, 3.5
    TY, BY  = 4.0, 1.2
    MY      = (TY + BY) / 2
    GND_Y   = BY - 0.45  # GND sits below bottom rail, connected by a short wire

    RES_Y = TY - 0.55
    LED_Y = BY + 0.58
    RH    = 0.55 / 2
    LS    = 0.26

    vsource(ax, LX, MY)

    wire(ax, [(LX, MY + 0.28), (LX, TY), (RX, TY), (RX, RES_Y + RH)])
    wire(ax, [(RX, RES_Y - RH), (RX, LED_Y + LS)])
    wire(ax, [(RX, LED_Y - LS), (RX, BY), (LX, BY), (LX, MY - 0.28)])

    draw_resistor(ax, RX, RES_Y, label='R = ?')
    draw_led(ax, RX, LED_Y)

    # GND: short wire from bottom rail down to symbol
    gnd_x = (LX + RX) / 2
    wire(ax, [(gnd_x, BY), (gnd_x, GND_Y)])
    draw_gnd(ax, gnd_x, GND_Y)

    # Current arrow (between resistor bottom and LED top, on the right)
    arr_x  = RX + 0.78
    arr_my = (RES_Y - RH + LED_Y + LS) / 2
    ax.annotate('', xy=(arr_x, arr_my - 0.28), xytext=(arr_x, arr_my + 0.28),
                arrowprops=dict(arrowstyle='->', color=YLW, lw=1.5, mutation_scale=12))
    ax.text(arr_x + 0.1, arr_my, 'I = 20 mA', ha='left', va='center',
            color=YLW, fontsize=10)

    ax.set_xlim(-0.3, 5.8)
    ax.set_ylim(0.3, 4.8)
    fig.savefig(OUT / 'led1_question.png', dpi=150, bbox_inches='tight', facecolor=BG)
    plt.close(fig)
    print('Saved led1_question.png')


# ─── Diagram 2: Explanation — circuit left, KVL math right ───────────────

def make_explanation():
    # Wider figure so circuit and KVL derivation sit side-by-side with no overlap
    fig, ax = new_fig(9.0, 5.5)

    # ── Circuit (left half) ──────────────────────────────────────
    LX, RX  = 1.0, 2.8
    TY, BY  = 4.0, 1.2
    MY      = (TY + BY) / 2
    GND_Y   = BY - 0.45

    RES_Y = TY - 0.55
    LED_Y = BY + 0.58
    RH    = 0.55 / 2
    LS    = 0.26

    vsource(ax, LX, MY)

    wire(ax, [(LX, MY + 0.28), (LX, TY), (RX, TY), (RX, RES_Y + RH)])
    wire(ax, [(RX, RES_Y - RH), (RX, LED_Y + LS)])
    wire(ax, [(RX, LED_Y - LS), (RX, BY), (LX, BY), (LX, MY - 0.28)])

    draw_resistor(ax, RX, RES_Y, label='R = 150 Ω', left_label='V_R = 3V')
    draw_led(ax, RX, LED_Y)

    gnd_x = (LX + RX) / 2
    wire(ax, [(gnd_x, BY), (gnd_x, GND_Y)])
    draw_gnd(ax, gnd_x, GND_Y)

    arr_x  = RX + 0.55
    arr_my = (RES_Y - RH + LED_Y + LS) / 2
    ax.annotate('', xy=(arr_x, arr_my - 0.28), xytext=(arr_x, arr_my + 0.28),
                arrowprops=dict(arrowstyle='->', color=YLW, lw=1.5, mutation_scale=12))
    ax.text(arr_x + 0.08, arr_my, 'I = 20 mA', ha='left', va='center',
            color=YLW, fontsize=10)

    # ── KVL derivation (right half, well clear of circuit) ───────
    kx   = 6.5
    ktop = 3.6
    step = 0.58

    ax.text(kx, ktop,          'KVL around the loop:',
            ha='center', va='center', color=DIM, fontsize=10, style='italic')
    ax.text(kx, ktop - step,   'Vcc = V_R + Vf',
            ha='center', va='center', color=FG, fontsize=13)
    ax.text(kx, ktop - 2*step, '5V = V_R + 2V',
            ha='center', va='center', color=FG, fontsize=12)
    ax.text(kx, ktop - 3*step, 'V_R = 3V',
            ha='center', va='center', color=YLW, fontsize=13, fontweight='bold')

    # Horizontal rule
    ax.plot([kx - 1.1, kx + 1.1], [ktop - 3.55*step]*2, color=DIM, lw=0.8)

    ax.text(kx, ktop - 4.1*step, 'R = V_R / I',
            ha='center', va='center', color=FG, fontsize=12)
    ax.text(kx, ktop - 4.9*step, '= 3V / 20 mA',
            ha='center', va='center', color=FG, fontsize=12)
    ax.text(kx, ktop - 5.8*step, '= 150 Ω',
            ha='center', va='center', color=GRN, fontsize=15, fontweight='bold')

    ax.set_xlim(-0.2, 8.8)
    ax.set_ylim(0.3, 4.8)
    fig.savefig(OUT / 'led2_explanation.png', dpi=150, bbox_inches='tight', facecolor=BG)
    plt.close(fig)
    print('Saved led2_explanation.png')


make_question()
make_explanation()
print('Done.')
