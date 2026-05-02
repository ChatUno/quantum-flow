### Sección Stress

Estas son las características definitivas que debe integrar:

1. Motor de Ejecución Aislado (Worker-Thread Engine)
 - Aislamiento Total: Toda la lógica de concurrencia y el envío de peticiones fetch deben residir en un Web Worker dedicado.
 - Fluidez de UI: Este aislamiento garantiza que la interfaz principal mantenga 60fps constantes, permitiendo al usuario interactuar con otros paneles mientras se lanza un ataque de 1000 RPS (Requests Per Second).
 - Gestión de Memoria: Uso de ArrayBuffer y TypedArrays para manejar volúmenes masivos de datos de respuesta sin saturar el recolector de basura (Garbage Collector) de JavaScript.

2. Perfiles de Ataque (Orquestador de Carga)
En lugar de un envío plano, el sistema debe permitir modelar el comportamiento del tráfico:
 - Modo Constant Rate: Mantiene un flujo estable y predecible de peticiones por segundo.
 - Modo Ramp-up (Escalada Gradual): Incrementa linealmente las peticiones para identificar el punto exacto de ruptura del servidor.
 - Modo Burst (Picos de Alta Frecuencia): Dispara ráfagas masivas en intervalos de milisegundos para testear la resiliencia de los balanceadores de carga.
 - Kill-Switch de Emergencia: Un botón de parada instantánea vinculado a un AbortController para detener todas las peticiones en vuelo ante un colapso inminente.

1. Visualización Táctica (Radar Dinámico)
Sustituyendo las gráficas convencionales, el Stress utiliza un Radar Chart en tiempo real construido en <canvas> que mide cuatro ejes vitales:
 - Throughput (Caudal): Volumen real de datos procesados con éxito.
 - Error Rate (Fatalidad): Ratio porcentual de fallos frente a aciertos.
 - Latencia P99: El tiempo de respuesta del 1% de las peticiones más lentas, crucial para detectar cuellos de botella ocultos.
 - Jitter (Consistencia): Variabilidad en los tiempos de respuesta que indica inestabilidad en el servidor.

1. Inteligencia de Recuperación y AlertasAuto-Stop:
 - Configuración de umbrales de seguridad (ej: detener si el error rate supera el 15%) para evitar daños innecesarios a la infraestructura auditada.
 - Estimación de Impacto: Cálculo en tiempo real del consumo de recursos y duración estimada del test antes de iniciar la ejecución.
 - Anotación Automática: Cada ejecución de Stress debe generar un marcador en el Pulse-Tracker para correlacionar el aumento de carga con la degradación del rendimiento.

2. Integración Forense Inmediata
 - Surgical ID Mapping: Cada petición fallida durante el test de estrés debe ser identificable mediante su ID único para ser analizada posteriormente en el módulo Forensics.
 - Snapshot de Resultados: Al finalizar, el sistema genera un resumen técnico que incluye la configuración del ataque y las métricas pico alcanzadas, listo para ser exportado.

---

### Sección Pulse

1. Visualización de Alta Frecuencia (60fps Canvas)
 - Renderizado Óptimo: Utiliza un elemento <canvas> gestionado mediante requestAnimationFrame para garantizar una fluidez absoluta sin sobrecargar la CPU.
 - Buffer Circular: Los datos se manejan en un buffer circular para evitar que el consumo de memoria crezca indefinidamente durante sesiones de monitoreo largas.
 - Diseño Técnico: Una cuadrícula de alta precisión sobre el fondo "Abismo" con líneas de tiempo que se desplazan suavemente.

2. Desglose Estadístico de Latencia (P50, P90, P99)
Un solo promedio de latencia es insuficiente para el análisis forense; Pulse disecciona la experiencia del usuario en tres capas:
 - P50 (Mediana): El tiempo de respuesta que experimenta el usuario promedio.
 - P90 (Umbral de Alerta): El tiempo que sufren el 10% de los usuarios con peor conexión.
 - P99 (Criterio de Fallo): La métrica de los usuarios más lentos; si esta línea se dispara, hay un bloqueo o cuello de botella crítico en el backend.

