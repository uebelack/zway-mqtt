/*** MQTT Z-Way module *******************************************
 Version: 0.0.1
 -----------------------------------------------------------------------------
 Author: David Uebelacker <david@uebelacker.ch>
 Buffer from: https://github.com/toots/buffer-browserify
 MQTT from: https://github.com/leizongmin/MQTTClient
 ******************************************************************************/

var assert = {};
assert.ok = function (message) {
    console.log(message);
};

Buffer.poolSize = 8192;

function stringtrim(str) {
    if (str.trim) return str.trim();
    return str.replace(/^\s+|\s+$/g, '');
}

function Buffer(subject, encoding, offset) {
    if (!(this instanceof Buffer)) {
        return new Buffer(subject, encoding, offset);
    }
    this.parent = this;
    this.offset = 0;

    // Work-around: node's base64 implementation
    // allows for non-padded strings while base64-js
    // does not..
    if (encoding == "base64" && typeof subject == "string") {
        subject = stringtrim(subject);
        while (subject.length % 4 != 0) {
            subject = subject + "=";
        }
    }

    var type;

    // Are we slicing?
    if (typeof offset === 'number') {
        this.length = coerce(encoding);
        // slicing works, with limitations (no parent tracking/update)
        // check https://github.com/toots/buffer-browserify/issues/19
        for (var i = 0; i < this.length; i++) {
            this[i] = subject.get(i + offset);
        }
    } else {
        // Find the length
        switch (type = typeof subject) {
            case 'number':
                this.length = coerce(subject);
                break;

            case 'string':
                this.length = Buffer.byteLength(subject, encoding);
                break;

            case 'object': // Assume object is an array
                this.length = coerce(subject.length);
                break;

            default:
                throw new TypeError('First argument needs to be a number, ' +
                    'array or string.');
        }

        // Treat array-ish objects as a byte array.
        if (isArrayIsh(subject)) {
            for (var i = 0; i < this.length; i++) {
                if (subject instanceof Buffer) {
                    this[i] = subject.readUInt8(i);
                }
                else {
                    // Round-up subject[i] to a UInt8.
                    // e.g.: ((-432 % 256) + 256) % 256 = (-176 + 256) % 256
                    //                                  = 80
                    this[i] = ((subject[i] % 256) + 256) % 256;
                }
            }
        } else if (type == 'string') {
            // We are a string
            this.length = this.write(subject, 0, encoding);
        } else if (type === 'number') {
            for (var i = 0; i < this.length; i++) {
                this[i] = 0;
            }
        }
    }
}

Buffer.prototype.get = function get(i) {
    if (i < 0 || i >= this.length) throw new Error('oob');
    return this[i];
};

Buffer.prototype.set = function set(i, v) {
    if (i < 0 || i >= this.length) throw new Error('oob');
    return this[i] = v;
};

Buffer.byteLength = function (str, encoding) {
    switch (encoding || "utf8") {
        case 'hex':
            return str.length / 2;

        case 'utf8':
        case 'utf-8':
            return utf8ToBytes(str).length;

        case 'ascii':
        case 'binary':
            return str.length;

        case 'base64':
            return base64ToBytes(str).length;

        default:
            throw new Error('Unknown encoding');
    }
};

Buffer.prototype.utf8Write = function (string, offset, length) {
    var bytes, pos;
    return Buffer._charsWritten = blitBuffer(utf8ToBytes(string), this, offset, length);
};

Buffer.prototype.asciiWrite = function (string, offset, length) {
    var bytes, pos;
    return Buffer._charsWritten = blitBuffer(asciiToBytes(string), this, offset, length);
};

Buffer.prototype.binaryWrite = Buffer.prototype.asciiWrite;

Buffer.prototype.base64Write = function (string, offset, length) {
    var bytes, pos;
    return Buffer._charsWritten = blitBuffer(base64ToBytes(string), this, offset, length);
};

Buffer.prototype.utf8Slice = function () {
    var bytes = Array.prototype.slice.apply(this, arguments);
    var res = "";
    var tmp = "";
    var i = 0;
    while (i < bytes.length) {
        if (bytes[i] <= 0x7F) {
            res += decodeUtf8Char(tmp) + String.fromCharCode(bytes[i]);
            tmp = "";
        } else
            tmp += "%" + bytes[i].toString(16);

        i++;
    }

    return res + decodeUtf8Char(tmp);
}

Buffer.prototype.asciiSlice = function () {
    var bytes = Array.prototype.slice.apply(this, arguments);
    var ret = "";
    for (var i = 0; i < bytes.length; i++)
        ret += String.fromCharCode(bytes[i]);
    return ret;
}

Buffer.prototype.binarySlice = Buffer.prototype.asciiSlice;

Buffer.prototype.inspect = function () {
    var out = [],
        len = this.length;
    for (var i = 0; i < len; i++) {
        out[i] = toHex(this[i]);
        if (i == exports.INSPECT_MAX_BYTES) {
            out[i + 1] = '...';
            break;
        }
    }
    return '<Buffer ' + out.join(' ') + '>';
};


Buffer.prototype.hexSlice = function (start, end) {
    var len = this.length;

    if (!start || start < 0) start = 0;
    if (!end || end < 0 || end > len) end = len;

    var out = '';
    for (var i = start; i < end; i++) {
        out += toHex(this[i]);
    }
    return out;
};


