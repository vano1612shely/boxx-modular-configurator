import type { PlacedPackage } from '@/entities/configuration'
import type { StoredQuoteExterior, StoredQuotePackage } from '@/entities/quote'

/**
 * A saved order's furniture, back in the shape the scene stores it in.
 *
 * Instance ids are minted here because a quote never stored them, and they are
 * positional rather than random so the server and the client agree on them —
 * they are React keys, and a key that differs between the two renders is a
 * remount of every model on the page.
 *
 * `zoneKey` and `zoneName` are deliberately not replayed. The zone a piece
 * stands in is worked out from where it stands, so the position is the record
 * and a stored zone would only be a second opinion about it.
 */
export function replayPlacements(packages: StoredQuotePackage[]): PlacedPackage[] {
  return packages.flatMap((line, index) => {
    // A group was saved as one line carrying its pieces, because it was one
    // purchase. It goes back as the several things it actually is, each where
    // the visitor left it — one table plus its chairs, not a table alone.
    if (line.pieces?.length) {
      return line.pieces.map((piece, pieceIndex) => ({
        instanceId: `order-${index}-${pieceIndex}`,
        // Shared, so the pieces still read as one set. A saved order cannot be
        // edited, but the panel lists what is in the room and counts it.
        groupId: `order-group-${index}`,
        packageId: line.packageId,
        memberKey: piece.memberKey,
        roomKey: line.roomKey,
        x: piece.x,
        z: piece.z,
        rotationYDeg: piece.rotationYDeg,
      }))
    }

    return [
      {
        instanceId: `order-${index}`,
        packageId: line.packageId,
        roomKey: line.roomKey,
        x: line.x,
        z: line.z,
        rotationYDeg: line.rotationYDeg,
      },
    ]
  })
}

/**
 * The exterior picks, keyed by spot the way the store keys them.
 *
 * A spot named twice keeps the later line, which is what the store's own writes
 * do. A spot named not at all keeps its default — that is how an order taken
 * before there were exterior choices renders at all.
 */
export function replayExterior(rows: StoredQuoteExterior[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.slotKey, row.variantKey]))
}
