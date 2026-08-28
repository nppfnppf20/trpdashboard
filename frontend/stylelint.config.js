/**
 * Non-blocking color-token lint. Flags literal hex/rgb(a) colors outside
 * the token source of truth (src/app.css's :root) so the CSS centralization
 * migration (see the plan doc) has a burn-down list. Not wired into
 * build/CI yet — run manually via `npm run lint:css`.
 */
export default {
  overrides: [
    {
      files: ['**/*.svelte'],
      customSyntax: 'postcss-html',
    },
  ],
  ignoreFiles: [
    'src/lib/styles/trpformatting.css',
  ],
  rules: {
    'color-no-hex': true,
    'function-disallowed-list': ['rgb', 'rgba'],
  },
};
