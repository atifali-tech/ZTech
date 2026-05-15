<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:turbopack-rules -->
# Turbopack HMR rules — MANDATORY, non-negotiable

This project uses Turbopack (Next.js dev bundler). Turbopack's HMR is stricter than webpack.
Violating any rule below causes a **runtime crash**: `adapterFn is not a function`.

## Rule 1 — Every component that uses hooks must live in its own file

WRONG — hooks inside a shared file:
```jsx
// FilterBar.jsx
function CityDropdown() {           // ← has useState, useEffect, useRef
  const [open, setOpen] = useState(false);
  ...
}
export default function FilterBar() { ... }
```

RIGHT — move it to its own file:
```jsx
// CityDropdown.jsx         ← own file, own 'use client'
'use client';
import { useState, useEffect, useRef } from 'react';
export default function CityDropdown() { ... }

// FilterBar.jsx
import CityDropdown from './CityDropdown';
export default function FilterBar() { ... }
```

This applies to every sub-component that calls any React hook. No exceptions.

## Rule 2 — Never use useCallback with async functions

WRONG:
```jsx
const fetchData = useCallback(async () => { ... }, []);
```

RIGHT — store async functions in a useRef:
```jsx
const fetchRef = useRef(null);
fetchRef.current = async () => { ... };
// call it: fetchRef.current?.()
```

## Rule 3 — 'use client' required on every component file

Every `.jsx` file in `src/components/` must start with `'use client';` on line 1.
<!-- END:turbopack-rules -->
