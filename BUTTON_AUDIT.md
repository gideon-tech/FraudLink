# Team 4 Button Audit

Audit date: 12 July 2026. All accounts and workflow data are synthetic.

`Automated` means the handler/type/build path was verified in this workspace. `Manual pending` means a human browser click-through is still required; this environment has no interactive browser and the status is intentionally not overstated.

| Role | Screen | Control | Previous behaviour | Implemented behaviour | Permission | Test status |
| --- | --- | --- | --- | --- | --- | --- |
| All demo users | Login | Access mode, user, institution, role, sign in | Free-form fields could select unauthorised roles | Options derive only from active persisted assignments; suspended users are rejected | Active assignment | Automated; manual pending |
| All demo users | MFA | Verify, resend, backup, support | MFA was bypassed or secondary controls were dead | Fixed simulated OTP, error state, reset, and explanatory responses | Authenticated pending session | Automated; manual pending |
| All demo users | Profile | Switch Role, Logout | No profile workflow | Lists only active assignments, confirms switch, updates dashboard, audits action | Assigned active role | Automated; manual pending |
| Fraud Analyst / Supervisor | Submit Intelligence | View Intelligence | No navigation | Persists record and opens the newly created detail by reference | `SUBMIT_INTELLIGENCE` | Type/build verified; manual pending |
| Permitted roles | Indicator Catalogue | View | Dead | Opens complete indicator detail and audits view | Catalogue access | Type/build verified; manual pending |
| Permitted roles | Indicator Catalogue | History / View History | Dead | Opens row/global history and audits access | Catalogue access | Type/build verified; manual pending |
| Analyst / Supervisor | Indicator Catalogue | Propose Indicator | Dead | Validates unique code, persists pending proposal, records submitter and audit event | `PROPOSE_INDICATOR` | Type/build verified; manual pending |
| Fraud Supervisor / owning reviewer | Disclosure | Reject | Dead at steps 3 and 4 | Requires reason, records stage/actor/institution/role, persists and audits decision | `REVIEW_DISCLOSURE` | Type/build verified; manual pending |
| Fraud Supervisor / owning reviewer | Disclosure | Request More Info | Dead at steps 3 and 4 | Requires description/category/deadline, persists, displays timeline notice, and audits | `REVIEW_DISCLOSURE` | Type/build verified; manual pending |
| Supervisor / Auditor / Admin / BoU | Reports | Schedule Report | Dead | Validates schedule, persists it, lists it, and audits creation | `SCHEDULE_REPORT` | Type/build verified; manual pending |
| Same | Reports | View / Pause / Resume / Run now / Delete | Missing | Working persisted schedule actions with visible results | `SCHEDULE_REPORT` | Type/build verified; manual pending |
| Institution / BoU Admin | Users & Roles | Add User | Dead | Validates unique simulated email, persists user, audits creation | User management permission | Type/build verified; manual pending |
| Institution / BoU Admin | Users & Roles | Edit | Dead | Opens populated form, persists changes, audits old/new values | User management permission | Type/build verified; manual pending |
| Institution / BoU Admin | Users & Roles | Suspend / Reactivate | Dead | Prevents self-suspension, changes persisted status, blocks login, audits action | User management permission | Type/build verified; manual pending |
| BoU Administrator | Users & Roles | Assign Role | Missing | Assigns multiple provider/BoU roles without overwriting; updates login immediately | `ASSIGN_BOU_ROLE`, `ASSIGN_PROVIDER_ROLE` | Type/build verified; manual pending |
| Authorised admin | Users & Roles | Suspend / Revoke Role | Missing | Updates assignment status; protects final active BoU Administrator | Central permission policy | Type/build verified; manual pending |
| Institution / BoU Admin | API Integrations | Rotate | Dead | Confirms, creates fictional key, shows full key once, persists masked key/version/actor, audits | `MANAGE_API_KEYS` | Type/build verified; manual pending |
| Institution / BoU Admin | API Integrations | Revoke | Dead | Requires reason, persists revoked state/actor/time, disables key actions, audits | `MANAGE_API_KEYS` | Type/build verified; manual pending |
| BoU authorised user | Institutions | Onboard Institution | Dead | Five-step synthetic application, Pending Review persistence, audit event | `ONBOARD_INSTITUTION` | Type/build verified; manual pending |
| BoU authorised user | Institution Applications | View/Edit/Approve/Reject/More Info/Sandbox/Suspend | Missing | Controls now produce visible application-specific results | `ONBOARD_INSTITUTION` | Type/build verified; manual pending |
| Existing MVP roles | Dashboards / Lists / Alerts | Export, Refresh, Filters, Assign, Notes, Escalate, Status | Dead presentation controls | Each now produces a visible scoped demonstration result | Existing screen access | Static scan verified; manual pending |
| Admin / BoU | Settings | Save / Reset Demo Data | Save dead; reset missing | Visible save response; centralized destructive reset restores seed | Settings access | Type/build verified; manual pending |

## Static scan

- No `href="#"` controls found.
- No empty `onClick` handlers found.
- No `console.log`-only controls found.
- No “Coming soon” controls found.
- Remaining multiline `<button` scan matches have valid handlers later in their opening tags.

