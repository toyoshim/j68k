main:
    move #0xffff, %ccr
    moveq #0,%d0
    move %ccr,%d1
    move #0x0000, %ccr
    moveq #0,%d0
    move %ccr,%d2

    move #0xffff, %ccr
    moveq #1,%d0
    move %ccr,%d3
    move #0x0000, %ccr
    moveq #1,%d0
    move %ccr,%d4

    move #0xffff, %ccr
    moveq #-1,%d0
    move %ccr,%d5
    move #0x0000, %ccr
    moveq #-1,%d0
    move %ccr,%d6

check:
    .dc.l 0xffffffff
    .dc.l 0xd0, 0xffffffff
    .dc.l 0xd1, 0x0014
    .dc.l 0xd2, 0x0004
    .dc.l 0xd3, 0x0010
    .dc.l 0xd4, 0x0000
    .dc.l 0xd5, 0x0018
    .dc.l 0xd6, 0x0008
    .dc.l 0
