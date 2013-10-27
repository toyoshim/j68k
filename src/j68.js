exports.j68 = (function () {
    var Context = function (memorySize) {
        this.d = new Uint32Array(8);  // Data registers.
        this.a = new Uint32Array(8);  // Address registers.
        this.pc = 0;  // Program counter.
        this.i = 0;  // Instruction counts.
        this.cx = 0;  // Condition code X.
        this.cn = 0;  // Condition code N.
        this.cz = 0;  // Condition code Z.
        this.cv = 0;  // Condition code V.
        this.cc = 0;  // Condition code C.
        this.sr = 0;  // Status register.
        this.m = new DataView(new ArrayBuffer(memorySize));  // Memory image.
        this.c = {};  // Code cache.

        this.halt = false;
        this.t = new Uint32Array(1);  // Work.

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
    
    Context.prototype.syncSr = function () {
        this.sr &= 0xff00;
        if (this.cx) this.sr |= 0x10;
        if (this.cn) this.sr |= 0x08;
        if (this.cz) this.sr |= 0x04;
        if (this.cv) this.sr |= 0x02;
        if (this.cc) this.sr |= 0x01;
    };
    
    Context.prototype.setCcr = function (ccr) {
        this.sr = (this.sr & 0xff00) | (ccr & 0x1f);
    };
    
    Context.prototype.xw = function (s16) {
        if (s16 < 0x8000)
            return s16;
        return 0xffff0000 + s16;
    };

    Context.prototype.divs = function (src, dst) {
        // TODO: zero div trap.
        var s16 = this.xw(src & 0xffff);
        var d32 = dst & 0xffffffff;
        if (s16 == 0xffff && d32 == 0x80000000) {
            this.t[0] = 0x00;
            return 0;
        }
        var q = (d32 / s16)|0;
        var q16 = q & 0xffff;
        if (q != this.xw(q16)) {
            this.t[0] = 0x02;
            return d32;
        }
        var r = d32 % s16;
        this.t[0] = 0;
        if (q === 0) this.t[0] |= 0x04;
        else if (q & 0x8000) this.t[0] |= 0x08;
        return q16 + (r << 16);
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
    
    j68.prototype.effectiveAddress = function (pc, inst, regop, memop, size) {
        // TODO: Check supporting addressing mode for each operation.
        var mode = (inst >> 3) & 7;
        var r = inst & 7;
        var ea;
        var disp;
        switch (mode) {
            case 0:
                ea = 'c.d[' + r + ']';
                return {
                    'code': regop(ea),
                    'pc': pc + 2
                };
            case 1:
                ea = 'c.a[' + r + ']';
                return {
                    'code': regop(ea),
                    'pc': pc + 2
                };
            case 2:
                ea = 'c.a[' + r + ']';
                return {
                    'code': memop(ea),
                    'pc': pc + 2
                };
            case 3:
                ea = 'c.a[' + r + ']';
                return {
                    'code': memop(ea) + ea + '+=' + size + ';',
                    'pc': pc + 2
                };
            case 4:
                ea = 'c.a[' + r + ']';
                return {
                    'code': ea + '-=' + size + ';' + memop(ea),
                    'pc': pc + 2
                };
            case 5:
                disp = this.context.fetch(pc + 2);
                ea = 'c.a[' + r + ']+' + this.extS16U32(disp);
                return {
                    'code': memop(ea),
                    'pc': pc + 4
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
                    'code': memop(ea),
                    'pc': pc + 4
                };
            case 7:
                switch (r) {
                    case 2:
                        disp = this.context.fetch(pc + 2);
                        ea = '' + this.addU32S16(pc + 2, disp);
                        return {
                            'code': memop(ea),
                            'pc': pc + 4
                        };
                    case 4:
                        ea = this.extS16U32(this.context.fetch(pc + 2));
                        return {
                            'code': regop(ea),
                            'pc': pc + 4
                        }
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
        
        // 2. Insert PC/SR update.
        for (i = asmLength - 1; i > 0; --i) {
            if (!asm[i].in)
                continue;
            if (asm[i].in.pc)
                asm[i - 1].post.push('c.pc=' + asm[i].pc + ';');
            if (asm[i].in.sr)
                asm[i - 1].post.push('c.syncSr();');
        }
        for (i = 0; i < asmLength; ++i) {
            if (asm[i].code)
                opt.push(asm[i].code.join(''));
            if (asm[i].post)
                opt.push(asm[i].post.join(''));
        }
        
        // 3. Final code generation.
        var optCode = opt.join('');
        var func = new Function('c', optCode);
        if (this.logJit) {
            console.timeEnd('compile');
            if (this.logOpt)
                this.log(JSON.stringify(asm));
            this.log(func);
            if (optCode.indexOf(';;') >= 0)
                throw console.assert(false, 'unexpected code sequence: ' + optCode);
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
            case 0x8:  // ...
                return this.decode8(pc, inst);
            case 0x9:  // SUB
                return this.decode9(pc, inst);
            case 0xd:  // ADDX, ADDA, ADD
                return this.decodeD(pc, inst);
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
        var ea;
        switch (mode) {
            case 0:
                // MOVEL *,dx
                ea = this.effectiveAddress(
                        pc, inst,
                        function (ea) { return 'c.d[' + r + ']=' + ea + ';'; },
                        function (ea) { return 'c.d[' + r + ']=c.l32(' + ea + ');'; },
                        4);
                return {
                    'code': [ ea.code ],
                    'out': this.flagMove('c.d[' + r + ']'),
                    'pc': ea.pc
                };
            case 1:
                // MOVEAL
                ea = this.effectiveAddress(
                        pc, inst,
                        function (ea) { return 'c.a[' + r + ']=' + ea + ';'; },
                        function (ea) { return 'c.a[' + r + ']=c.l32(' + ea + ');'; },
                        4);
                return {
                    'code': [ ea.code ],
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
        var ea;
        switch (op) {
            case 3:
                switch (r) {
                    case 1:
                        // MOVE from CCR
                        ea = this.effectiveAddress(
                                pc, inst,
                                function (ea) { return ea + '=c.sr&0x00ff;'; },
                                function (ea) { return 'c.s16(' + ea + ',c.str&0x00ff);'; },
                                2);
                        return {
                            'in': {
                                'x': true,
                                'n': true,
                                'z': true,
                                'v': true,
                                'c': true
                            },
                            'code': [ 'c.syncSr();', ea.code ],
                            'pc': ea.pc
                        };
                        // TODO
                        break;
                    case 2:
                        // MOVE to CCR
                        ea = this.effectiveAddress(
                                pc, inst,
                                function (ea) { return 'c.setCcr(' + ea + ');'; },
                                function (ea) { return 'c.setCcr(c.l16(' + ea + '));'; },
                                2);
                        return {
                            'code': [ ea.code ],
                            'out': {
                                'x': 'c.sr&0x10',
                                'n': 'c.sr&0x08',
                                'z': 'c.sr&0x04',
                                'v': 'c.sr&0x02',
                                'c': 'c.sr&0x01'
                            },
                            'pc': ea.pc
                        };
                }
                // TODO: Implement others.
                break;
            case 7:
                // LEA
                ea = this.effectiveAddress(
                        pc, inst,
                        function (ea) { return 'c.a[' + r + ']=' + ea + ';'; },  // TODO: Correct?
                        function (ea) { return 'c.a[' + r + ']=' + ea + ';'; },
                        4);
                return {
                    'code': [ ea.code ],
                    'pc': ea.pc
                };
        }
        // TODO: Implement other operations.
        this.log('not impl: line=4, op=' + op + ', r=' + r);
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
    
    j68.prototype.decode8 = function (pc, inst) {
        var r = (inst >> 9) & 7;
        var opmode = (inst >> 6) & 7;
        var code = [];
        var ea;
        var out;
        switch (opmode) {
            case 7:  // DIVS
                ea = this.effectiveAddress(
                        pc, inst,
                        function (ea) { return 'c.d[' + r + ']=c.divs(' + ea + ',' + 'c.d[' + r + ']);'; },
                        function (ea) { return 'c.d[' + r + ']=c.divs(c.l16(' + ea + '),' + 'c.d[' + r + ']);'; },
                        2);
                code.push(ea.code);
                out = {
                    'n': 'c.t[0]&8',
                    'z': 'c.t[0]&4',
                    'v': 'c.t[0]&2',
                    'c': false
                };
                break;
            default:
                // TODO: Implement.
                this.log('line 9 not impl opmode: ' + opmode);
                throw console.assert(false);
        }
        return {
            'code': code,
            'out': out,
            'pc': ea.pc
        };
    };

    j68.prototype.decode9 = function (pc, inst) {
        // SUB, SUBA
        var r = (inst >> 9) & 7;
        var opmode = (inst >> 6) & 7;
        var code = [];
        var ea;
        switch (opmode) {
            case 7:  // SUBAL
                ea = this.effectiveAddress(
                        pc, inst, 
                        function (ea) { return 'c.a[' + r + ']-=' + ea + ';'; },
                        function (ea) { return 'c.a[' + r + ']-=c.l32(' + ea + ');'; },
                        4);
                code.push(ea.code);
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
    
    j68.prototype.decodeD = function (pc, inst) {
        // ADDX, ADDA, ADD
        var r = (inst >> 9) & 7;
        var opmode = (inst >> 6) & 7;
        var code = [];
        var ea;
        switch (opmode) {
            case 7:  // ADDAL
                var ea = this.effectiveAddress(
                        pc, inst,
                        function (ea) { return 'c.a[' + r + ']+=' + ea + ';'; },
                        function (ea) { return 'c.a[' + r + ']+=c.l32(' + ea + ');'; },
                        4);
                code.push(ea.code);
                break;
            default:
                // TODO: Implement other opmode.
                // SUB will need condition update.
                this.log('add not impl opmode: ' + opmode);
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
                'sr': true
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