main:
	moveq #0,%d0
	moveq #-1,%d1
	moveq #-2,%d2
	moveq #-3,%d3
	moveq #-4,%d4
	moveq #-5,%d5
	moveq #-6,%d6
	moveq #-7,%d7

check:
	.dc.l 0xffffffff
	.dc.l 0xd0, 0
	.dc.l 0xd1, 0xffffffff
	.dc.l 0xd2, 0xfffffffe
	.dc.l 0xd3, 0xfffffffd
	.dc.l 0xd4, 0xfffffffc
	.dc.l 0xd5, 0xfffffffb
	.dc.l 0xd6, 0xfffffffa
	.dc.l 0xd7, 0xfffffff9
	.dc.l 0xf1f, 8
	.dc.l 0
