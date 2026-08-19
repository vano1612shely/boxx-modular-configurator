/**
 * The unguessable half of an order's address.
 *
 * A quote's id is a serial integer, so a link built on one hands whoever holds
 * it the whole sales pipeline by counting. The reference is drawn at random
 * instead: the link is the credential, which is the same bargain a password
 * reset email makes.
 *
 * Crockford's alphabet minus the vowels it keeps — no 0/O, no 1/I/L — because
 * this is a string people read down a phone line and type back in. Twelve
 * characters of a thirty-one letter alphabet is about 59 bits, which is more
 * than enough to make guessing pointless and short enough to fit on a line.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const LENGTH = 12

/** Web Crypto rather than Math.random: this value is the only thing guarding an order. */
function randomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count)
  crypto.getRandomValues(bytes)
  return bytes
}

export function newOrderReference(): string {
  // Rejection sampling, not a modulo: 256 does not divide by 30, so folding the
  // byte would make the first sixteen letters of the alphabet fractionally more
  // likely than the rest. Cheap to do properly, so it is done properly.
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length
  let out = ''

  while (out.length < LENGTH) {
    for (const byte of randomBytes(LENGTH)) {
      if (byte >= limit) continue
      out += ALPHABET[byte % ALPHABET.length]
      if (out.length === LENGTH) break
    }
  }

  return out
}

/**
 * Whether a URL segment looks like one of ours.
 *
 * Used to tell a reference from a quote id before either is looked up, so a
 * malformed segment costs no query at all. It says nothing about whether the
 * order exists — that is the database's answer, not this one's.
 */
export function isOrderReference(value: string): boolean {
  return value.length === LENGTH && [...value].every((char) => ALPHABET.includes(char))
}
