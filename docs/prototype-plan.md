# TaskFlow clickable prototype proposal

Status: built following explicit Phase 1 approval; awaiting design review. Implemented inside `prototype/`, with its own entry point and mock state. No production API, real passwords, database or production imports. Label the interface “Demo — mock data; changes reset on reload.” Do not store entered passwords. Styling and components are exploratory and require review before production reuse.

## Visual direction and screens

Recommend a calm light interface: neutral canvas, white surfaces, indigo primary actions, readable system typography, consistent spacing, visible keyboard focus and text/icons alongside status colors. Verify contrast during the prototype review. Avoid a kanban board, animations, dark mode and elaborate navigation in the MVP.

- `/login`: compact branded form with email/password, show-password control, login action and registration link. Show sample demo credentials and explain that authentication is simulated.
- `/register`: name/email/password, clear requirements, field errors, pending action and link to login. Successful mock submission opens dashboard.
- `/dashboard`: TaskFlow header and logout; welcome heading and new-task action; summary counters; title search and status filter; task list with title, short description, status, created/updated dates and actions; pagination where fixtures require it.
- Create/edit dialog: title, description and status with validation, cancel and save. Preserve values on simulated failure. A completion toggle provides a quick action.
- Delete confirmation: task title, cancel and destructive action. Focus starts on the safe action and returns to the invoking control.

Desktop uses a centered workspace with four summary cards and aligned task rows. Tablet wraps counters and controls. Mobile stacks controls and task cards, provides full-width form actions and a scrollable near-fullscreen dialog. Aim for 44-pixel touch targets, visible labels, semantic headings and adequate contrast.

## Clickable review journeys

| Journey | Expected behavior |
| --- | --- |
| Register | Empty/invalid submit shows inline errors; valid mock submit enters dashboard |
| Login | Invalid demo credentials show generic error; valid credentials navigate to dashboard |
| Guard/logout | Direct unauthenticated dashboard entry navigates to login; logout clears mock session |
| Create | Open dialog, validate required title, save, see task and counters update |
| Edit/complete | Existing values prefill; cancel discards edits; save and complete update row and counters |
| Delete | Cancel preserves task; confirm removes task; counters and page update |
| Search/filter | Case-insensitive title search and selected status combine; clearing restores list; page resets |
| Empty states | No tasks offers Create task; no matches offers Clear search/filters |
| Failure/retry | Demo controls simulate initial loading, API failure, mutation failure and retry; entered form data survives |
| Navigation | Login/register links, browser back/forward, protected route and logout work consistently |

Mock fixtures include all three statuses, long titles/descriptions, no tasks, no matches and enough tasks for a second page. Add visible demo-only controls for dataset reset and failure simulation; these must not enter production UI. In-memory registration/login demonstrates navigation only and makes no security claims.

## Accessibility and verification

Use real buttons, labels and error associations; announce feedback through a live region. Dialogs trap focus, support Escape when safe, and restore focus. Disable duplicate submissions while pending; show textual loading feedback. On route changes place focus predictably at the page heading. Long content wraps without breaking the layout.

Review at 360, 768 and 1440 CSS pixels, using keyboard only as well as pointer input. Check viewport overflow, readable forms, focus visibility, contrast, dialog scrolling and clear success/error feedback. Demonstrate every journey above and record actual results, screenshots and remaining issues. Prototype review is separate from future production security and automated integration testing.

## Approval boundary

Phase 1 approval permits building this isolated prototype only. Present the running prototype and verification evidence for explicit approval before scaffolding or implementing production client/server features. Resolve feedback within the prototype before moving on.

## Phase 2 delivery

See [phase-2-verification.md](phase-2-verification.md) for walkthrough evidence, tooling checks and known limitations. Prototype search is immediate over local fixtures, pagination uses six items to make the interaction reviewable, and no authentication or task data persists. Production implementation still requires explicit approval.
