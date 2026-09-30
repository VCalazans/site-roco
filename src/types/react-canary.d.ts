// Tipos do canal canary do React (`<ViewTransition>`, `addTransitionType`).
//
// O App Router do Next 16 empacota o React canary (ver
// `node_modules/next/dist/compiled/react`, que exporta `ViewTransition`), mas o
// `@types/react` estável não declara esses exports — sem esta referência o
// `import { ViewTransition } from "react"` não compila. Doc local:
// `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`.
/// <reference types="react/canary" />
