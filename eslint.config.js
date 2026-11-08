// ESLint (config plate). Règle d'imports : les modules sont numérotés par couche (00 à 14).
// Un module ne doit importer que des modules de numéro inférieur ou égal ; les références vers le haut passent
// par le registre tardif (00_registry.js). `npm run lint` échoue si un import remonte la hiérarchie.
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import fs from 'node:fs';

const mods = fs.readdirSync(new URL('./js/', import.meta.url)).filter(f => /^\d\d_.*\.js$/.test(f)).sort();
const zones = [];
mods.forEach((m, i) => {
  const higher = mods.slice(i + 1);
  if (higher.length) zones.push({ target: `./js/${m}`, from: higher.map(h => `./js/${h}`), message: `${m} ne doit pas importer un module de couche supérieure : utiliser le registre tardif (00_registry.js).` });
});
zones.push({ target: './js/0[0-9]_*.js', from: './js/main.js', message: 'main.js est le point d\'entrée, personne ne l\'importe.' });

export default [
  { ignores: ['vendor/**', 'dist/**', 'node_modules/**'] },
  {
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser, KP: 'writable' } },
    plugins: { import: importPlugin },
    rules: {
      'no-undef': 'error', 'no-redeclare': 'error', 'no-dupe-keys': 'error', 'no-unreachable': 'warn', 'no-const-assign': 'error',
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'import/no-restricted-paths': ['error', { zones }],
      'import/no-cycle': ['error', { maxDepth: 20 }],
      'import/no-unresolved': ['error', { commonjs: false }],
    },
    settings: { 'import/resolver': { node: { extensions: ['.js'] } }, 'import/core-modules': ['three'] },
  },
  { files: ['tools/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser, KP: 'writable' } }, rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }] } },
];
