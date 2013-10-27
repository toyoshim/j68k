main:
    move #0xffff, %ccr
    move %ccr,%d0
    move #0x0000, %ccr
    move %ccr,%d1
    move #0x0001, %ccr
    move %ccr,%d2
    move #0x0002, %ccr
    move %ccr,%d3
    move #0x0004, %ccr
    move %ccr,%d4
    move #0x0008, %ccr
    move %ccr,%d5
    move #0x0010, %ccr
    move %ccr,%d6

check:
    .dc.l 0xffffffff
    .dc.l 0xd0, 0x0000001f
    .dc.l 0xd1, 0x00000000
    .dc.l 0xd2, 0x00000001
    .dc.l 0xd3, 0x00000002
    .dc.l 0xd4, 0x00000004
    .dc.l 0xd5, 0x00000008
    .dc.l 0xd6, 0x00000010
    .dc.l 0
