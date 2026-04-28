# PRD — TimeSaver - Screenshot to Calendar Event (MVP, Free / Rule-Based)

---

## 1. Overview
Build a lightweight web tool that converts screenshots (rosters, emails, tickets) into downloadable calendar events (`.ics`), extracting only **high-confidence structured data** (date + time).

---

## 2. Goal
Enable users to:
- Upload a screenshot  
- Automatically extract valid events  
- Review them  
- Download a `.ics` file for import into calendar apps  

**Constraints:**
- 100% free (no paid APIs)  
- Local-first where possible  

---

## 3. Non-Goals (MVP)
- No automatic calendar syncing  
- No user accounts  
- No perfect parsing of messy/unstructured inputs  
- No AI dependency  

---

## 4. Target Users
- Shift workers (hospitality, events, healthcare)  
- Professionals receiving schedules via email/screenshots  
- Anyone manually copying events into calendars  

---

## 5. Core User Flow
1. Upload screenshot  
2. Click “Generate Events”  
3. System extracts events  
4. User reviews/edits events  
5. User downloads `.ics`  
6. User imports into calendar  

---

## 6. Functional Requirements

### 6.1 Upload
- Accept image formats: `.png`, `.jpg`, `.jpeg`
- Drag & drop + file picker

---

### 6.2 OCR Extraction
- Use Tesseract (local OCR engine)
- Output raw text

---

### 6.3 Parsing Engine (Rule-Based)

#### Date Detection
- Pattern: `19 Apr, Sunday`
- Infer:
  - Month/year from header (e.g. `Apr 2026`)
  - Convert to ISO format

---

#### Time Detection
- Patterns:
  - `15:00–00:30`
  - `15:30-01:00`

---

#### Event Creation Rules
Create event ONLY if:
- Valid date
- Valid start & end time

---

#### Overnight Handling
- If `end < start` → add +1 day

---

#### Exclusions
Ignore:
- `OFF`
- `00:00–00:00`
- Missing time/date

---

#### Optional Fields
- **Title**
  - Prefer role (e.g. “Restaurant Manager”)
  - Else fallback to shift code (e.g. “JSTNF Shift”)

- **Location**
  - Include only if clearly identifiable
  - Else omit

---

#### Confidence Rule
- Only output events with:
  - date + start + end
- Everything else discarded

---

### 6.4 Review UI
- List extracted events
- Editable fields:
  - Title
  - Start
  - End
  - Location
- Ability to delete events

---

### 6.5 Export
- Generate `.ics` file
- Download locally

---

## 7. Data Model

```json
{
  "title": "string",
  "start": "ISO datetime",
  "end": "ISO datetime",
  "location": "string | null"
}
```

## 8. UX Requirements

Principles

- Minimal steps (≤ 3 clicks)
- Transparent output (user can verify)
- Fail safely (omit uncertain data)

States

- Empty → upload prompt
- Processing → loader
- Results → editable event list
- Error → “No events detected”

## 9. Success Criteria (MVP)

- ≥80% accuracy on structured rosters
- <5 seconds processing time
- Zero cost to run locally
- Successful .ics import into calendar

## 10. Tech Stack

- Frontend: Next.js (React, TypeScript)
- OCR: Tesseract
- Parsing: Custom regex logic
- Calendar: ical-generator

## 11. Future Extensions (Not MVP)

- AI fallback parsing (for messy emails)
- Direct calendar API integration
- Email ingestion
- Mobile-first UX
- Learning user preferences (title/location inference)