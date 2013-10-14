#!/bin/sh

AS=m68k-pc-elf-as
OBJCOPY=m68k-pc-elf-objcopy

mkdir -p r

for f in asm/*.s; do
	echo build $f;
	NAME=`basename $f`
	$AS $f -o r/${NAME%s}o
	$OBJCOPY -O binary r/${NAME%s}o r/${NAME%s}r
	rm r/${NAME%s}o
done

rm -f test.list
echo "{ \"tests\": [" > test.list

SEP=""
for f in r/*.r; do
	echo "$SEP\"$f\"" >> test.list
	SEP=","
done

echo "] }" >> test.list
