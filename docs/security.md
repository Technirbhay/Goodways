# Security & RBAC Policy - GoodWays

GoodWays enforces strict least-privilege access and multi-role security across all endpoints and client interfaces.

## 1. Authentication & Role-Based Access Control (RBAC)
- **Citizens**: Open registration. Permitted to submit roadway reports, view their own case history, and dispatch grievances.
- **Authorities (Officials)**: Restricted access. New authority registrations default to `approvalStatus: 'pending'` and cannot access the Authority Dashboard until approved by the Super Admin or verified via the private `ADMIN_INVITE_CODE` backend environment variable.
- **Super Administrator**: Root authority account with privileges to approve or revoke officer registrations.

## 2. Backend Authorization Enforcement
- Frontend route guards are strictly supplementary. All protected operations (status updates, private evidence viewing, user approvals) validate user tokens and permissions on the backend.
- Requests without valid session tokens or lacking required authority roles receive `401 Unauthorized` or `403 Forbidden` responses.

## 3. Secret Management
- Private API keys (Gemini API key) are stored strictly in backend environment variables (`GEMINI_API_KEY`) and never exposed to the browser or frontend bundle.
- Environment files (`.env`) are excluded via `.gitignore`. Sample templates (`.env.example`) are provided.