Buffer.prototype.toString = function (encoding, start, end) {
    encoding = String(encoding || 'utf8').toLowerCase();
    start = +start || 0;
    if (typeof end == 'undefined') end = this.length;

    // Fastpath empty strings
    if (+end == start) {
        return '';
    }

    switch (encoding) {
        case 'hex':
            return this.hexSlice(start, end);

        case 'utf8':
        case 'utf-8':
            return this.utf8Slice(start, end);

        case 'ascii':
            return this.asciiSlice(start, end);

        case 'binary':
            return this.binarySlice(start, end);

        case 'base64':
            return this.base64Slice(start, end);

        case 'ucs2':
        case 'ucs-2':
            return this.ucs2Slice(start, end);

        default:
            throw new Error('Unknown encoding');
    }
};


Buffer.prototype.hexWrite = function (string, offset, length) {
    offset = +offset || 0;
    var remaining = this.length - offset;
    if (!length) {
        length = remaining;
    } else {
        length = +length;
        if (length > remaining) {
            length = remaining;
        }
    }

    // must be an even number of digits
    var strLen = string.length;
    if (strLen % 2) {
        throw new Error('Invalid hex string');
    }
    if (length > strLen / 2) {
        length = strLen / 2;
    }
    for (var i = 0; i < length; i++) {
        var b = parseInt(string.substr(i * 2, 2), 16);
        if (isNaN(b)) throw new Error('Invalid hex string');
        this[offset + i] = b;
    }
    Buffer._charsWritten = i * 2;
    return i;
};


Buffer.prototype.write = function (string, offset, length, encoding) {
    // Support both (string, offset, length, encoding)
    // and the legacy (string, encoding, offset, length)
    if (isFinite(offset)) {
        if (!isFinite(length)) {
            encoding = length;
            length = undefined;
        }
    } else {  // legacy
        var swap = encoding;
        encoding = offset;
        offset = length;
        length = swap;
    }

    offset = +offset || 0;
    var remaining = this.length - offset;
    if (!length) {
        length = remaining;
    } else {
        length = +length;
        if (length > remaining) {
            length = remaining;
        }
    }
    encoding = String(encoding || 'utf8').toLowerCase();

    switch (encoding) {
        case 'hex':
            return this.hexWrite(string, offset, length);

        case 'utf8':
        case 'utf-8':
            return this.utf8Write(string, offset, length);

        case 'ascii':
            return this.asciiWrite(string, offset, length);

        case 'binary':
            return this.binaryWrite(string, offset, length);

        case 'base64':
            return this.base64Write(string, offset, length);

        case 'ucs2':
        case 'ucs-2':
            return this.ucs2Write(string, offset, length);

        default:
            throw new Error('Unknown encoding');
    }
};

// slice(start, end)
function clamp(index, len, defaultValue) {
    if (typeof index !== 'number') return defaultValue;
    index = ~~index;  // Coerce to integer.
    if (index >= len) return len;
    if (index >= 0) return index;
    index += len;
    if (index >= 0) return index;
    return 0;
}

Buffer.prototype.slice = function (start, end) {
    var len = this.length;
    start = clamp(start, len, 0);
    end = clamp(end, len, len);
    return new Buffer(this, end - start, +start);
};

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
    var source = this;
    start || (start = 0);
    if (end === undefined || isNaN(end)) {
        end = this.length;
    }
    target_start || (target_start = 0);

    if (end < start) throw new Error('sourceEnd < sourceStart');

    // Copy 0 bytes; we're done
    if (end === start) return 0;
    if (target.length == 0 || source.length == 0) return 0;

    if (target_start < 0 || target_start >= target.length) {
        throw new Error('targetStart out of bounds');
    }

    if (start < 0 || start >= source.length) {
        throw new Error('sourceStart out of bounds');
    }

    if (end < 0 || end > source.length) {
        throw new Error('sourceEnd out of bounds');
    }

    // Are we oob?
    if (end > this.length) {
        end = this.length;
    }

    if (target.length - target_start < end - start) {
        end = target.length - target_start + start;
    }

    var temp = [];
    for (var i = start; i < end; i++) {
        assert.ok(typeof this[i] !== 'undefined', "copying undefined buffer bytes!");
        temp.push(this[i]);
    }

    for (var i = target_start; i < target_start + temp.length; i++) {
        target[i] = temp[i - target_start];
    }
};

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill(value, start, end) {
    value || (value = 0);
    start || (start = 0);
    end || (end = this.length);

    if (typeof value === 'string') {
        value = value.charCodeAt(0);
    }
    if (!(typeof value === 'number') || isNaN(value)) {
        throw new Error('value is not a number');
    }

    if (end < start) throw new Error('end < start');

    // Fill 0 bytes; we're done
    if (end === start) return 0;
    if (this.length == 0) return 0;

    if (start < 0 || start >= this.length) {
        throw new Error('start out of bounds');
    }

    if (end < 0 || end > this.length) {
        throw new Error('end out of bounds');
    }

    for (var i = start; i < end; i++) {
        this[i] = value;
    }
}

// Static methods
Buffer.isBuffer = function isBuffer(b) {
    return b instanceof Buffer;
};

Buffer.concat = function (list, totalLength) {
    if (!isArray(list)) {
        throw new Error("Usage: Buffer.concat(list, [totalLength])\n \
      list should be an Array.");
    }

    if (list.length === 0) {
        return new Buffer(0);
    } else if (list.length === 1) {
        return list[0];
    }

    if (typeof totalLength !== 'number') {
        totalLength = 0;
        for (var i = 0; i < list.length; i++) {
            var buf = list[i];
            totalLength += buf.length;
        }
    }

    var buffer = new Buffer(totalLength);
    var pos = 0;
    for (var i = 0; i < list.length; i++) {
        var buf = list[i];
        buf.copy(buffer, pos);
        pos += buf.length;
    }
    return buffer;
};

