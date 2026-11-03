# CityMood server layer

This directory contains server-only application code for the CityMood backend.

The public and admin UI may call these modules through server components, server
actions, or route handlers. Browser/client components must not import anything
from this directory directly.

## Boundaries

- auth/: identity, sessions, roles, and permission policies.
- content/: backend content ports and public read contracts.
- db/: Supabase client and transaction helpers.
- media/: signed uploads and image processing.
- repositories/: persistence implementations.
- services/: publishing, search, advertising, analytics, and revalidation use cases.
- validation/: request and domain validation schemas.

Database access, secrets, and authorization checks belong here rather than in
React components. Keep these modules independent of presentation markup so they
can later move into a standalone API application if the product requires it.

Supabase is the approved backend platform. The publishable key may be used by
browser-safe clients only with RLS enabled. Supabase secret/service-role keys
must remain in server-only modules and deployment secrets because they bypass
RLS.
