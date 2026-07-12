# ISO Standards Alignment

## Status and claim boundary

MoMo FraudLink Uganda is a hackathon MVP designed **with reference to** relevant international standards. It has not undergone an accredited conformity assessment and must not be described as ISO certified or fully ISO compliant. Formal conformity would require organisational policies, risk treatment, evidence collection, internal audit, management review and independent assessment beyond source code.

## Standards traceability matrix

| Standard | Relevance to MoMo FraudLink | MVP implementation evidence | Production work still required |
| --- | --- | --- | --- |
| **ISO/IEC 27001:2022 — Information security management systems — Requirements** | Risk-based governance of the confidentiality, integrity and availability of fraud intelligence | JWT authentication, backend role checks, institution isolation, environment-managed secrets, auditable security events and documented limitations | Formal ISMS scope, asset/risk registers, statement of applicability, policies, control owners, internal audit and management review |
| **ISO/IEC 27002:2022 — Information security controls** | Practical guidance for access control, cryptography, logging, secure development and incident response | Password hashing, least-privilege API authorization, deterministic keyed HMAC references, protected configuration, structured audit trail and automated tests | MFA, KMS/HSM-backed key management, rotation, central monitoring, vulnerability management, backup testing and operational procedures |
| **ISO/IEC 27701:2025 — Privacy information management systems** | Accountability for processing personally identifiable information by controllers and processors | Purpose confirmations, institution/user attribution, pseudonymous protected references, scoped disclosure, auditability and synthetic demo data | Controller/processor agreements, lawful-basis records, data-subject workflows, retention/deletion automation, DPIA and privacy governance |
| **ISO/IEC 29100:2024 — Privacy framework** | Common privacy roles, principles and safeguards for systems processing PII | Data minimisation, purpose limitation language, deterministic pseudonymisation, institution scoping and separation of operational decision-making | Full privacy-principle assessment, privacy notices, consent/lawful-basis mapping and independently reviewed re-identification controls |
| **ISO/IEC 27035-1:2023 — Information security incident management** | Structured preparation, detection, reporting, assessment, response and lessons learned | Incident submission, correlation lifecycle events, explainable alerts, review states, escalation controls, timestamps and audit history | Formal playbooks, severity/SLA ownership, evidence handling, post-incident review and lessons-learned workflow |
| **ISO 22301:2019 — Business continuity management systems** | Continued availability and recovery of a cross-institution fraud service | Documented architecture, database migrations, reproducible seed/reset workflow and health endpoint | Business impact analysis, recovery objectives, redundant deployment, tested backups, disaster recovery and continuity exercises |
| **ISO 20022 series — Universal financial industry message scheme** | Shared semantics and interoperability for financial transaction information | Versioned structured API payloads, controlled transaction types, references, institution identifiers, currency, amount and event timestamps | The current JSON API is not an ISO 20022 message implementation; production integration requires message mapping, validation, governance and conformance testing |

## Privacy and security design principles

The prototype applies the following principles:

1. **Data minimisation:** participating institutions exchange protected references and risk evidence rather than automatically disclosing customer identity.
2. **Purpose limitation:** submissions are restricted to authorised fraud-prevention and investigation workflows.
3. **Pseudonymisation:** identifiers are canonicalised and processed with deterministic HMAC-SHA-256 using a versioned secret.
4. **Least privilege:** API and WebSocket data are scoped by authenticated role and institution; menu visibility is not treated as authorization.
5. **Accountability:** login, submission, correlation, alert creation and operational decisions create attributable audit events.
6. **Explainability:** relationships are risk signals, not automatic declarations of guilt; alerts expose rule contributions and supporting evidence.
7. **Separation of duties:** stronger operational decisions can require supervisor authority, while BoU retains oversight visibility.
8. **Privacy by design:** unrelated institutions do not receive alerts or customer relationships outside their authorised scope.

## Suggested judging statement

> MoMo FraudLink is designed with reference to ISO/IEC 27001 and 27002 security controls, ISO/IEC 27701 and 29100 privacy principles, and ISO/IEC 27035 incident-management practices. It uses protected-reference matching, least-privilege institution scoping, explainable fraud signals and auditable decision workflows. This is standards-aligned prototype design, not a claim of ISO certification.

## Authoritative references

- [ISO/IEC 27001:2022](https://www.iso.org/standard/27001)
- [ISO/IEC 27002:2022](https://www.iso.org/standard/75652.html)
- [ISO/IEC 27701:2025](https://www.iso.org/standard/27701)
- [ISO/IEC 29100:2024](https://www.iso.org/standard/85938.html)
- [ISO/IEC 27035-1:2023](https://www.iso.org/standard/78973.html)
- [ISO 22301:2019](https://www.iso.org/standard/75106.html)
- [ISO 20022](https://www.iso.org/standard/20022-1)

