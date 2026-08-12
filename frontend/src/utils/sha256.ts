/**
 * SHA-256 工具（纯 TypeScript 实现）
 * 移植自原项目 js/supabase.js 中的 sha256() 函数
 * 保留用于客户端兼容场景
 */
export function sha256(str: string): string {
  function rotr(x: number, n: number): number {
    return (x >>> n) | (x << (32 - n))
  }
  function ch(x: number, y: number, z: number): number {
    return (x & y) ^ (~x & z)
  }
  function maj(x: number, y: number, z: number): number {
    return (x & y) ^ (x & z) ^ (y & z)
  }
  function bsig0(x: number): number {
    return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22)
  }
  function bsig1(x: number): number {
    return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25)
  }
  function ssig0(x: number): number {
    return rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)
  }
  function ssig1(x: number): number {
    return rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10)
  }

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]

  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >>> 6))
      bytes.push(0x80 | (code & 0x3f))
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >>> 12))
      bytes.push(0x80 | ((code >>> 6) & 0x3f))
      bytes.push(0x80 | (code & 0x3f))
    } else {
      i++
      const combined = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff))
      bytes.push(0xf0 | (combined >>> 18))
      bytes.push(0x80 | ((combined >>> 12) & 0x3f))
      bytes.push(0x80 | ((combined >>> 6) & 0x3f))
      bytes.push(0x80 | (combined & 0x3f))
    }
  }

  const bitLen = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  for (let j = 7; j >= 0; j--) {
    bytes.push(Math.floor(bitLen / Math.pow(2, j * 8)) & 0xff)
  }

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]

  for (let b = 0; b < bytes.length; b += 64) {
    const W = new Array(64)
    let t: number
    for (t = 0; t < 16; t++) {
      W[t] =
        (bytes[b + t * 4] << 24) |
        (bytes[b + t * 4 + 1] << 16) |
        (bytes[b + t * 4 + 2] << 8) |
        bytes[b + t * 4 + 3]
    }
    for (t = 16; t < 64; t++) {
      W[t] = (ssig1(W[t - 2]) + W[t - 7] + ssig0(W[t - 15]) + W[t - 16]) >>> 0
    }

    let [a, bv, c, d, e, f, g, h] = H
    for (t = 0; t < 64; t++) {
      const T1 = (h + bsig1(e) + ch(e, f, g) + K[t] + W[t]) >>> 0
      const T2 = (bsig0(a) + maj(a, bv, c)) >>> 0
      h = g; g = f; f = e; e = (d + T1) >>> 0
      d = c; c = bv; bv = a; a = (T1 + T2) >>> 0
    }

    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + bv) >>> 0
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
  }

  let hex = ''
  for (let k = 0; k < 8; k++) {
    const val = H[k]
    hex += ((val >>> 24) & 0xff).toString(16).padStart(2, '0')
    hex += ((val >>> 16) & 0xff).toString(16).padStart(2, '0')
    hex += ((val >>> 8) & 0xff).toString(16).padStart(2, '0')
    hex += (val & 0xff).toString(16).padStart(2, '0')
  }
  return hex
}
