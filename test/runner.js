#!/bin/env node

var assert = require('assert');
var buffer = require('buffer');
var fs = require('fs');
var j68 = require('../src/j68');

var json = JSON.parse(fs.readFileSync('test.list', { encoding: 'utf8' }));
json.tests.forEach(function (test) {
	console.log(test);
	var file = fs.readFileSync(test);
	var cpu = new j68.j68();
	for (var i = 0; i < file.length; ++i)
	    cpu.context.s8(i, file[i]|0);
	cpu.context.pc = 0;
	var success = false;
	cpu.context.f = function (inst) {
	    assert.equal(inst, 0xffff);
	    var pc = cpu.context.pc + 2;
	    for (;;) {
	        var command = cpu.context.l32(pc);
	        pc += 4;
	        if (0 == command) {
	            break;
	        } else if (0xa0 <= command && command <= 0xa7) {
	            var r = command - 0xa0;
	            assert.equal(cpu.context.a[r], cpu.context.l32(pc));
	            pc += 4;
	        } else if (0xd0 <= command && command <= 0xd7) {
	            var r = command - 0xd0;
	            assert.equal(cpu.context.d[r], cpu.context.l32(pc));
	            pc += 4;
	        } else if (0xf00 <= command && command <= 0xf1f) {
	            var mask = command & 0x1f;
	            assert.equal(cpu.context.sr & mask, cpu.context.l32(pc));
	            pc += 4;
	        } else {
	            assert.ok(false, 'unknown command: ' + command.toString(16));
	        }
	    }
	    cpu.context.halt = true;
	    success = true;
	};
	cpu.run();
	assert.equal(success, true);
});
