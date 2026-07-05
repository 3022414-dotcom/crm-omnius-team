# Specification Quality Checklist: Активности (Activities)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-05
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs)
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness

- [X] No [NEEDS CLARIFICATION] markers remain
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic (no implementation details)
- [X] All acceptance scenarios are defined
- [X] Edge cases are identified
- [X] Scope is clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Notes

- Аналог F-07 (Notes) и F-08 (Attachments) по структуре: полиморфная ассоциация, entity-specific list routes
- Ключевые отличия: поле completed (toggle), due_date, вычисляемый overdue, фильтрация по status/type/date
- Каскадное удаление активностей уже реализовано в F-04/F-05/F-06 — F-09 его не трогает
- overdue: true только если due_date установлен + истёк + completed=false (три условия одновременно)
- Нет record-level access для обновления (в отличие от F-07 notes, где автор мог редактировать свои)