Buffer.isEncoding = function (encoding) {
    switch ((encoding + '').toLowerCase()) {
        case 'hex':
        case 'utf8':
        case 'utf-8':
        case 'ascii':
        case 'binary':
        case 'base64':
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
        case 'raw':
            return true;

        default:
            return false;
    }
};

// helpers

function coerce(length) {
    // Coerce length to a number (possibly NaN), round up
    // in case it's fractional (e.g. 123.456) then do a
    // double negate to coerce a NaN to 0. Easy, right?
    length = ~~Math.ceil(+length);
    return length < 0 ? 0 : length;
}

function isArray(subject) {
    return (Array.isArray ||
    function (subject) {
        return {}.toString.apply(subject) == '[object Array]'
    })
    (subject)
}

function isArrayIsh(subject) {
    return isArray(subject) || Buffer.isBuffer(subject) ||
        subject && typeof subject === 'object' &&
        typeof subject.length === 'number';
}

function toHex(n) {
    if (n < 16) return '0' + n.toString(16);
    return n.toString(16);
}

function utf8ToBytes(str) {
    var byteArray = [];
    for (var i = 0; i < str.length; i++)
        if (str.charCodeAt(i) <= 0x7F)
            byteArray.push(str.charCodeAt(i));
        else {
            var h = encodeURIComponent(str.charAt(i)).substr(1).split('%');
            for (var j = 0; j < h.length; j++)
                byteArray.push(parseInt(h[j], 16));
        }

    return byteArray;
}

function asciiToBytes(str) {
    var byteArray = []
    for (var i = 0; i < str.length; i++)
        // Node's code seems to be doing this and not & 0x7F..
        byteArray.push(str.charCodeAt(i) & 0xFF);

    return byteArray;
}

function blitBuffer(src, dst, offset, length) {
    var pos, i = 0;
    while (i < length) {
        if ((i + offset >= dst.length) || (i >= src.length))
            break;

        dst[i + offset] = src[i];
        i++;
    }
    return i;
}

function decodeUtf8Char(str) {
    try {
        return decodeURIComponent(str);
    } catch (err) {
        return String.fromCharCode(0xFFFD); // UTF 8 invalid char
    }
}

// read/write bit-twiddling

Buffer.prototype.readUInt8 = function (offset, noAssert) {
    var buffer = this;

    if (!noAssert) {
        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset < buffer.length,
            'Trying to read beyond buffer length');
    }

    if (offset >= buffer.length) return;

    return buffer[offset];
};

function readUInt16(buffer, offset, isBigEndian, noAssert) {
    var val = 0;


    if (!noAssert) {
        assert.ok(typeof (isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 1 < buffer.length,
            'Trying to read beyond buffer length');
    }

    if (offset >= buffer.length) return 0;

    if (isBigEndian) {
        val = buffer[offset] << 8;
        if (offset + 1 < buffer.length) {
            val |= buffer[offset + 1];
        }
    } else {
        val = buffer[offset];
        if (offset + 1 < buffer.length) {
            val |= buffer[offset + 1] << 8;
        }
    }

    return val;
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
    return readUInt16(this, offset, false, noAssert);
};

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
    return readUInt16(this, offset, true, noAssert);
};

function readUInt32(buffer, offset, isBigEndian, noAssert) {
    var val = 0;

    if (!noAssert) {
        assert.ok(typeof (isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 3 < buffer.length,
            'Trying to read beyond buffer length');
    }

    if (offset >= buffer.length) return 0;

    if (isBigEndian) {
        if (offset + 1 < buffer.length)
            val = buffer[offset + 1] << 16;
        if (offset + 2 < buffer.length)
            val |= buffer[offset + 2] << 8;
        if (offset + 3 < buffer.length)
            val |= buffer[offset + 3];
        val = val + (buffer[offset] << 24 >>> 0);
    } else {
        if (offset + 2 < buffer.length)
            val = buffer[offset + 2] << 16;
        if (offset + 1 < buffer.length)
            val |= buffer[offset + 1] << 8;
        val |= buffer[offset];
        if (offset + 3 < buffer.length)
            val = val + (buffer[offset + 3] << 24 >>> 0);
    }

    return val;
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
    return readUInt32(this, offset, false, noAssert);
};

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
    return readUInt32(this, offset, true, noAssert);
};

Buffer.prototype.readInt8 = function (offset, noAssert) {
    var buffer = this;
    var neg;

    if (!noAssert) {
        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset < buffer.length,
            'Trying to read beyond buffer length');
    }

    if (offset >= buffer.length) return;

    neg = buffer[offset] & 0x80;
    if (!neg) {
        return (buffer[offset]);
    }

    return ((0xff - buffer[offset] + 1) * -1);
};

