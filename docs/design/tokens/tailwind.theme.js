// Only use this if the codebase already uses Tailwind CSS.
// Merge into theme.extend in tailwind.config.js (v3), or translate to @theme in CSS (v4).
// Values reference the CSS variables in tokens.css so there is one source of truth.

module.exports = {
  theme: {
    extend: {
      colors: {
        cm: {
          lime: 'var(--cm-lime)',
          black: 'var(--cm-black)',
          white: 'var(--cm-white)',
          paper: 'var(--cm-paper)',
          rule: 'var(--cm-rule)',
          'rule-dark': 'var(--cm-rule-dark)',
          meta: 'var(--cm-meta)',
          'meta-dark': 'var(--cm-meta-on-dark)',
          ink: 'var(--cm-ink-soft)',
        },
      },
      fontFamily: {
        serif: ['var(--cm-font-serif)'],
        sans: ['var(--cm-font-sans)'],
      },
      maxWidth: { container: 'var(--cm-container)' },
      borderRadius: { none: '0' },
      screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px' },
    },
  },
};
