# agent-lab-client

Desktop-клиент (Tauri) к [`agent-lab`](../agent-lab)'s `cmd/agentserver` —
отдельный проект, не часть `agent-lab` (см. `agent-lab/docs/plans/phase2_client_and_memory.md`).

Rust-слой (`src-tauri/src/lib.rs`) — тонкие команды, дёргающие
`cmd/agentserver`'s HTTP API (`/v1/sessions`, `/v1/sessions/{id}/messages`)
через `reqwest`; UI (`src/`) — создание/выбор сессии и чат с рендером
ответов модели как markdown (`marked`).

## Запуск

Нужен поднятый `cmd/agentserver` (см. `agent-lab/docs/agentserver.md`) и
bearer-токен пользователя (`cmd/createuser` в `agent-lab`).

```bash
npm install
npm run tauri dev
```

В окне приложения: Base URL (адрес `agentserver`, по умолчанию
`http://127.0.0.1:8099`) и токен вводятся вручную при каждом запуске —
между перезапусками клиента они не сохраняются (сознательное упрощение
первой версии).

## Известные упрощения этой версии

- Токен/base URL не персистентны между запусками.
- Профиль сессии — захардкожен в `create_session` (`src-tauri/src/lib.rs`,
  `COURSE_PROFILE = "course"`), не параметр и не видим в UI. Осознанно на
  время, пока клиент — инструмент под один конкретный курс; когда клиент
  станет более общим (не только этот курс), хардкод нужно убрать и вернуть
  выбор профиля — см. `docs/agentserver.md` в `agent-lab` про сами профили.
- Список сессий обновляется только при создании новой сессии или смене
  токена, не периодически.