function readInt16(buffer, offset, isBigEndian, noAssert) {
    var neg, val;

    if (!noAssert) {
        assert.ok(typeof (isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 1 < buffer.length,
            'Trying to read beyond buffer length');
    }

    val = readUInt16(buffer, offset, isBigEndian, noAssert);
    neg = val & 0x8000;
    if (!neg) {
        return val;
    }

    return (0xffff - val + 1) * -1;
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
    return readInt16(this, offset, false, noAssert);
};

Buffer.prototype.readInt16BE = function (offset, noAssert) {
    return readInt16(this, offset, true, noAssert);
};

function readInt32(buffer, offset, isBigEndian, noAssert) {
    var neg, val;

    if (!noAssert) {
        assert.ok(typeof (isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 3 < buffer.length,
            'Trying to read beyond buffer length');
    }

    val = readUInt32(buffer, offset, isBigEndian, noAssert);
    neg = val & 0x80000000;
    if (!neg) {
        return (val);
    }

    return (0xffffffff - val + 1) * -1;
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
    return readInt32(this, offset, false, noAssert);
};

Buffer.prototype.readInt32BE = function (offset, noAssert) {
    return readInt32(this, offset, true, noAssert);
};

Buffer.prototype.readFloatLE = function (offset, noAssert) {
    return readFloat(this, offset, false, noAssert);
};

Buffer.prototype.readFloatBE = function (offset, noAssert) {
    return readFloat(this, offset, true, noAssert);
};

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
    return readDouble(this, offset, false, noAssert);
};

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
    return readDouble(this, offset, true, noAssert);
};

function verifuint(value, max) {
    assert.ok(typeof (value) == 'number',
        'cannot write a non-number as a number');

    assert.ok(value >= 0,
        'specified a negative value for writing an unsigned value');

    assert.ok(value <= max, 'value is larger than maximum value for type');

    assert.ok(Math.floor(value) === value, 'value has a fractional component');
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
    var buffer = this;

    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset < buffer.length,
            'trying to write beyond buffer length');

        verifuint(value, 0xff);
    }

    if (offset < buffer.length) {
        buffer[offset] = value;
    }
};

function writeUInt16(buffer, value, offset, isBigEndian, noAssert) {
    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(typeof (isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 1 < buffer.length,
            'trying to write beyond buffer length');

        verifuint(value, 0xffff);
    }

    for (var i = 0; i < Math.min(buffer.length - offset, 2); i++) {
        buffer[offset + i] =
            (value & (0xff << (8 * (isBigEndian ? 1 - i : i)))) >>>
            (isBigEndian ? 1 - i : i) * 8;
    }

}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
    writeUInt16(this, value, offset, false, noAssert);
};

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
    writeUInt16(this, value, offset, true, noAssert);
};

function writeUInt32(buffer, value, offset, isBigEndian, noAssert) {
    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(typeof (isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 3 < buffer.length,
            'trying to write beyond buffer length');

        verifuint(value, 0xffffffff);
    }

    for (var i = 0; i < Math.min(buffer.length - offset, 4); i++) {
        buffer[offset + i] =
            (value >>> (isBigEndian ? 3 - i : i) * 8) & 0xff;
    }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
    writeUInt32(this, value, offset, false, noAssert);
};

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
    writeUInt32(this, value, offset, true, noAssert);
};

function verifsint(value, max, min) {
    assert.ok(typeof (value) == 'number',
        'cannot write a non-number as a number');

    assert.ok(value <= max, 'value larger than maximum allowed value');

    assert.ok(value >= min, 'value smaller than minimum allowed value');

    assert.ok(Math.floor(value) === value, 'value has a fractional component');
}

function verifIEEE754(value, max, min) {
    assert.ok(typeof (value) == 'number',
        'cannot write a non-number as a number');

    assert.ok(value <= max, 'value larger than maximum allowed value');

    assert.ok(value >= min, 'value smaller than minimum allowed value');
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
    var buffer = this;

    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset < buffer.length,
            'Trying to write beyond buffer length');

        verifsint(value, 0x7f, -0x80);
    }

    if (value >= 0) {
        buffer.writeUInt8(value, offset, noAssert);
    } else {
        buffer.writeUInt8(0xff + value + 1, offset, noAssert);
    }
};

function writeInt16(buffer, value, offset, isBigEndian, noAssert) {
    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(typeof (isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 1 < buffer.length,
            'Trying to write beyond buffer length');

        verifsint(value, 0x7fff, -0x8000);
    }

    if (value >= 0) {
        writeUInt16(buffer, value, offset, isBigEndian, noAssert);
    } else {
        writeUInt16(buffer, 0xffff + value + 1, offset, isBigEndian, noAssert);
    }
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
    writeInt16(this, value, offset, false, noAssert);
};

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
    writeInt16(this, value, offset, true, noAssert);
};

function writeInt32(buffer, value, offset, isBigEndian, noAssert) {
    if (!noAssert) {
        assert.ok(value !== undefined && value !== null,
            'missing value');

        assert.ok(typeof (isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 3 < buffer.length,
            'Trying to write beyond buffer length');

        verifsint(value, 0x7fffffff, -0x80000000);
    }

    if (value >= 0) {
        writeUInt32(buffer, value, offset, isBigEndian, noAssert);
    } else {
        writeUInt32(buffer, 0xffffffff + value + 1, offset, isBigEndian, noAssert);
    }
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
    writeInt32(this, value, offset, false, noAssert);
};

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
    writeInt32(this, value, offset, true, noAssert);
};

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
    writeFloat(this, value, offset, false, noAssert);
};

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
    writeFloat(this, value, offset, true, noAssert);
};

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
    writeDouble(this, value, offset, false, noAssert);
};

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
    writeDouble(this, value, offset, true, noAssert);
};

