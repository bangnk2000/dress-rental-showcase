// Shared Tailwind (Play CDN) config for the responsive prototypes.
// Values = DESIGN.md frontmatter, radius scale = OURS (globals.css), not Stitch's.
// Reference-only — never imported by src/.
tailwind.config = {
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        surface: '#fcf9f6', 'surface-dim': '#dcdad7', 'surface-bright': '#fcf9f6',
        'surface-container-lowest': '#ffffff', 'surface-container-low': '#f6f3f0',
        'surface-container': '#f0edea', 'surface-container-high': '#eae8e5',
        'surface-container-highest': '#e5e2df',
        'on-surface': '#1b1c1a', 'on-surface-variant': '#524345',
        outline: '#847374', 'outline-variant': '#d6c2c3',
        primary: '#6e3841', 'on-primary': '#ffffff',
        'primary-container': '#8a4f58', 'on-primary-container': '#ffd0d5',
        'primary-fixed': '#ffd9dd', 'on-primary-fixed': '#370c15', 'on-primary-fixed-variant': '#6c363f',
        secondary: '#7c5453', 'secondary-container': '#ffcbc8', 'on-secondary-container': '#7b5352',
        'secondary-fixed': '#ffdad8', 'on-secondary-fixed': '#2f1313',
        tertiary: '#5a4525', 'tertiary-fixed': '#fedeb2', 'on-tertiary-fixed': '#281800',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['56px', { lineHeight: '64px', letterSpacing: '-0.02em', fontWeight: '400' }],
        'display-lg-mobile': ['38px', { lineHeight: '46px', letterSpacing: '-0.01em', fontWeight: '400' }],
        'headline-lg': ['40px', { lineHeight: '48px', letterSpacing: '-0.01em', fontWeight: '400' }],
        'headline-lg-mobile': ['30px', { lineHeight: '38px', fontWeight: '400' }],
        'headline-md': ['28px', { lineHeight: '36px', fontWeight: '500' }],
        'headline-sm': ['22px', { lineHeight: '30px', fontWeight: '600' }],
        'title-md': ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '26px' }],
        'body-md': ['14px', { lineHeight: '22px' }],
        'body-sm': ['12px', { lineHeight: '18px' }],
        'label-lg': ['13px', { lineHeight: '18px', letterSpacing: '0.06em', fontWeight: '600' }],
        'label-sm': ['11px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '500' }],
      },
      borderRadius: { sm: '0.25rem', DEFAULT: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem' },
      spacing: {
        gutter: '1.25rem', 'gutter-mobile': '0.75rem', margin: '3rem', 'margin-mobile': '1.25rem',
        'space-xs': '0.375rem', 'space-sm': '0.75rem', 'space-md': '1.25rem',
        'space-lg': '2rem', 'space-xl': '3.5rem',
      },
      maxWidth: { page: '1296px', measure: '36rem' },
      aspectRatio: { portrait: '4 / 5', dress: '3 / 4', photo: '3 / 2' },
      boxShadow: { ambient: '0 12px 36px -4px rgba(138, 79, 88, 0.07)' },
    },
  },
};
