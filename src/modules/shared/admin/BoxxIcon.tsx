/*
 * The mark alone, for the admin panel's navigation.
 *
 * Path data exported from the client's Figma — file zmxH8gYUekbqxgBCAVeFjk,
 * layer "logo-boxx-modular". Re-export rather than editing it by hand.
 *
 * A cherry bracket-square with a diamond inside it. Figma authors two versions
 * of the lockup, one for light backgrounds and one for dark, and the only
 * difference between them is the ink — so the ink is `currentColor` here, taken
 * from a Payload theme variable, and the one component serves both themes.
 *
 * Sized at 100% like Payload's own icon: the nav sets the box, not the graphic.
 * The viewBox is the mark's own bounds plus a little air, squared off, so it
 * sits centred whatever that box turns out to be.
 */
export function BoxxIcon() {
  return (
    <svg
      viewBox="-3.16 6.087 40.16 40.16"
      role="img"
      aria-label="BOXX Modular"
      width="100%"
      height="100%"
      style={{ color: 'var(--theme-elevation-1000)' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16.8667 43.2467L2.46666 26.1667L16.8667 9.08667L31.2667 26.1667L16.8667 43.2467Z" fill="currentColor" />
      <path d="M2.12 41.0067V11.4333H13.64L15.44 9.31333H-1.93715e-06V43.14H15.4667L13.7467 41.02H2.12V41.0067Z" fill="#98002E" />
      <path d="M18.3067 9.31333L20.1067 11.4333H31.7067V41.0067H20.08L18.24 43.1267H33.84V9.3H18.3333L18.3067 9.31333Z" fill="#98002E" />
    </svg>
  )
}
