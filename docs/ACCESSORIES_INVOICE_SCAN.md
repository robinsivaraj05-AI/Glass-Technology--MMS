# Accessories Invoice Scan & Upload

This feature adds an AI-assisted invoice capture and approval flow to the existing Accessories & Consumables page.

## Workflow

1. A user opens **Rental Equip. → Accessories**.
2. Select **Open scanner**.
3. Take a photograph on a mobile device or upload JPG, PNG, WEBP or PDF (maximum 7 MB).
4. The Express backend sends the document to the OpenAI Responses API for structured extraction.
5. The extracted values and original file are saved as a pending `InvoiceDraft` in MongoDB.
6. A reviewer checks/corrects all fields, enters their name, and selects **Approve & Save**.
7. The backend creates an Accessories entry or updates a matching entry using invoice number / delivery order number. The Accessories table refreshes.

No WhatsApp API integration is required for this manual upload workflow. Users can save the image/PDF from WhatsApp and upload it from their phone.

## Backend environment variables (Render)

Add these environment variables to the existing Render backend service:

- `OPENAI_API_KEY`: secret OpenAI API key (never put this in Vercel or GitHub).
- `OPENAI_VISION_MODEL`: optional; defaults to `gpt-4.1-mini`.
- Keep existing `MONGO_URI`, `JWT_SECRET`, and `CLIENT_URL` values.

The backend uses Node's built-in `fetch`; deploy on Node.js 18+ (Node 20+ recommended).

## New API endpoints

Mounted under `/api/accessory-invoices`:

- `POST /extract` — multipart form field `invoice`; creates a pending draft.
- `GET /drafts` — list pending drafts.
- `GET /drafts/:id` — retrieve one pending draft.
- `GET /drafts/:id/file` — stream the original uploaded image/PDF.
- `PATCH /drafts/:id` — save reviewer corrections.
- `POST /drafts/:id/approve` — validate and create/update Accessories entry.
- `POST /drafts/:id/reject` — reject a pending draft.

## Deployment

1. Review this feature branch and merge the pull request after code review.
2. Set `OPENAI_API_KEY` on Render. Do not commit secrets.
3. Confirm Render is using Node 20 or later and runs the existing backend build/start commands.
4. Deploy the backend first.
5. Vercel should deploy the frontend branch after the PR is merged (or use a Vercel preview deployment to test first).
6. Test with a non-production invoice first. Check the pending draft, correct fields, approve, and confirm the Accessories list updates.
7. Confirm your MongoDB deployment supports transactions (MongoDB Atlas does). The approval endpoint uses a transaction to prevent a draft and Accessories entry getting out of sync.

## Operational and security notes

- Uploads are limited to 7 MB and JPG, PNG, WEBP, PDF.
- Original files are stored as Base64 in the pending invoice document. Keep uploads small; for high volume or larger documents, move file storage to private object storage or MongoDB GridFS.
- AI extraction is a draft only. It never posts an Accessories transaction until a human approves it.
- Review invoice number, D.O. number, quantity, rate, VAT, total and equipment association against the original.
- Duplicate matching uses invoice number and delivery order number (including a legacy D.O. value in `poNumber`). Confirm the match before approving.
- The existing application routes do not consistently apply authentication middleware. Before production use, restrict invoice scan, review, approve, reject and source-file endpoints to authenticated, authorized users. The approver name field is an audit label, not authentication.
- Rotate any database credentials that may have been committed to Git history and store secrets only in Render environment variables.