var MQTTClient = function (host, port, options) {
    if (isNaN(port))
        port = 1883;
    if (!options)
        options = {
            username: undefined,
            password: undefined,
            will_flag: undefined,
            will_retain: undefined,
            will_message: undefined,
            will_topic: undefined
        };
    if (typeof options.client_id == 'undefined')
        options.client_id = 'a' + new Date().getTime() + parseInt(Math.random() * 1000);
    if (isNaN(options.alive_timer) || options.alive_timer < 1)
        options.alive_timer = 30;
    options.ping_timer = parseInt(options.alive_timer * 0.6 * 1000);
    if (typeof options.username == 'string' && options.username.length > 12)
        throw Error('user names are kept to 12 characters or fewer');
    if (typeof options.password == 'string' && options.password.length > 12)
        throw Error('passwords are kept to 12 characters or fewer');
    if (options.will_flag && (typeof options.will_topic != 'string' || typeof options.will_message != 'string'))
        throw Error('missing will_topic or will_message when will_flag is set');

    this.host = host;
    this.port = port;
    this.options = options;
    this.connected = false;
    this._message_callback = {};
    this._last_message_id = 0;
    this._subscriptionCallbacks = {};
    this._errorCallback = undefined;
    this._connectionCallback = undefined;
    this._disconnectCallback = undefined;
};

MQTTClient.CONNECT = 1;
MQTTClient.CONNACK = 2;
MQTTClient.PUBLISH = 3;
MQTTClient.PUBACK = 4;
MQTTClient.PUBREC = 5;
MQTTClient.PUBREL = 6;
MQTTClient.PUBCOMP = 7;
MQTTClient.SUBSCRIBE = 8;
MQTTClient.SUBACK = 9;
MQTTClient.UNSUBSCRIBE = 10;
MQTTClient.UNSUBACK = 11;
MQTTClient.PINGREQ = 12;
MQTTClient.PINGRESP = 13;
MQTTClient.DISCONNECT = 14;

MQTTClient.fixedHeader = function (message_type, dup_flag, qos_level, retain, remaining_length) {
    var la = [];
    var x = remaining_length;
    var d;
    do {
        d = x % 128;
        x = Math.floor(x / 128);
        if (x > 0)
            d = d | 0x80;
        la.push(d);
    } while (x > 0);

    var ret = new Buffer(la.length + 1);
    ret[0] = (message_type << 4) + (dup_flag << 3) + (qos_level << 1) + (retain ? 1 : 0);
    for (var i = 1; i < ret.length; i++)
        ret[i] = la[i - 1];
    return ret;
};

MQTTClient.connect = function () {
    var length = 0;
    for (var i = 0; i < arguments.length; i++)
        length += arguments[i].length;
    var ret = new Buffer(length);

    var cur = 0;
    for (i = 0; i < arguments.length; i++) {
        var l = arguments[i].length;
        arguments[i].copy(ret, cur, 0, l);
        cur += l;
    }
    return ret;
};

MQTTClient.decodeHeader = function (fixed_header) {
    var ret = {};
    var b1 = fixed_header[0];
    ret.message_type = b1 >> 4;
    ret.dup_flag = (b1 >> 3) & 1;
    ret.qos_level = (b1 >> 1) & 3;
    ret.retain = b1 & 1;

    var m = 1;
    var v = 0;
    var i = 1;
    do {
        var d = fixed_header[i++];
        if (typeof d == 'undefined')
            return false;
        v += (d & 127) * m;
        m *= 128;
    } while ((d & 128) != 0);
    ret.remaining_length = v;
    ret.fixed_header_length = i;
    return ret;
};

MQTTClient.connect = function () {
    var length = 0;
    for (var i = 0; i < arguments.length; i++)
        length += arguments[i].length;
    var ret = new Buffer(length);

    var cur = 0;
    for (i = 0; i < arguments.length; i++) {
        var l = arguments[i].length;
        arguments[i].copy(ret, cur, 0, l);
        cur += l;
    }
    return ret;
};

MQTTClient.decodeHeader = function (fixed_header) {
    var ret = {};
    var b1 = fixed_header[0];
    ret.message_type = b1 >> 4;
    ret.dup_flag = (b1 >> 3) & 1;
    ret.qos_level = (b1 >> 1) & 3;
    ret.retain = b1 & 1;

    var m = 1;
    var v = 0;
    var i = 1;
    do {
        var d = fixed_header[i++];
        if (typeof d == 'undefined')
            return false;
        v += (d & 127) * m;
        m *= 128;
    } while ((d & 128) != 0);
    ret.remaining_length = v;
    ret.fixed_header_length = i;
    return ret;
};

MQTTClient.messageHandlers = [];

MQTTClient.messageHandlers[MQTTClient.CONNACK] = function (self, fixed_header, chunk) {
    if (chunk.length < 4)
        self._onError(Error('CONNACK format error'));
    else {
        var code = chunk[3];
        if (code == 0) {
            self.connected = true;
            self._last_message_id = 0;
            setTimeout(function () {
                self.ping();
            }, self.options.ping_timer);
            self._onConnect();
        }
        else if (code > 0 && code < 6) {
            var msg = ['Successed',
                'Connection Refused: unacceptable protocol version',
                'Connection Refused: identifier rejected',
                'Connection Refused: server unavailable',
                'Connection Refused: bad user name or password',
                'Connection Refused: not authorized'
            ];
            self._onError(Error(msg[code]));
            self.connected = false;
        }
        else {
            self._onError(Error('Unknow Error: #' + code));
            self.connected = false;
        }
    }
};

MQTTClient.messageHandlers[MQTTClient.PUBACK] = function (self, fixed_header, chunk) {
    if (chunk.length < 4)
        self._onError(Error('CONNACK format error'));
    else {
        var message_id = (chunk[2] << 8) + chunk[3];
        var callback = self._message_callback[message_id];
        if (typeof callback == 'function') {
            callback(message_id);
            delete self._message_callback[message_id];
        }
    }
};

