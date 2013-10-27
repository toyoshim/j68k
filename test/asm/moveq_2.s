main:
    moveq #0,%d0
    moveq #1,%d1
    moveq #2,%d2
    moveq #3,%d3
    moveq #4,%d4
    moveq #5,%d5
    moveq #6,%d6
    moveq #7,%d7

check:
    .dc.l 0xffffffff
    .dc.l 0xd0, 0
    .dc.l 0xd1, 1
    .dc.l 0xd2, 2
    .dc.l 0xd3, 3
    .dc.l 0xd4, 4
    .dc.l 0xd5, 5
    .dc.l 0xd6, 6
    .dc.l 0xd7, 7
    .dc.l 0xf1f, 0
    .dc.l 0
