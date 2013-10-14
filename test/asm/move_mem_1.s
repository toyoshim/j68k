main:
    lea data,%a0
    movel %a0@,%a1
    movel %a0@+,%a2
    movel %a0@+,%a3
    movel %a0@,%a4
    movel %a0@-,%a5
    movel %a0@-,%a6

check:
    .dc.l 0xffffffff
    .dc.l 0xa1, 0x12345678
    .dc.l 0xa2, 0x12345678
    .dc.l 0xa3, 0xdeadbeaf
    .dc.l 0xa4, 0x33333333
    .dc.l 0xa5, 0xdeadbeaf
    .dc.l 0xa6, 0x12345678
    .dc.l 0

data:
    .dc.l 0x12345678
    .dc.l 0xdeadbeaf
    .dc.l 0x33333333