MQTTClient.messageHandlers[MQTTClient.PUBREC] = function (self, fixed_header, chunk) {
    if (chunk.length < 4)
        self._onError(Error('PUBREC format error'));
    else {
        var pubrel = chunk.slice(0, 4);
        pubrel[0] = 0x62;
        self.connection.write(pubrel);
    }
};

MQTTClient.messageHandlers[MQTTClient.PUBCOMP] = function (self, fixed_header, chunk) {
    if (chunk.length < 4)
        self._onError(Error('PUBCOMP format error'));
    else {
        var message_id = (chunk[2] << 8) + chunk[3];
        var callback = self._message_callback[message_id];
        if (typeof callback == 'function') {
            callback(message_id);
            delete self._message_callback[message_id];
        }
    }
};

MQTTClient.messageHandlers[MQTTClient.SUBACK] = function (self, fixed_header, chunk) {
    if (chunk.length < 5)
        self._onError(Error('SUBACK format error'));
    else {
        var message_id = (chunk[2] << 8) + chunk[3];
        var callback = self._message_callback[message_id];
        if (typeof callback == 'function') {
            var qos_level = chunk[4];
            callback(qos_level);
            delete self._message_callback[message_id];
        }
    }
};

MQTTClient.messageHandlers[MQTTClient.UNSUBACK] = function (self, fixed_header, chunk) {
    if (chunk.length < 4)
        self._onError(Error('UNSUBACK format error'));
    else {
        var message_id = (chunk[2] << 8) + chunk[3];
        var callback = self._message_callback[message_id];
        if (typeof callback == 'function') {
            callback();
            delete self._message_callback[message_id];
        }
    }
};

MQTTClient.messageHandlers[MQTTClient.PINGRESP] = function (self, fixed_header, chunk) {
    if (chunk.length < 2)
        self._onError(Error('PINGRESP format error'));
    else {
        // log('mqtt::PINGRESP');
        self._wait_for_pingresp = false;
        setTimeout(function () {
            self.ping();
        }, self.options.ping_timer);
    }
};

MQTTClient.messageHandlers[MQTTClient.PUBLISH] = function (self, fixed_header, chunk) {
    if (self._data_not_enough) {
        if (self._data_offset + chunk.length >= self._data_length) {
            self._data_not_enough = false;
            MQTTClient.messageHandlers[MQTTClient.PUBLISH](self, fixed_header, MQTTClient.connect(self._data_chunk, chunk));
        }
        else {
            chunk.copy(self._data_chunk, self._data_offset, 0, chunk.length);
            self._data_offset += chunk.length;
        }
    }
    else {
        var data_length = fixed_header.fixed_header_length + fixed_header.remaining_length;
        var payload;
        if (chunk.length >= data_length) {
            var topic_length = (chunk[fixed_header.fixed_header_length] << 8) +
                chunk[fixed_header.fixed_header_length + 1];
            var topic = chunk.slice(fixed_header.fixed_header_length + 2,
                fixed_header.fixed_header_length + 2 + topic_length);
            if (fixed_header.qos_level > 0) {
                var message_id = (chunk[fixed_header.fixed_header_length + 2 + topic_length] << 8) +
                    chunk[fixed_header.fixed_header_length + 3 + topic_length];
                payload = chunk.slice(fixed_header.fixed_header_length + 2 + topic_length + 2,
                    fixed_header.fixed_header_length + fixed_header.remaining_length);
            }
            else {
                message_id = 0;
                payload = chunk.slice(fixed_header.fixed_header_length + 2 + topic_length,
                    fixed_header.fixed_header_length + fixed_header.remaining_length);
            }
            self._onPublish(topic, payload);
            delete self._data_chunk;
            delete self._last_fixed_header;
            if (fixed_header.qos_level > 0)
                self._response(fixed_header.qos_level, message_id);

            if (chunk.length > data_length) {
                self._onData(chunk.slice(
                    fixed_header.fixed_header_length + fixed_header.remaining_length,
                    chunk.length
                ));
            }
        }
        else {
            self._data_not_enough = true;
            self._data_length = data_length;
            self._data_chunk = new Buffer(data_length);
            chunk.copy(self._data_chunk, 0, 0, chunk.length);
            self._data_offset = chunk.length;
            self._last_fixed_header = fixed_header;
        }
    }
};

MQTTClient.prototype.connect = function (callback) {
    var self = this;
    this._connectionCallback = callback;

    var connection = new sockets.tcp();

    connection.onrecv = function (chunk) {
        self._onData(new Buffer(new Uint8Array(chunk)));
    };

    connection.onclose = function () {
        self._onClose();
    };

    if (connection.connect(self.host, self.port)) {
        self.connection = {};
        self.connection.write = function (buffer) {
            connection.send(buffer.toString('binary'));
        };
        self._startSession();
    } else {
        self.onError('Could not connect to ' + self.host + ':' + self.port);
    }
};

