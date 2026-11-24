import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '../../lib/RequireAuth'
export const Route = createFileRoute('/attempts/')({ component: () => <RequireAuth><h1>Attempts (coming)</h1></RequireAuth> })
