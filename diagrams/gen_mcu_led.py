#!/usr/bin/env python3
"""
Generate the MCU-LED flashcard diagrams using the reusable schematic library.
  public/diagrams/mcu_q1_question.png   MCU drives LED directly — what circuit?
  public/diagrams/mcu_q1_answer.png     GPIO -> 150 Ohm -> LED -> GND
  public/diagrams/mcu_q2_question.png   MCU limited to 5 mA, LED needs 20 mA
  public/diagrams/mcu_q2_answer.png     Low-side NFET switch
"""
from schematic import Schematic, YLW, RED, GRN, DIM, TEAL, FG, BG


# ─── Q1 question ──────────────────────────────────────────────────────────
def q1_question():
    s = Schematic(7.0, 4.0)
    s.mcu(1.7, 2.0, pin_limit='20 mA / pin')
    s.led(5.2, 2.0, label='', vf='Vf = 2V')
    s.text(5.2, 2.85, 'LED', c=FG, size=11, va='bottom')
    s.text(5.2, 1.05, 'min 1 mA to light', c=DIM, size=9, va='top')
    s.text(3.5, 2.0, '?', c=YLW, size=34, weight='bold')
    s.save('public/diagrams/mcu_q1_question.png')


# ─── Q1 answer: GPIO -> 150 Ohm -> LED -> GND ─────────────────────────────
def q1_answer():
    s = Schematic(6.8, 5.6)
    rx = 4.6
    top_y = 4.9

    # MCU lower-left; its GPIO pin IS the source when driven HIGH
    mcu = s.mcu(1.5, 2.3, pin_limit='20 mA / pin')

    # vertical branch on the right: node -> R -> LED -> GND
    s.node_label(rx, top_y, '3.3V  (GPIO = HIGH)', c=GRN)
    r   = s.resistor(rx, top_y - 0.75, label='150 Ω', sub='V_R = 1.3V',
                     sub_side='left')       # value right, drop left (riser is further left)
    led = s.led(rx, top_y - 2.15, vf='Vf = 2V', label='LED')
    gnd = s.gnd(rx, 0.7)

    s.wire((rx, top_y), r.t)
    s.wire(r.b, led.a)
    s.wire(led.k, gnd.t)

    # GPIO -> top node: right, up the gap (left of all labels), into the rail
    riser_x = 3.0
    s.wire(mcu.gpio, (riser_x, mcu.gpio[1]), (riser_x, top_y), (rx, top_y),
           c=TEAL)

    # current arrow on the far right
    s.arrow(rx + 0.78, top_y - 1.15, rx + 0.78, top_y - 1.6)
    s.text(rx + 0.93, top_y - 1.38, 'I ≈ 9 mA', c=YLW, size=9, ha='left')

    s.save('public/diagrams/mcu_q1_answer.png')


# ─── Q2 question: pin can't supply 20 mA ──────────────────────────────────
def q2_question():
    s = Schematic(7.0, 4.2)
    s.text(3.5, 3.85, 'The Vcc rail can supply plenty of current — how do you use it?',
           c=GRN, size=8.5, style='italic')
    s.mcu(1.7, 2.0, pin_limit='5 mA / pin')
    s.led(5.3, 2.0, label='', vf='Vf = 2V')
    s.text(5.3, 2.85, 'LED', c=FG, size=11, va='bottom')
    s.text(5.3, 1.05, 'needs 20 mA', c=RED, size=9.5, va='top', weight='bold')
    s.text(3.55, 2.05, '✗', c=RED, size=30)
    s.text(3.55, 1.25, "can't source\nenough current", c=DIM, size=8.5, va='top')
    s.save('public/diagrams/mcu_q2_question.png')


# ─── Q2 answer: low-side NFET switch ──────────────────────────────────────
def q2_answer():
    s = Schematic(6.8, 6.4)
    rx = 4.4
    top_y = 5.9

    vcc = s.vcc(rx, top_y, label='Vcc = 3.3V')
    r   = s.resistor(rx, top_y - 0.85, label='68 Ω', sub='V_R = 1.3V',
                     sub_side='left')
    led = s.led(rx, top_y - 2.25, vf='Vf = 2V', label='LED')
    fet = s.nfet(rx, top_y - 3.95, label='NFET\n(logic-level)', show_g=False)
    gnd = s.gnd(rx, 0.6)

    s.wire(vcc.b, r.t)
    s.wire(r.b, led.a)
    s.wire(led.k, fet.d)
    s.wire(fet.s, gnd.t)

    # MCU on the left, vertically aligned so GPIO -> gate is one straight wire.
    # Suppress its built-in pin label; we annotate the gate wire instead.
    mcu = s.mcu(1.6, fet.c[1], pin_limit='5 mA / pin', pin_label='')
    s.wire(mcu.gpio, fet.g, c=TEAL)
    s.text((mcu.gpio[0] + fet.g[0]) / 2, fet.c[1] + 0.15, 'GPIO = HIGH',
           c=TEAL, size=8.5, ha='center', va='bottom')

    # current arrow between R and LED
    s.arrow(rx + 0.78, top_y - 1.3, rx + 0.78, top_y - 1.75)
    s.text(rx + 0.93, top_y - 1.53, 'I ≈ 19 mA', c=YLW, size=9, ha='left')

    s.save('public/diagrams/mcu_q2_answer.png')


def q2_answer_alt():
    """Same as q2_answer but uses nfet_alt (arrow on vertical source lead)."""
    s = Schematic(6.8, 6.4)
    rx = 4.4
    top_y = 5.9

    vcc = s.vcc(rx, top_y, label='Vcc = 3.3V')
    r   = s.resistor(rx, top_y - 0.85, label='68 Ω', sub='V_R = 1.3V',
                     sub_side='left')
    led = s.led(rx, top_y - 2.25, vf='Vf = 2V', label='LED')
    fet = s.nfet_alt(rx, top_y - 3.95, label='NFET\n(logic-level)', show_g=False)
    gnd = s.gnd(rx, 0.6)

    s.wire(vcc.b, r.t)
    s.wire(r.b, led.a)
    s.wire(led.k, fet.d)
    s.wire(fet.s, gnd.t)

    mcu = s.mcu(1.6, fet.c[1], pin_limit='5 mA / pin', pin_label='')
    s.wire(mcu.gpio, fet.g, c=TEAL)
    s.text((mcu.gpio[0] + fet.g[0]) / 2, fet.c[1] + 0.15, 'GPIO = HIGH',
           c=TEAL, size=8.5, ha='center', va='bottom')

    s.arrow(rx + 0.78, top_y - 1.3, rx + 0.78, top_y - 1.75)
    s.text(rx + 0.93, top_y - 1.53, 'I ≈ 19 mA', c=YLW, size=9, ha='left')

    s.save('public/diagrams/mcu_q2_answer_alt.png')


if __name__ == '__main__':
    q1_question()
    q1_answer()
    q2_question()
    q2_answer()
    q2_answer_alt()
    print('Done.')