MQTTClient.prototype._startSession = function () {
    var variable_header = new Buffer(12);
    variable_header[0] = 0x00;
    variable_header[1] = 0x06;
    variable_header[2] = 0x4d;	// 'M'
    variable_header[3] = 0x51;	// 'Q'
    variable_header[4] = 0x49;	// 'I'
    variable_header[5] = 0x73;	// 's'
    variable_header[6] = 0x64;	// 'd'
    variable_header[7] = 0x70;	// 'p'
    // Protocol Version Number
    variable_header[8] = 0x03;	// Version
    // Connect Flags
    var opt = this.options;
    variable_header[9] = ((opt.username ? 1 : 0) << 7) +
        ((opt.password ? 1 : 0) << 6) +
        (opt.will_retain << 5) +
        (opt.will_qos << 3) +
        (opt.will_flag << 2) +
        (opt.clean_session << 1);
    // Keep Alive timer
    var timer = this.options.alive_timer;
    variable_header[10] = timer >> 8;
    variable_header[11] = timer & 0xFF;

    // Payload
    // MQTTClient Identifier
    var client_id = new Buffer(this.options.client_id);
    var client_id_length = new Buffer(2);
    client_id_length[0] = client_id.length >> 8;
    client_id_length[1] = client_id.length & 0xFF;
    // Will Topic

    var will_topic, will_topic_length, username, username_length, password, password_length;

    if (opt.will_flag && opt.will_topic) {
        will_topic = new Buffer(opt.will_topic);
        will_topic_length = new Buffer(2);
        will_topic_length[0] = will_topic.length >> 8;
        will_topic_length[1] = will_topic.length & 0xFF;
    }
    else {
        will_topic = new Buffer(0);
        will_topic_length = new Buffer(0);
    }
    // Will Message
    if (opt.will_message && opt.will_message) {
        will_message = new Buffer(opt.will_message);
        will_message_length = new Buffer(2);
        will_message_length[0] = will_message.length >> 8;
        will_message_length[1] = will_message.length & 0xFF;
    }
    else {
        var will_message = new Buffer(0);
        var will_message_length = new Buffer(0);
    }
    // User Name
    if (opt.username) {
        username = new Buffer(opt.username);
        username_length = new Buffer(2);
        username_length[0] = username.length >> 8;
        username_length[1] = username.length & 0xFF;
    }
    else {
        username = new Buffer(0);
        username_length = new Buffer(0);
    }
    // Password
    if (opt.password) {
        password = new Buffer(opt.password);
        password_length = new Buffer(2);
        password_length[0] = password.length >> 8;
        password_length[1] = password.length & 0xFF;
    }
    else {
        password = new Buffer(0);
        password_length = new Buffer(0);
    }
    // Payload
    var payload = MQTTClient.connect(client_id_length, client_id,
        will_topic_length, will_topic,
        will_message_length, will_message,
        username_length, username,
        password_length, password);

    // Fixed Header
    var fixed_header = MQTTClient.fixedHeader(MQTTClient.CONNECT, 0, 0, false, variable_header.length + payload.length);

    var buffer = MQTTClient.connect(fixed_header, variable_header, payload);
    this.connection.write(buffer);
};

MQTTClient.prototype._onEnd = function () {
    this._onClose();
};

MQTTClient.prototype._onTimeout = function () {
    this._onError(Error('Timeout'));
};

MQTTClient.prototype._onError = function (error) {
    if (typeof this._errorCallback == 'function')
        this._errorCallback(error);
};

MQTTClient.prototype._onConnect = function () {
    if (typeof this._connectionCallback == 'function')
        this._connectionCallback();
};

MQTTClient.prototype._onClose = function () {
    if (this._disconnectCallback == 'function')
        this._disconnectCallback();
    this.connected = false;
    delete this.connection;
};

MQTTClient.prototype._onData = function (chunk) {
    if (Buffer.isBuffer(this._fixed_header_chunk)) {
        this._onData(MQTTClient.connect(this._fixed_header_chunk, chunk));
    } else {
        var fixed_header = MQTTClient.decodeHeader(chunk);
        if (fixed_header == false) {
            this._fixed_header_chunk = chunk;
        }
        else {
            var handler = MQTTClient.messageHandlers[fixed_header.message_type];
            if (typeof handler != 'function')
                this._onError(Error('Message type error: ' + fixed_header.message_type));
            else
                handler(this, fixed_header, chunk);
        }
    }
};

MQTTClient.prototype.publish = function (topic, payload, options, callback) {
    if (!this.connected) {
        this._onError(Error('Please connect to server first'));
        return;
    }

    if (!Buffer.isBuffer(topic))
        topic = new Buffer(topic);
    if (!Buffer.isBuffer(payload))
        payload = new Buffer(payload);
    if (!options)
        options = {};

    // Variable header
    // Topic name
    var topic_length = new Buffer(2);
    topic_length[0] = topic.length >> 8;
    topic_length[1] = topic.length & 0xFF;
    var topic_name = MQTTClient.connect(topic_length, topic);
    // Message ID
    var message_id;
    if (options.qos_level > 0) {
        message_id = new Buffer(2);
        this._last_message_id++;
        message_id[0] = this._last_message_id >> 8;
        message_id[1] = this._last_message_id & 0xFF;
    }
    else {
        message_id = new Buffer(0);
    }

    // Fixed header
    var fixed_header = MQTTClient.fixedHeader(MQTTClient.PUBLISH,
        options.dup_flag, options.qos_level, options.retain,
        topic_name.length + message_id.length + payload.length);

    var buffer = MQTTClient.connect(fixed_header, topic_name, message_id, payload);
    this.connection.write(buffer);

    if (options.qos_level > 0 && typeof callback == 'function')
        this._message_callback[this._last_message_id] = callback;
};

