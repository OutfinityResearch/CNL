const ZERO = 0n;
const ONE = 1n;

function maskForSize(size) {
  if (size <= 0) return ZERO;
  return (ONE << BigInt(size)) - ONE;
}

export class BigIntBitset {
  constructor(size, bits = ZERO) {
    this.size = size;
    this.bits = bits;
  }

  resize(size) {
    if (size > this.size) {
      this.size = size;
    }
    return this;
  }

  clone() {
    return new BigIntBitset(this.size, this.bits);
  }

  isEmpty() {
    return this.bits === ZERO;
  }

  hasBit(index) {
    this.#assertIndex(index);
    return ((this.bits >> BigInt(index)) & ONE) === ONE;
  }

  setBit(index) {
    this.#assertIndex(index);
    this.bits |= ONE << BigInt(index);
    return this;
  }

  clearBit(index) {
    this.#assertIndex(index);
    this.bits &= ~(ONE << BigInt(index));
    return this;
  }

  and(other) {
    const size = Math.max(this.size, other.size);
    return new BigIntBitset(size, this.bits & other.bits);
  }

  or(other) {
    const size = Math.max(this.size, other.size);
    return new BigIntBitset(size, this.bits | other.bits);
  }

  andNot(other) {
    const mask = maskForSize(this.size);
    return new BigIntBitset(this.size, this.bits & (mask ^ other.bits));
  }

  intersects(other) {
    return (this.bits & other.bits) !== ZERO;
  }

  popcount() {
    let value = this.bits;
    let count = 0;
    while (value) {
      value &= value - ONE;
      count += 1;
    }
    return count;
  }

  iterateSetBits(fn) {
    let value = this.bits;
    let index = 0;
    while (value) {
      if ((value & ONE) === ONE) {
        fn(index);
      }
      value >>= ONE;
      index += 1;
    }
  }

  #assertIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new RangeError(`Bitset index out of range: ${index}`);
    }
  }
}

export function createBitset(size) {
  return new BigIntBitset(size, ZERO);
}

export function createFullBitset(size) {
  return new BigIntBitset(size, maskForSize(size));
}
