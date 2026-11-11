export default defineAppConfig({
  /// Linked from Technical details; the README's Contracts section explains each contract.
  repoUrl: 'https://github.com/microHoffman/commonwell',
  ui: {
    colors: {
      primary: 'forest',
      secondary: 'ochre',
      neutral: 'kraft',
    },
    card: {
      slots: { root: 'rounded-[1.5rem]' },
    },
    // The page is kraft-100, the same as bg-elevated, so default skeletons vanish on it and loading looks blank.
    skeleton: { base: 'bg-accented' },
  },
})