MQTTClient.prototype.subscribe = function (topic, options, callback) {
    if (!this.connected) {
        this._onError(Error('Please connect to server first'));
        return;
    }

    if (!Buffer.isBuffer(topic))
        topic = new Buffer(topic);
    if (!options)
        options = {};

    // Variable header
    // Message Identifier
    var message_id = new Buffer(2);
    this._last_message_id++;
    message_id[0] = this._last_message_id >> 8;
    message_id[1] = this._last_message_id & 0xFF;
    // Payload
    var topic_length = new Buffer(2);
    topic_length[0] = topic.length >> 8;
    topic_length[1] = topic.length & 0xFF;
    var requested_qos = new Buffer(1);
    requested_qos[0] = options.qos_level & 0x03;
    var payload = MQTTClient.connect(topic_length, topic, requested_qos);
    // Fixed Header
    var fixed_header = MQTTClient.fixedHeader(MQTTClient.SUBSCRIBE, options.dup_flag, 1, 0,
        message_id.length + payload.length);

    var buffer = MQTTClient.connect(fixed_header, message_id, payload);
    // debug(buffer);
    this.connection.write(buffer);

    if (typeof callback == 'function')
        this._subscriptionCallbacks[topic] = callback;
};

MQTTClient.prototype.ping = function () {
    var self = this;
    if (!this.connected) {
        this._onError(Error('Please connect to server first'));
        return;
    }

    var buffer = new Buffer(2);
    buffer[0] = MQTTClient.PINGREQ << 4;
    buffer[1] = 0x00;

    this._wait_for_pingresp = true;
    setTimeout(function () {
        if (self._wait_for_pingresp)
            self._onTimeout();
    }, this.options.alive_timer * 1000);

    this.connection.write(buffer);
};

MQTTClient.prototype._onPublish = function (topic, payload) {
    var topicStr = topic.toString();
    for (var subscriptionTopic in this._subscriptionCallbacks) {
        if (subscriptionTopic == topic) {
            this._subscriptionCallbacks[subscriptionTopic](topic, payload.toString());
        }
        if (subscriptionTopic.indexOf('#') > 0
            && topicStr.indexOf(subscriptionTopic.substr(0, subscriptionTopic.length - 1)) == 0) {
            this._subscriptionCallbacks[subscriptionTopic](topic, payload.toString());
        }
    }
};

MQTTClient.prototype._response = function (qos_level, message_id) {
    var buffer = new Buffer(4);
    if (qos_level == 1)
        buffer[0] = MQTTClient.PUBACK << 4;
    else
        buffer[0] = MQTTClient.PUBREC << 4;
    buffer[1] = qos_level << 1;
    buffer[2] = message_id >> 8;
    buffer[3] = message_id & 0xFF;

    this.connection.write(buffer);
};

MQTTClient.prototype.onError = function (callback) {
    this._errorCallback = callback;
};

MQTTClient.prototype.onDisconnect = function (callback) {
    this._disconnectCallback = callback;
};

function MQTT(id, controller) {
    MQTT.super_.call(this, id, controller);
}

inherits(MQTT, AutomationModule);

_module = MQTT;

MQTT.prototype.init = function (config) {
    MQTT.super_.prototype.init.call(this, config);

    var self = this;

    this.log = function (message) {
        console.log('MQTT: ' + message);
    };

    this.findRoom = function (id) {
        var locations = self.controller.locations;
        if (locations) {
            for (var i = 0; i < locations.length; i++) {
                if (locations[i].id == id) {
                    return locations[i];
                }
            }
        }
        return null;
    };

    this.createTopic = function (device) {
        var room = self.findRoom(device.get('location'));
        var topic = self.config.topic_prefix;
        topic += '/';
        topic += room.title;
        topic += '/';
        topic += device.get('metrics:title');
        return topic;
    };

    this.deviceUpdate = function (device) {
        if (self.mqttClient && self.mqttClient.connected) {
            var topic = self.createTopic(device);
            var value = device.get('metrics:level');
            self.mqttClient.publish(topic, value.toString().trim());
        }
    };

    this.connect = function () {
        this.mqttClient = new MQTTClient(self.config.host, parseInt(self.config.port), {client_id: config.client_id});
        self.log('Connecting to ' + self.config.host + ':' + self.config.port + '...');
        this.mqttClient.connect(function () {

            self.log('Connected to ' + self.config.host + ':' + self.config.port);

            self.mqttClient.onError(function (error) {
                self.log('Error: ' + error.toString());
            });

            self.mqttClient.onDisconnect(function () {
                self.log('Error: disconnected, will retry to connect...');
                self.connect();
            });

            self.mqttClient.subscribe(self.config.topic_prefix + '/#', {}, function (topic, payload) {
                self.controller.devices.filter(function (device) {
                    var device_topic = self.createTopic(device);
                    return device_topic + '/' + 'set' == topic || device_topic + '/' + 'status' == topic;
                }).map(function (device) {
                    var device_topic = self.createTopic(device);
                    if (topic == device_topic + '/status') {
                        self.deviceUpdate(device);
                    } else {

                        if(device.get('deviceType') === 'switchMultilevel') {
                            if(payload !== 'on' && payload !== 'off') {
                                device.performCommand('exact',{level:payload});
                            } else {
                                device.performCommand(payload);
                            }
                        }
                        else {
                            device.performCommand(payload);
                        }

                    }
                });
            });
        });

    };

    if (!self.config.host || !self.config.port) {
        this.log('Host or port not configured! will not start!')
    } else {
        this.connect();
        this.controller.devices.on('change:metrics:level', self.deviceUpdate);
    }
};

