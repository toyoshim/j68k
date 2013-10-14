main:
    subal %a0,%a0
    lea %a0@(4),%a1
    lea %a0@(8),%a2
    lea %a2@(8),%a3
    lea %a3@(0),%a4
    lea %a3@(0),%a5
    subal %a1,%a5

check:
    .dc.l 0xffffffff
    .dc.l 0xa0, 0
    .dc.l 0xa1, 4
    .dc.l 0xa2, 8
    .dc.l 0xa3, 16
    .dc.l 0xa4, 16
    .dc.l 0xa5, 12
    .dc.l 0
