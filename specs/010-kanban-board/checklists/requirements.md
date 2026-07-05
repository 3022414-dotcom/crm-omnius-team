# Specification Quality Checklist: Kanban-доска

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

- Kanban — агрегация данных deals, не отдельная таблица; никаких миграций не нужно
- Порядок стадий фиксирован: lead → qualified → proposal → negotiation → won → lost
- contacts_count вычисляется JOIN с deal_contacts — важный нефункциональный момент для планирования
- Два эндпоинта: один GET для просмотра (с фильтром), один для смены стадии
- Scope: только backend API; drag-and-drop — задача F-11
- account может быть null (сделка без аккаунта — допустимо из F-06)
