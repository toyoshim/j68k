exports.j68 = (function () {
    var Context = function (memorySize) {
        this.d = new Uint32Array(8);
        this.a = new Uint32Array(8);
        this.pc = 0;
        this.i = 0;
        this.cx = 0;
        this.cn = 0;
        this.cz = 0;
        this.cv = 0;
        this.cc = 0;
        this.sr = 0;
        this.m = new DataView(new ArrayBuffer(memorySize));
        this.c = {};
        this.halt = false;

        // TODO: Check memory alignments, do cache invalidation.
        this.l8 = function (address) { return this.m.getUint8(address); };
        this.l16 = function (address) { return this.m.getUint16(address); };
        this.l32 = function (address) { return this.m.getUint32(address); };
        this.fetch = function (address) { return this.m.getUint16(address); };

        // Returns false if the running code is modified.
        this.s8 = function (address, data) { this.m.setUint8(address, data); return true; };
        this.s16 = function (address, data) { this.m.setUint8(address, data); return true; };
        this.s32 = function (address, data) { this.m.setUint32(address, data); return true; };

        // F-line emulation hook.        
        this.f = function (inst) {};

        Object.seal(this);
    };
    
    Context.prototype.ccr = function () {
        this.sr &= 0xff00;
        if (this.cx) this.sr |= 0x10;
        if (this.cn) this.sr |= 0x08;
        if (this.cz) this.sr |= 0x04;
        if (this.cv) this.sr |= 0x02;
        if (this.cc) this.sr |= 0x01;
    };
    
    Context.prototype.xw = function (s16) {
        if (s16 < 0x8000)
            return s16;
        return 0xffff0000 + s16;
    };

    var toHex = function (n, l) {
        var size = l || 8;
        return ('0000000' + n.toString(16)).substr(-size);
    };
    
    var j68 = function () {
        // 1MB RAM (0000_0000 - 000f_ffff)
        this.context = new Context(1024 * 1024);
        
        this.type = j68.TYPE_MC68000;
        
        this.logJit = true;
        this.logOpt = true;
        this.logDecode = true;
    };
    
    j68.TYPE_MC68000 = 0;
    j68.TYPE_MC68020 = 2;
    j68.TYPE_MC68030 = 3;
    j68.TYPE_MC68040 = 4;
    
    j68.prototype.log = function (message) {
        console.log('j68: ' + message);
    };
    
    j68.prototype.extS8U32 = function (s8) {
        if (s8 < 0x80)
            return s8;
        return 0xffffff00 + s8;
    };
    
    j68.prototype.extS16U32 = function (s16) {
        return this.context.xw(s16);
    };
    
    j68.prototype.addU32S8 = function (u32, s8) {
        return u32 + this.extS8U32(s8);
    };

    j68.prototype.addU32S16 = function (u32, s16) {
        return u32 + this.extS16U32(s16);
    };
    
    j68.prototype.effectiveAddress = function (pc, inst, ld, size) {
        var mode = (inst >> 3) & 7;
        var r = inst & 7;
        var ea;
        var disp;
        switch (mode) {
            case 0:
                ea = 'c.d[' + r + ']';
                return {
                    'pre': '',
                    'post': '',
                    'pc': pc + 2,
                    'ea': ea,
                    'data': ea
                };
            case 1:
                ea = 'c.a[' + r + ']';
                return {
                    'pre': '',
                    'post': '',
                    'pc': pc + 2,
                    'ea': ea,
                    'data': ea
                };
            case 2:
                ea = 'c.a[' + r + ']';
                return {
                    'pre': '',
                    'post': '',
                    'pc': pc + 2,
                    'ea': ea,
                    'data': ld + '(' + ea + ')'
                };
            case 3:
                ea = 'c.a[' + r + ']';
                return {
                    'pre': '',
                    'post': ';' + ea + '+=' + size,
                    'pc': pc + 2,
                    'ea': ea,
                    'data': ld + '(' + ea + ')'
                };
            case 4:
                ea = 'c.a[' + r + ']';
                return {
                    'pre': ea + '-=' + size + ';',
                    'post': '',
                    'pc': pc + 2,
                    'ea': ea,
                    'data': ld + '(' + ea + ')'
                };
            case 5:
                disp = this.context.fetch(pc + 2);
                ea = 'c.a[' + r + ']+' + this.extS16U32(disp);
                return {
                    'pre': '',
                    'post': '',
                    'pc': pc + 4,
                    'ea': ea,
                    'data': ld + '(' + ea + ')'
                };
            case 6:
                disp = this.context.fetch(pc + 2);
                // TODO: Support full format extended word for 20, 30, and 40.
                if (disp & 0x0100)
                    throw console.assert(false);
                var regName = ((disp & 0x8000) ? 'c.a[' : 'c.d[') + ((disp >> 12) & 7) + ']';
                if (0 === (disp & 0x0800))
                    regName = 'this.xw(' + regName + '&0xffff)';
                var scale = (disp >> 9) & 3;
                if (scale !== 0)
                    regName = '(' + regName + [ '<<1)', '<<2)', '<<3)' ][scale - 1];
                ea = 'c.a[' + r + ']+' + regName + '+' + this.extS8U32(disp & 0xff);
                return {
                    'pre': '',
                    'post': '',
                    'pc': pc + 4,
                    'ea': ea,
                    'data': ld + '(' + ea + ')'
                };
            case 7:
                switch (r) {
                    case 2:
                        disp = this.context.fetch(pc + 2);
                        ea = '' + this.addU32S16(pc + 2, disp);
                        return {
                            'pre': '',
                            'post': '',
                            'pc': pc + 4,
                            'ea': ea,
                            'data': ld + '(' + ea + ')'
                        };
                }
                this.log('not impl ea mode 7 r: ' + r);
                throw console.assert(false);
        }
        // TODO: Implement other mode
        this.log('not impl ea mode: ' + mode);
        throw console.assert(false);
    };
    
    j68.prototype.run = function () {
        var c = this.context;
        for (;;) {
            var pc = c.pc;
            if (!c.c[pc])
                c.c[pc] = this.compile();
            c.c[pc](c);
            if (c.halt)
                break;
        }
    };
    
    j68.prototype.compile = function () {
        if (this.logJit) {
            this.log('bynary translation; pc=$' + toHex(this.context.pc));
            console.time('compile');
        }
        
        // Binary code generations.
        var pc = this.context.pc;
        var asm = [];
        var i = 0;
        for (;;) {
            var code = this.decode(pc);
            asm.push(code);
            pc = code.pc;
            i++;
            if (code.quit) {
                if (!code.in || !code.in.pc)
                    asm.push({ 'code': ['c.pc=' + pc + ';' ] });
                asm.push({ 'code': ['c.i+=' + i + ';' ] });
                if (code.error) {
                    this.context.halt = true;
                    this.log('compile error: ' + code.message);
                }
                break;
            }
        }
        
        // Optimize generated codes.
        var opt = [];
        var asmLength = asm.length;

        // 1. Eliminate unused condition calculations.
        var flags = [ 'x', 'n', 'z', 'v', 'c' ];
        for (i = 0; i < asmLength; ++i) {
            asm[i].post = [];
            if (!asm[i].out)
                continue;
            for (var type = 0; type < flags.length; ++type) {
                var flag = flags[type];
                if (!asm[i].out[flag])
                    continue;
                for (var j = i + 1; j < asmLength; ++j) {
                    if (asm[j].in && asm[j].in[flag])
                        break;
                    if (asm[j].out && asm[j].out[flag]) {
                        asm[i].out[flag] = null;
                        break;
                    }
                }
                if (asm[i].out[flag]) {
                    asm[i].post.push('c.c' + flag + '=' + asm[i].out[flag] + ';');
                }
            }
        }
        
        // 2. Insert PC/CR update.
        for (i = asmLength - 1; i > 0; --i) {
            if (!asm[i].in)
                continue;
            if (asm[i].in.pc)
                asm[i - 1].post.push('c.pc=' + asm[i].pc + ';');
            if (asm[i].in.ccr)
                asm[i - 1].post.push('c.ccr();');
        }
        for (i = 0; i < asmLength; ++i) {
            if (asm[i].code)
                opt.push(asm[i].code.join(''));
            if (asm[i].post)
                opt.push(asm[i].post.join(''));
        }
        
        // 3. Final code generation.
        var func = new Function('c', opt.join(''));
        if (this.logJit) {
            console.timeEnd('compile');
            if (this.logOpt)
                this.log(JSON.stringify(asm));
            this.log(func);
        }
        return func;
    };
    
    j68.prototype.decode = function (pc) {
        var inst = this.context.fetch(pc);
        if (this.logDecode)
            this.log('decode; $' + toHex(pc) + ': ' + toHex(inst, 4));
        var line = (inst >> 12) & 0xf;
        switch (line) {
            case 0x2:  // MOVEL, MOVEAL
                return this.decode2(pc, inst);
            case 0x4:  // LEA
                return this.decode4(pc, inst);
            case 0x5:  // ADDQ
                return this.decode5(pc, inst);
            case 0x6:  // BRA / BSR / Bcc (TODO: Test)
                return this.decode6(pc, inst);
            case 0x7:  // MOVEQ (TODO: unused bit check)
                return this.decode7(pc, inst);
            case 0x9:  // SUB
                return this.decode9(pc, inst);
            case 0xf:  // F-line
                return this.decodeF(pc, inst);
        }
        // TODO: Implement other operations.
        throw console.assert(false);
    };
    
    j68.prototype.decode2 = function (pc, inst) {
        // MOVEL, MOVEAL
        var r = (inst >> 9) & 7;
        var mode = (inst >> 6) & 7;
        var ea = this.effectiveAddress(pc, inst, 'c.l32', 4);
        switch (mode) {
            case 0:
                // MOVEL *,dx
                return {
                    'code': [ ea.pre + 'c.d[' + r + ']=' + ea.data + ea.post + ';' ],
                    'out': this.flagMove('c.d[' + r + ']'),
                    'pc': ea.pc
                };
            case 1:
                // MOVEAL
                return {
                    'code': [ ea.pre + 'c.a[' + r + ']=' + ea.data + ea.post + ';' ],
                    'pc': ea.pc
                };
        }
        // TODO: Implement other modes.
        this.log('not impl movel mode: ' + mode);
        throw console.assert(false);
    };
    
    j68.prototype.decode4 = function (pc, inst) {
        var r = (inst >> 9) & 7;
        var op = (inst >> 6) & 7;
        var ea = this.effectiveAddress(pc, inst);  // TODO: Check supporting addressing mode.
        if (op == 7) {
            // LEA
            return {
                'code': [ ea.pre + 'c.a[' + r + ']=' + ea.ea + ea.post + ';' ],
                'pc': ea.pc
            };
        }
        // TODO
        throw console.assert(false);
    };
    
    // TODO
    j68.prototype.decode5 = function (pc, inst) {
        // ADDQ
        var data = (inst >> 9) & 7;
        var zero = (inst >> 8) & 1;
        var size = (inst >> 6) & 3;
        var mode = (inst >> 3) & 7;
        var r = inst & 7;
        if (zero || size == 3) {
            // TODO: Unknown instruction.
            throw console.assert(false);
        }
        var code = [];
        if (mode == 0) {
            // TODO: Set conditions.
            code.push('c.d[' + r + ']+=' + (data << size) + ';');
        } else {
            // TODO: Implement.
            throw console.assert(false);
        }
        return {
            'code': code,
            'pc': pc + 2
        };
    }
    
    j68.prototype.decode6 = function (pc, inst) {
        var cond = (inst >> 8) & 0xf;
        var disp = inst & 0xff;
        var nextPc = pc;
        if (cond === 0) {
            // BRA
            if (disp === 0) {
                // 16-bit disp.
                disp = this.context.fetch(pc + 2);
                nextPc = this.addU32S16(pc + 2, disp);
            } else if (this.type != j68.TYPE_MC68000 && disp == 0xff) {
                // 32-bit disp.
                // TODO: Implement.
                throw console.assert(false);
            } else {
                nextPc = this.addU32S8(pc + 2, disp);
            }
            return {
                'pc': nextPc,
                'quit': true
            }
        }
        // TODO: Implement BSR, Bcc
        throw console.assert(false);
    };

    j68.prototype.decode7 = function (pc, inst) {
        // MOVEQ
        var r = (inst >> 9) & 0x7;
        var zero = (inst >> 8) & 1;
        var data = inst & 0xff;
        if (zero) {
            // TODO: Unknown instruction.
            throw console.assert(false);
        }
        return {
            'code': [ 'c.d[' + r + ']=' + this.extS8U32(data) + ';' ],
            'out': this.flagMove('c.d[' + r + ']'),
            'pc': pc + 2
        };
    };
    
    j68.prototype.decode9 = function (pc, inst) {
        // SUB, SUBA
        var r = (inst >> 9) & 7;
        var opmode = (inst >> 6) & 7;
        var ea = this.effectiveAddress(pc, inst, 'c.l32', 4);
        var code = [];
        switch (opmode) {
            case 7:  // SUBAL
                code.push(ea.pre + 'c.a[' + r + ']-=' + ea.data + ea.post + ';');
                break;
            default:
                // TODO: Implement other opmode.
                // SUB will need condition update.
                this.log('sub not impl opmode: ' + opmode);
                throw console.assert(false);
        }
        return {
            'code': code,
            'pc': ea.pc
        };
    };
    
    j68.prototype.decodeF = function (pc, inst) {
        // F-line
        return {
            'in': {
                'pc': true,
                'x': true,
                'n': true,
                'z': true,
                'v': true,
                'c': true,
                'ccr': true
            },
            'code': [ 'c.f(' + inst + ');' ],
            'pc': pc + 2,
            'quit': true
        };
    };
    
    j68.prototype.flagMove = function (r) {
        return {
            'n': '(' + r + '>>31)',
            'z': '(' + r + '==0)',
            'v': '0',
            'c': '0'
        };
    };
    
    return j68;
})();