3. Análisis de Inestabilidad (Jitter Shadow)
 - Visualización de Jitter: El gráfico dibuja una "sombra" o resplandor (Glow) alrededor de la línea de latencia principal.
 - Diagnóstico Visual: Cuanto más ancha es la sombra, mayor es la variabilidad entre peticiones, lo que indica inestabilidad en la red o en el proceso de recolección de basura (Garbage Collector) del servidor.

4. Sistema Watchdog (Alertas No Bloqueantes)
 - Umbrales Configurables: El usuario define un límite de latencia (ej. 300ms) mediante el ID pl-thresh-inp.
 - Notificaciones Tácticas: Si el P99 cruza el umbral, el sistema activa una alerta visual instantánea en el dashboard sin interrumpir el flujo de trabajo actual.
 - Correlación de Eventos: El gráfico marca automáticamente líneas verticales cuando se inicia o detiene un test en el módulo Stress, permitiendo ver el impacto inmediato de la carga en la salud del sistema.

5. Integración con Forensics (Snapshot de Crisis)
 - Captura de Anomalías: Al detectar un pico masivo (Outlier), Pulse puede enviar ese rastro directamente al módulo Forensics para un análisis de desviación estándar (3σ).
 - Persistencia Local: Los datos críticos del Pulse se guardan de forma cifrada en la Bóveda (The Vault) para revisiones post-mortem.

### Sección Forensics

1. Ghost Mode (Comparativa de Sombras)
 - Superposición Visual: Permite proyectar la gráfica de rendimiento de una prueba histórica sobre los datos capturados en tiempo real.
 - Validación de Optimización: Es la prueba definitiva para confirmar si una mejora en el código del backend ha reducido realmente la latencia en comparación con versiones pasadas.
 - Control de Opacidad: El sistema permite ajustar la visibilidad de la "sombra" histórica mediante el ID fx-ghost-toggle-btn para analizar las diferencias con precisión quirúrgica.

2. Detección Algorítmica de Anomalías
 - Regla de las 3 Sigmas (3σ): Implementa un algoritmo que calcula la desviación estándar de la latencia e identifica automáticamente los "outliers" o valores atípicos.
 - Aislamiento de Errores: El sistema resalta en rojo cualquier petición que rompa el patrón estadístico normal, permitiendo al desarrollador ignorar el "ruido" y centrarse en los fallos críticos.
 - Análisis Cíclico: Capacidad de identificar patrones de error recurrentes, como bloqueos de base de datos o procesos de limpieza de caché mal optimizados.

3. Auditoría Profunda de Cabeceras (Deep Header Audit)
 - Fingerprinting de Servidor: Analiza los headers de respuesta para identificar la tecnología subyacente (Nginx, Cloudflare, etc.) y detectar posibles fugas de información o versiones vulnerables.
 - Escrutinio de Seguridad: Realiza una verificación forense de las políticas CORS y cabeceras de seguridad para asegurar que el endpoint cumple con los estándares de protección.

4. Generación de Evidencias (Structure Output)
 - Transformación de Datos: Convierte cualquier payload JSON interceptado en estructuras de clases JavaScript o tipos de TypeScript listos para ser inyectados en otros proyectos.
 - Snapshot Forense: Genera informes técnicos en formato Markdown o PDF que incluyen el payload exacto del fallo, la configuración de la red en ese momento y el veredicto del sistema sobre el cuello de botella detectado.

5. Sincronización con The Vault
 - Persistencia Cifrada: Todos los análisis forenses se almacenan en la Bóveda mediante cifrado AES-256-GCM, garantizando que las evidencias de vulnerabilidades o fallos críticos permanezcan bajo el control total del usuario.
 - Recuperación de Estado: Gracias a la integración con IndexedDB, el módulo permite viajar en el tiempo y re-ejecutar cualquier escenario de fallo pasado para intentar reproducirlo en el Gateway.

