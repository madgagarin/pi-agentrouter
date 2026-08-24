# Руководство по улучшению и патчу @madgagarin/pi-agentrouter (v1.2.1)

В данном документе зафиксированы все ключевые архитектурные исправления и инварианты совместимости для нативной и стабильной работы Pi с шлюзом AgentRouter.

---

## 1. Архитектурные требования и обнаруженные инварианты

### А. Межпроцессный учет задержки запросов (Cross-Process Pacing)
* **Проблема:** In-memory переменная `lastRequestEndTime` не синхронизировалась между параллельными процессами (между основным процессом и фоновыми сабагентами `pi-subagents`). Это приводило к ошибкам Rate Limit (429).
* **Решение:** Хранение метки времени последнего запроса в разделяемом файле `~/.pi/agent/.agentrouter-pacing`.

### Б. Сессионная привязка для Claude (Session Affinity)
* **Проблема:** Для провайдера `agentrouter-clode` отсутствовал флаг `sendSessionAffinityHeaders: true`, из-за чего запросы одного диалога раскидывались по разным узлам кластера, приводя к потере контекста.
* **Решение:** Включение `sendSessionAffinityHeaders: true` в блоке `compat` для провайдера `agentrouter-clode` и всех его моделей.

### В. Нативная поддержка Pi и сохранение корневого системного промпта (`pi-code` Signature)
* **Принцип:** Шлюз AgentRouter нативно поддерживает `pi-coding-agent` (`pi-code`). Подменять User-Agent на сторонние клиенты (вроде claude-cli) **НЕ ТРЕБУЕТСЯ**.
* **Главный инвариант:** WAF AgentRouter валидирует сессию по **корневой сигнатуре базового системного промпта `pi-code`**.
* **Критическое правило для сабагентов:** Все сабагенты (`scout`, `worker`, `reviewer` и т.д.) ОБЯЗАНЫ использовать `systemPromptMode: append`. Использование `replace` затирает базовый промпт `pi-code`, из-за чего сервер отклоняет многошаговые запросы ошибкой `401 UNAUTHENTICATED (unauthorized client detected)`.
* **Защита от мутаций:** Плагин динамически выставляет `PI_CACHE_OPTIMIZER_NO_PROMPT_REWRITE=1` только при обращении к роутам AgentRouter, защищая корневой системный промпт от нежелательных правок оптимизатора кэша.

---

## 2. Матрица моделей для сабагентов

* **Разведка и документация (Ultra-fast, без лимитов):**
  * `scout`, `scaffold`, `docs`, `audit-gemini` $\rightarrow$ `google/gemini-2.5-flash`
* **Кодинг и планирование (Флагманские модели):**
  * `worker`, `executor`, `refactor` $\rightarrow$ `agentrouter-openai/gpt-5.6-sol` или `agentrouter-clode/claude-opus-4-8`
* **Глубокий аудит и архитектура:**
  * `debugger`, `oracle` $\rightarrow$ `agentrouter-clode/claude-opus-5`
* **Тестирование, ревью и DevOps:**
  * `tester`, `reviewer`, `devops`, `security` $\rightarrow$ `agentrouter-openai/gpt-5.6-sol`

---

## 3. Резюме готовых правок

1. **`pi-agentrouter` (v1.2.1):** Нативный чистый провайдер, pacing-файл, сессионная привязка и динамический bypass prompt-rewrite.
2. **`pi-content-sanitizer`:** Фильтрация чувствительных слов и маскирование секретов.
3. **`agents/*.md`:** Во всех сабагентах зафиксирован `systemPromptMode: append`.
