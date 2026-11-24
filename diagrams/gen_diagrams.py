"""
Generate four circuit diagrams for the voltage follower / ADC buffer flashcard.
Op-amp convention: (+) non-inverting on TOP, (-) inverting on BOTTOM.
A voltage follower = output fed back to the (-) input => NEGATIVE feedback.
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

OUT = os.path.dirname(os.path.abspath(__file__))

# ─── helpers ────────────────────────────────────────────────────────────────

def new_fig(w, h, title=''):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_xlim(0, w)
    ax.set_ylim(0, h)
    if title:
        ax.set_title(title, fontsize=12, fontweight='bold', pad=12)
    return fig, ax

def wire(ax, pts, lw=2.0, color='#111111'):
    ax.plot([p[0] for p in pts], [p[1] for p in pts], color=color, linewidth=lw,
            solid_capstyle='round', solid_joinstyle='round', zorder=2)

def node(ax, x, y, r=0.06):
    ax.add_patch(plt.Circle((x, y), r, color='#111111', zorder=5))

def vcc(ax, x, y, label='5 V'):
    wire(ax, [(x, y), (x, y + 0.32)], lw=2)
    ax.plot([x - 0.2, x + 0.2], [y + 0.32, y + 0.32], color='#c0392b', linewidth=2.5)
    ax.text(x, y + 0.46, label, ha='center', va='bottom', fontsize=9,
            color='#c0392b', fontweight='bold')

def gnd(ax, x, y):
    wire(ax, [(x, y), (x, y - 0.28)], lw=2)
    for i, (hw, dy) in enumerate([(0.22, 0), (0.14, 0.12), (0.07, 0.24)]):
        yy = y - 0.28 - dy
        ax.plot([x - hw, x + hw], [yy, yy], color='#111', linewidth=2.0 - i * 0.4)

def resistor_v(ax, x, y_top, y_bot, label='R', value=''):
    cy = (y_top + y_bot) / 2
    bh = abs(y_top - y_bot) * 0.5
    bw = 0.26
    wire(ax, [(x, y_top), (x, cy + bh / 2)], lw=1.8)
    wire(ax, [(x, cy - bh / 2), (x, y_bot)], lw=1.8)
    ax.add_patch(mpatches.FancyBboxPatch(
        (x - bw / 2, cy - bh / 2), bw, bh, boxstyle='square,pad=0',
        facecolor='white', edgecolor='#111', linewidth=1.8, zorder=3))
    ax.text(x + bw / 2 + 0.12, cy + 0.10, label, ha='left', va='center',
            fontsize=10, fontweight='bold')
    if value:
        ax.text(x + bw / 2 + 0.12, cy - 0.14, value, ha='left', va='center',
                fontsize=8.5, color='#555')

def adc_box(ax, x, y, w=1.25, h=0.78):
    ax.add_patch(mpatches.FancyBboxPatch(
        (x, y - h / 2), w, h, boxstyle='round,pad=0.05',
        facecolor='#dff0d8', edgecolor='#111', linewidth=2, zorder=3))
    ax.text(x + w / 2, y, 'ADC', ha='center', va='center',
            fontsize=11, fontweight='bold', zorder=4)
    return (x, y), (x + w, y)

def black_box(ax, x, y, w=1.4, h=0.78, label='?'):
    ax.add_patch(mpatches.FancyBboxPatch(
        (x, y - h / 2), w, h, boxstyle='round,pad=0.05',
        facecolor='#222', edgecolor='#111', linewidth=2, zorder=3))
    ax.text(x + w / 2, y, label, ha='center', va='center',
            fontsize=20, fontweight='bold', color='white', zorder=4)
    return (x, y), (x + w, y)

def opamp(ax, x_tip, y_tip, size=0.85):
    """(+) on TOP, (-) on BOTTOM. Returns pin coords."""
    xl = x_tip - size * 1.7
    tri = plt.Polygon([[xl, y_tip + size * 0.85],
                       [xl, y_tip - size * 0.85],
                       [x_tip, y_tip]],
                      closed=True, facecolor='#fff9c4',
                      edgecolor='#111', linewidth=2.0, zorder=3)
    ax.add_patch(tri)
    plus_y  = y_tip + size * 0.4      # non-inverting, TOP
    minus_y = y_tip - size * 0.4      # inverting, BOTTOM
    ax.text(xl + size * 0.3, plus_y,  '+', ha='center', va='center',
            fontsize=13, fontweight='bold', zorder=4)
    ax.text(xl + size * 0.3, minus_y, '−', ha='center', va='center',
            fontsize=14, fontweight='bold', zorder=4)
    return {'plus': (xl, plus_y), 'minus': (xl, minus_y), 'out': (x_tip, y_tip), 'xl': xl}

def callout(ax, x, y, text, fc, ec, fontsize=9):
    ax.text(x, y, text, ha='center', va='center', fontsize=fontsize, color='#111',
            bbox=dict(boxstyle='round,pad=0.5', facecolor=fc, edgecolor=ec, alpha=0.97),
            linespacing=1.5, zorder=6)

def save(fig, name):
    path = os.path.join(OUT, name)
    fig.savefig(path, dpi=150, bbox_inches='tight', facecolor='white', pad_inches=0.25)
    plt.close(fig)
    print('Saved', path)


# ─── Diagram 1: Question (minimal words) ─────────────────────────────────────
fig, ax = new_fig(8.5, 5.0, 'What belongs in the black box?')

rx = 2.0
mid_y = 2.7
vcc(ax, rx, 4.0, '5 V')
resistor_v(ax, rx, 3.7, 2.7, 'R₁', '10 kΩ')
node(ax, rx, mid_y)
resistor_v(ax, rx, 2.7, 1.7, 'R₂', '10 kΩ')
gnd(ax, rx, 1.7)
ax.text(rx - 0.28, mid_y, 'Vmid', ha='right', va='center', fontsize=10,
        color='#222', style='italic')

wire(ax, [(rx, mid_y), (3.4, mid_y)])
_, bb_out = black_box(ax, 3.4, mid_y, w=1.4, label='?')
wire(ax, [(bb_out[0], mid_y), (5.5, mid_y)])
adc_box(ax, 5.5, mid_y)

save(fig, 'diag1_question.png')


# ─── Diagram 2: Answer (voltage follower, NEGATIVE feedback) ─────────────────
fig, ax = new_fig(10, 6.0, 'Answer: Voltage Follower (Unity-Gain Buffer)')

rx = 2.0
mid_y = 4.0
vcc(ax, rx, 5.2, '5 V')
resistor_v(ax, rx, 4.9, 4.0, 'R₁', '10 kΩ')
node(ax, rx, mid_y)
resistor_v(ax, rx, 4.0, 3.1, 'R₂', '10 kΩ')
gnd(ax, rx, 3.1)
ax.text(rx - 0.28, mid_y, 'Vmid', ha='right', va='center', fontsize=10,
        color='#222', style='italic')

oa = opamp(ax, 6.2, mid_y, size=0.85)
# Vmid -> (+) input on top: jog up from mid_y to plus height
wire(ax, [(rx, mid_y), (3.6, mid_y), (3.6, oa['plus'][1]), (oa['plus'][0], oa['plus'][1])])

# Output -> ADC
wire(ax, [(oa['out'][0], oa['out'][1]), (7.7, mid_y)])
fb_tap = 7.0
node(ax, fb_tap, mid_y)
adc_box(ax, 7.7, mid_y)

# Negative feedback: go down, left past triangle edge, up, then right into (−) pin
fb_y = mid_y - 1.0
entry_x = oa['minus'][0] - 0.4   # clearly left of the triangle's left edge
wire(ax, [(fb_tap, mid_y), (fb_tap, fb_y),
          (entry_x, fb_y), (entry_x, oa['minus'][1]),
          (oa['minus'][0], oa['minus'][1])])
ax.text((fb_tap + entry_x) / 2, fb_y - 0.22, 'feedback to (−) input',
        ha='center', va='top', fontsize=8, color='#117a65', style='italic')

callout(ax, 5.0, 1.6,
        'Vmid is sensed, not loaded — the ADC\'s current is supplied by the\n'
        'op-amp\'s power rails, not by R₁ / R₂, so the divider voltage stays put.',
        fc='#d6eaf8', ec='#5dade2', fontsize=9)

save(fig, 'diag2_answer.png')


# ─── Diagram 3: Loading error (no buffer) ────────────────────────────────────
fig, ax = new_fig(10, 6.2, 'Loading Effect: No Buffer  (R₁ = R₂ = 10 kΩ, Vcc = 5 V)')

rx = 2.2
mid_y = 4.2
vcc(ax, rx, 5.4, '5 V')
resistor_v(ax, rx, 5.1, 4.2, 'R₁', '10 kΩ')
node(ax, rx, mid_y)

# split into a parallel pair below the node so labels have room
bus_y = 3.6
wire(ax, [(rx, mid_y), (rx, bus_y)])
r2x, radx = rx - 0.75, rx + 0.75
wire(ax, [(r2x, bus_y), (radx, bus_y)])
resistor_v(ax, r2x, bus_y, 2.3, 'R₂', '10 kΩ')
resistor_v(ax, radx, bus_y, 2.3, 'R_ADC', '10 kΩ')
wire(ax, [(r2x, 2.3), (radx, 2.3)])
node(ax, r2x, bus_y)
node(ax, radx, bus_y)
node(ax, rx, mid_y)
gnd(ax, rx, 2.3)
ax.text(r2x - 0.08, bus_y + 0.22, '(ADC input impedance)', ha='right', va='bottom',
        fontsize=8, color='#888', style='italic')

ax.annotate('Vₘₑₐₛ = ?', xy=(rx, mid_y), xytext=(0.7, mid_y),
            ha='left', va='center', fontsize=10, color='#c0392b', fontweight='bold',
            arrowprops=dict(arrowstyle='->', color='#c0392b', lw=1.4))

callout(ax, 6.6, 4.3,
        'R_bottom  =  R₂ ∥ R_ADC  =  10k ∥ 10k  =  5 kΩ\n\n'
        'Vₘₑₐₛ  =  5 V × 5k / (10k + 5k)  =  1.67 V\n\n'
        'Expected 2.5 V   →   off by 0.83 V  (33 %)',
        fc='#fdf2e9', ec='#e59866', fontsize=9.5)
ax.text(6.6, 1.4, '✗  ADC reads 1.67 V instead of 2.5 V',
        ha='center', va='center', fontsize=10.5, color='#c0392b', fontweight='bold')

save(fig, 'diag3_loading_error.png')


# ─── Diagram 4: With buffer — no loading ─────────────────────────────────────
fig, ax = new_fig(10, 6.2, 'With Voltage Follower: ADC Input Impedance No Longer Matters')

rx = 2.0
mid_y = 4.2
vcc(ax, rx, 5.4, '5 V')
resistor_v(ax, rx, 5.1, 4.2, 'R₁', '10 kΩ')
node(ax, rx, mid_y)
resistor_v(ax, rx, 4.2, 3.3, 'R₂', '10 kΩ')
gnd(ax, rx, 3.3)
ax.text(rx - 0.28, mid_y + 0.05, '2.5 V', ha='right', va='center',
        fontsize=10, color='#117a65', fontweight='bold')

oa = opamp(ax, 6.2, mid_y, size=0.85)
wire(ax, [(rx, mid_y), (3.6, mid_y), (3.6, oa['plus'][1]), (oa['plus'][0], oa['plus'][1])])
# I ~ 0 marker on the input wire
ax.annotate('', xy=(3.5, mid_y), xytext=(3.05, mid_y),
            arrowprops=dict(arrowstyle='->', color='#117a65', lw=1.6))
ax.text(3.05, mid_y - 0.26, 'I ≈ 0', ha='center', va='top',
        fontsize=9, color='#117a65', fontweight='bold')

wire(ax, [(oa['out'][0], oa['out'][1]), (7.7, mid_y)])
fb_tap = 7.0
node(ax, fb_tap, mid_y)
adc_box(ax, 7.7, mid_y)

fb_y = mid_y - 1.0
entry_x = oa['minus'][0] - 0.4
wire(ax, [(fb_tap, mid_y), (fb_tap, fb_y),
          (entry_x, fb_y), (entry_x, oa['minus'][1]),
          (oa['minus'][0], oa['minus'][1])])
ax.text((fb_tap + entry_x) / 2, fb_y - 0.22, 'feedback to (−) input',
        ha='center', va='top', fontsize=8, color='#117a65', style='italic')

callout(ax, 5.0, 1.6,
        'Op-amp input draws ≈ 0 A, so R_ADC in parallel with R₂ has no effect.\n'
        'Vmid stays exactly 2.5 V   →   ADC reads 2.5 V  ✓',
        fc='#d5f5e3', ec='#27ae60', fontsize=9)

save(fig, 'diag4_with_buffer.png')

print('All diagrams generated.')
