import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import importPlugin from 'eslint-plugin-import'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Module boundary enforcement.
//
// Rules:
//   1. Cross-module imports must go through a module's public index.ts.
//      Importing src/modules/<name>/<deep> from outside src/modules/<name>/
//      is forbidden (zone target = a module's internals).
//   2. shared/ has no top-level barrel — it is imported via deep paths
//      (e.g. @/modules/shared/hooks/use-is-mobile). It is therefore NOT a zone.
//   3. trading/ must not import any venue module.
//   4. Venue modules must not import trading/.
//   5. Files under src/app/ are the composition root and may import any
//      module's public API. The base zone rule still permits this because
//      a public-API import targets the module folder root, which we allow
//      via the `except` glob below.
//   6. Files inside a module may freely import their own internals.
const moduleZone = (name) => ({
  target: `./src/!(modules|app)/**/*`, // unused — see zones array
  from: `./src/modules/${name}`,
})

// We define zones per module: target = "anywhere outside this module",
// from   = "this module's tree",
// except = "this module's public entry (index.ts at the root)".
const zones = [
  {
    target: './src/!(modules)/**/*',
    from: './src/modules/trading',
    except: ['./index.ts', './index.tsx'],
    message:
      'Cross-module deep imports are forbidden. Import from @/modules/trading.',
  },
  {
    target: './src/modules/!(trading)/**/*',
    from: './src/modules/trading',
    except: ['./index.ts', './index.tsx'],
    message:
      'Cross-module deep imports are forbidden. Import from @/modules/trading.',
  },
  {
    target: './src/!(modules)/**/*',
    from: './src/modules/mock-venue',
    except: ['./index.ts', './index.tsx'],
    message:
      'Cross-module deep imports are forbidden. Import from @/modules/mock-venue.',
  },
  {
    target: './src/modules/!(mock-venue)/**/*',
    from: './src/modules/mock-venue',
    except: ['./index.ts', './index.tsx'],
    message:
      'Cross-module deep imports are forbidden. Import from @/modules/mock-venue.',
  },
  {
    target: './src/!(modules)/**/*',
    from: './src/modules/portfolio',
    except: ['./index.ts', './index.tsx'],
    message:
      'Cross-module deep imports are forbidden. Import from @/modules/portfolio.',
  },
  {
    target: './src/modules/!(portfolio)/**/*',
    from: './src/modules/portfolio',
    except: ['./index.ts', './index.tsx'],
    message:
      'Cross-module deep imports are forbidden. Import from @/modules/portfolio.',
  },
  {
    target: './src/!(modules)/**/*',
    from: './src/modules/account',
    except: ['./index.ts', './index.tsx'],
    message:
      'Cross-module deep imports are forbidden. Import from @/modules/account.',
  },
  {
    target: './src/modules/!(account)/**/*',
    from: './src/modules/account',
    except: ['./index.ts', './index.tsx'],
    message:
      'Cross-module deep imports are forbidden. Import from @/modules/account.',
  },
  {
    target: './src/!(modules)/**/*',
    from: './src/modules/hyperliquid',
    except: ['./index.ts', './index.tsx'],
    message:
      'Cross-module deep imports are forbidden. Import from @/modules/hyperliquid.',
  },
  {
    target: './src/modules/!(hyperliquid)/**/*',
    from: './src/modules/hyperliquid',
    except: ['./index.ts', './index.tsx'],
    message:
      'Cross-module deep imports are forbidden. Import from @/modules/hyperliquid.',
  },
  // Hexagonal direction: trading/ never imports a venue module.
  {
    target: './src/modules/trading/**/*',
    from: './src/modules/mock-venue',
    message:
      'trading/ must not import a venue module. Depend on the Adapter port in shared/domain/.',
  },
  // Hexagonal direction: venue modules never import trading/.
  {
    target: './src/modules/mock-venue/**/*',
    from: './src/modules/trading',
    message:
      'Venue modules must not import trading/. Implement the Adapter port from shared/domain/.',
  },
  // Hexagonal direction: portfolio/ never imports a venue module.
  {
    target: './src/modules/portfolio/**/*',
    from: './src/modules/mock-venue',
    message:
      'portfolio/ must not import a venue module. Depend on the Adapter port in shared/domain/.',
  },
  // Hexagonal direction: venue modules never import portfolio/.
  {
    target: './src/modules/mock-venue/**/*',
    from: './src/modules/portfolio',
    message:
      'Venue modules must not import portfolio/. Implement the Adapter port from shared/domain/.',
  },
  // Hexagonal direction: hyperliquid venue never imports trading/ or portfolio/.
  {
    target: './src/modules/hyperliquid/**/*',
    from: './src/modules/trading',
    message:
      'Venue modules must not import trading/. Implement the Adapter port from shared/domain/.',
  },
  {
    target: './src/modules/hyperliquid/**/*',
    from: './src/modules/portfolio',
    message:
      'Venue modules must not import portfolio/. Implement the Adapter port from shared/domain/.',
  },
]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      globals: globals.browser,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.app.json',
        },
        node: true,
      },
    },
    rules: {
      'import/no-restricted-paths': ['error', { zones }],
      // Direct console.* is forbidden in apps/client/src/. Log through the
      // Logger port from `modules/shared/logger/`. The only legal console.*
      // callsite is the console adapter itself; tests may stub `console.*`.
      // See ADR-0011 and apps/client/.claude/rules/logging.md.
      'no-console': 'error',
    },
  },
  // The console adapter is the single legal home for direct `console.*`.
  {
    files: ['src/modules/shared/logger/adapters/console-logger-adapter.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // Tests may spy on `console.*`.
  {
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
  // Single-importer constraint for @nktkas/hyperliquid: only the venue's SDK
  // adapter file may import it. See ADR-0009 (Gateway isolation).
  {
    files: ['**/*.{ts,tsx}'],
    ignores: [
      'src/modules/hyperliquid/gateway/nktkas-hyperliquid-gateway.ts',
      'src/modules/hyperliquid/gateway/nktkas-hyperliquid-exchange-gateway.ts',
      'src/modules/hyperliquid/gateway/sdk-error-mapping.ts',
      'src/modules/hyperliquid/gateway/sdk-types.ts',
      'src/modules/hyperliquid/gateway/__tests__/**',
      'src/modules/hyperliquid/services/__tests__/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@nktkas/hyperliquid',
              message:
                '@nktkas/hyperliquid may only be imported by hyperliquid/gateway/nktkas-hyperliquid-gateway.ts. See ADR-0009.',
            },
          ],
          patterns: [
            {
              group: ['@nktkas/hyperliquid/*'],
              message:
                '@nktkas/hyperliquid may only be imported by hyperliquid/gateway/nktkas-hyperliquid-gateway.ts. See ADR-0009.',
            },
          ],
        },
      ],
    },
  },
  // File-kind discipline in *.tsx files (flipped to error in Phase 5).
  // Type/interface declarations belong in *.types.ts, module-scope
  // non-component functions belong in *.utils.ts.
  {
    files: ['**/*.tsx'],
    ignores: ['**/*.test.tsx', '**/__tests__/**', '**/__fixtures__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Program > TSTypeAliasDeclaration",
          message:
            'Named type aliases belong in *.types.ts, not in a *.tsx file. Move this declaration to a sibling *.types.ts.',
        },
        {
          selector: "Program > ExportNamedDeclaration > TSTypeAliasDeclaration",
          message:
            'Named type aliases belong in *.types.ts, not in a *.tsx file. Move this declaration to a sibling *.types.ts.',
        },
        {
          selector: "Program > TSInterfaceDeclaration",
          message:
            'Interface declarations belong in *.types.ts, not in a *.tsx file. Move this declaration to a sibling *.types.ts.',
        },
        {
          selector: "Program > ExportNamedDeclaration > TSInterfaceDeclaration",
          message:
            'Interface declarations belong in *.types.ts, not in a *.tsx file. Move this declaration to a sibling *.types.ts.',
        },
        {
          // Module-scope `function foo()` / `export function foo()` whose name
          // is not PascalCase — i.e. not a React component. Component
          // declarations (PascalCase) are allowed; everything else is a util.
          selector:
            "Program > FunctionDeclaration[id.name=/^[a-z_]/], Program > ExportNamedDeclaration > FunctionDeclaration[id.name=/^[a-z_]/]",
          message:
            'Module-scope non-component functions belong in *.utils.ts, not in a *.tsx file. Move this function to a sibling *.utils.ts.',
        },
        {
          // Module-scope `const foo = () => …` / `const foo = function …` arrow/function expressions
          // whose name is not PascalCase. Catches the common arrow-function helper case.
          selector:
            "Program > VariableDeclaration > VariableDeclarator[id.name=/^[a-z_]/][init.type=/ArrowFunctionExpression|FunctionExpression/], Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name=/^[a-z_]/][init.type=/ArrowFunctionExpression|FunctionExpression/]",
          message:
            'Module-scope non-component functions belong in *.utils.ts, not in a *.tsx file. Move this function to a sibling *.utils.ts.',
        },
      ],
    },
  },
  // Test files must live in a __tests__/ folder sibling to the file under
  // test. See .claude/rules/testing.md.
  {
    files: ['**/*.test.{ts,tsx}'],
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message:
            'Test files must live in a __tests__/ folder sibling to the file under test. See .claude/rules/testing.md.',
        },
      ],
    },
  },
])
