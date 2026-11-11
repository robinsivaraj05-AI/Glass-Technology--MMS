# Quality & Audit Management module

This branch adds the first operational UI and API for the MMS Quality Module.

## Features
- Controlled document register with ISO standard/clause mapping, department, equipment, revision, dates, owner, approval metadata, status and optional file attachment.
- Audit register for internal, external, customer and supplier audits.
- NCR/CAPA register with finding classification, root cause, immediate correction, corrective action, responsible person, target date, evidence, verification and closure fields.
- Summary counters for documents, audits, open CAPA, documents due for review and overdue CAPA.
- Search and attachment preview/download endpoint.

## Backend
- QualityRecord MongoDB model.
- GET /api/quality/summary
- GET/POST /api/quality/documents
- PATCH /api/quality/documents/:id
- GET /api/quality/documents/:id/file
- GET/POST /api/quality/audits
- GET/POST /api/quality/capas
- PATCH /api/quality/records/:id

File uploads: PDF, Word, Excel, CSV, JPG, PNG and WEBP; maximum 10 MB per file. Files are currently stored as base64 in MongoDB. For production-scale use, migrate attachments to private object storage and keep metadata in MongoDB.

## Deployment and verification
1. Review the code and merge the pull request into main.
2. Render should build the existing backend TypeScript project and Vercel should build the existing Vite frontend as configured.
3. Confirm MongoDB connectivity and backup/restore before production use.
4. Test create/list/update and attachment preview with a non-production record.
5. Configure actual authorization and role-based approval rules before treating approval metadata as a controlled electronic approval. The current repository frontend login includes demo/local credentials and the existing backend APIs do not consistently enforce authentication; this module follows that existing API convention and must not be considered production-secure until access control is corrected.
6. Validate ISO clause mapping and applicable standards against the organization's certification scope and controlled procedures. This software is a record-management aid, not evidence of conformity by itself.

## Known limitation
The first iteration stores current document metadata and file, but does not yet implement immutable revision snapshots, a formal review/approval transition log, or effectiveness verification gates on CAPA closure. Add those controls before relying on the module for controlled-document electronic approval or audit closure.