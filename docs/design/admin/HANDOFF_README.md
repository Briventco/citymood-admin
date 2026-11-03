# CityMood admin portal handoff

Copy the contents of this folder into `docs/design/` in the citymood2 repo. Your existing files stay; this adds:

- `ADMIN_SPEC.md`: what to build (roles, screens, data rules, security)
- `ADMIN_IMPLEMENTATION_PROMPT.md`: your Supabase setup steps and the prompt for Claude Code
- `admin/schema.sql`: database tables, roles and security rules for Supabase
- `admin/rls-tests.sql`: checks that each role can only do what it should (all pass against schema.sql)
- `reference/admin/`: screenshots and reference pages for the six admin screens

The reference screens show fictional placeholder content.
