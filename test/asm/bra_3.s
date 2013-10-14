main:
	moveq #0,%d0
	braw skip
	addqb #1,%d0
	addqb #1,%d0
skip:
	addqb #1,%d0
	addqb #1,%d0
	addqb #1,%d0

check:
	.dc.l 0xffffffff
	.dc.l 0xd0, 3
	.dc.l 0
