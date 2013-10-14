main:
    lea data,%a0
    moveq #0,%d0
    movel %a0@(0,%d0:l:1),%d1
    movel %a0@(4,%d0:l:1),%d2
    moveq #4,%d0
    movel %a0@(0,%d0:l:1),%d3
    movel %a0@(0,%d0:l:2),%d4
    moveq #1,%d0
    movel %a0@(0,%d0:l:4),%d5
    movel %a0@(0,%d0:l:8),%d6

check:
    .dc.l 0xffffffff
    .dc.l 0xd0, 1
    .dc.l 0xd1, 0x12345678
    .dc.l 0xd2, 0xdeadbeaf
    .dc.l 0xd3, 0xdeadbeaf
    .dc.l 0xd4, 0x33333333
    .dc.l 0xd5, 0xdeadbeaf
    .dc.l 0xd6, 0x33333333
    .dc.l 0

data:
    .dc.l 0x12345678
    .dc.l 0xdeadbeaf
    .dc.l 0x33333333
