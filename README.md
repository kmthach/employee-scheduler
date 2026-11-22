# React + TypeScript + Vite + shadcn/ui

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```

## Auto-scheduling and cross-origin isolation

Auto-schedule runs the OR-Tools CP-SAT solver (`cp-sat-wasm`) in a web worker, which needs
`SharedArrayBuffer`, so the page must be cross-origin isolated. Vite sends the required headers
in `dev` and `preview`. **A production host must send them too**:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Hosts that cannot set headers (e.g. GitHub Pages) cannot run Auto-schedule; the app then shows an
error and the rest of the roster keeps working. All fonts and assets are self-hosted, so COEP does
not block anything.
