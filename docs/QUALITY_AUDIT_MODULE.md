# Quality & Audit Management module

This branch extends the first Quality Module release with controlled document workflow, revision archive, authenticated approvals and CAPA effectiveness verification.

## Included features
- Controlled document register with ISO standard/clause mapping, department, equipment, revision, owner, issue/review dates and controlled file upload.
- Document lifecycle: Draft -> Under Review -> Reviewed -> Approved. Rejected documents return to an editable state and require resubmission.
- Approval activity history stores the acting database user ID, name, current role, action, comments, revision and timestamp.
- Approved-document revision changes archive the previous metadata and binary file in a separate MongoDB collection; every new revision requires a replacement file and returns to Draft for review.
- Audit register for internal, external, customer and supplier audits.
- NCR/CAPA register with finding classification, root cause, immediate correction, corrective action, owner, target date, objective evidence and effectiveness result.
- CAPA closure is restricted to Manager/Deputy Manager, requires the evidence fields, and prevents the recorded action owner from independently verifying their own CAPA.
- Summary counters for documents, audits, open CAPA, documents due for review and overdue CAPA.

## API
- GET /api/quality/summary
- GET/POST /api/quality/documents
- PATCH /api/quality/documents/:id (Draft/Rejected only)
- GET /api/quality/documents/:id/file
- POST /api/quality/documents/:id/submit
- POST /api/quality/documents/:id/review
- POST /api/quality/documents/:id/approve
- POST /api/quality/documents/:id/reject
- POST /api/quality/documents/:id/revisions
- GET /api/quality/documents/:id/history
- GET /api/quality/documents/:id/revisions/:revision/file
- GET/POST /api/quality/audits
- GET/POST /api/quality/capas
- PATCH /api/quality/records/:id

All Quality APIs require a valid bearer JWT. Document submission is available to Manager, Deputy Manager and Shift Engineer; review/rejection to Manager and Deputy Manager; final document approval to Manager only. CAPA effectiveness closure is Manager/Deputy Manager only. New self-registered accounts receive the Guest role; an authorized administrator must assign privileged roles through a controlled user-administration process.

## Deployment and validation
1. Set a strong, unique JWT_SECRET in Render production environment variables before deployment. Production authentication will fail closed if it is missing.
2. Confirm MongoDB connectivity and configure database backup/restore before production use.
3. Deploy backend and frontend from the reviewed branch/merged commit according to existing Render/Vercel settings.
4. Test with separate Manager, Deputy Manager and Shift Engineer accounts. Verify unauthorized requests return 401/403.
5. Test document create, attach, submit, review, approve, reject, create a new revision, and retrieve the archived prior revision.
6. Test CAPA closure with missing evidence (must fail), complete evidence (must still require a Manager/Deputy Manager verifier), and action owner attempting self-verification (must fail).
7. Run backend TypeScript build and frontend Vite production build; complete staging tests before production use.
8. Confirm ISO editions and clause mappings against the organization's certified scope and certification body's transition plan.

## Storage and known limitations
- Uploads accept PDF, Word, Excel, CSV, JPG, PNG and WEBP; maximum 10 MB per file.
- Current and archived files are stored as base64 in MongoDB. Private object storage is recommended for larger production deployments.
- Approval history is application-level traceability, not a qualified electronic signature or tamper-proof regulatory e-signature system. Restrict database write access and maintain backups.
- CAPA evidence is currently recorded as a reference/description, not an attached evidence file. A dedicated CAPA evidence upload and independent effectiveness review attachment should be added in a later iteration.
- The system does not itself establish ISO conformity. Document owners must validate the applicable clauses, retention periods, approval authority and certification scope.
