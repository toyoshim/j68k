main:
    lea data,%a0
    movel %a0@,%a0
    movel %a0,%d0
    movel %d0,%d1

check:
    .dc.l 0xffffffff
    .dc.l 0xa0, 0x12345678
    .dc.l 0xd0, 0x12345678
    .dc.l 0xd1, 0x12345678
    .dc.l 0xf0f, 0
    .dc.l 0

data:
    .dc.l 0x12345678
