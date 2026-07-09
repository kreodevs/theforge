## 2. Arquitectura y Stack

Core (Execution & Risk Engine, LLM Orchestrator, Translation Engine, Alpha Engine, Gateway Service, Data Ingestion Service).

## 3. Modelo de Datos

```sql
CREATE TABLE recommendations (
  id UUID PRIMARY KEY,
  signal_id UUID NOT NULL UNIQUE,
  ticker VARCHAR(10) NOT NULL
);
```

## 5. Lógica

Scheduler semanal 22:00 CST para recomendaciones.
