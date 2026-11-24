import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '../../lib/RequireAuth'
export const Route = createFileRoute('/attempts/$id')({ component: () => <RequireAuth><h1>Attempt</h1></RequireAuth> })
