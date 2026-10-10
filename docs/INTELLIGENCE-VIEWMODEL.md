# Executive Intelligence ViewModel

Capa transicional DOM-free que organiza Performance, Risk, Execution y Assurance.

- Tendencia: misma finca, lote, cultivo y cobertura.
- Benchmark: mismo cultivo y cobertura.
- Datos ausentes permanecen null.
- No modifica el scoring oficial, Firestore, APK, seed, firma ni reglas.
- El scoring oficial y las vistas de aseguramiento viven en `lib/model.ts`, `lib/metric-analysis.ts`, `app/metrics-panel.tsx` y `app/consolidated-metrics.tsx`.
- Pesos oficiales: 5% / 25% / 10% / 30% / 30%. Estados: Saludable (95–100%), Alerta (80–94%), Vulnerable (< 80%).
