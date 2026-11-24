import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '../lib/RequireAuth'
export const Route = createFileRoute('/viva')({ component: () => <RequireAuth><h1>Viva (coming next)</h1></RequireAuth> })
