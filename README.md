# Kev Nay POS & Cloud Hub

Terminal de punto de venta retail y hub administrativo de alta fidelidad desarrollado para comercio minorista, con bloqueo por PIN, telemetría en tiempo real, arqueo de caja y facturación electrónica/térmica POS.

## 🚀 Características Principales

- **Pantalla de Bloqueo de Terminal & PIN (Lock Screen):**
  - Autenticación ergonómica por teclado numérico 3x4 y soporte para teclado físico.
  - Indicadores visuales de PIN interactivos con feedback táctil y sonoro.
  - Telemetría en vivo: Reloj local COT, conexión Supabase SSL 256-bit y estado de impresora térmica.
  - Relevo ágil de operadores de caja (Kevin N., Laura G., Carlos M. - Admin, Valentina R.).
  - Desbloqueo maestro para supervisores y validación biométrica/NFC simulada.
  - Botón de corte Z de emergencia.

- **Caja POS (Terminal de Venta):**
  - Catálogo de productos organizado por categorías con control de existencias en tiempo real.
  - Búsqueda instantánea por nombre comercial, SKU o código de barras.
  - Simulador de lector láser con confirmación sonora.
  - Carrito de compras con cálculo automático de impuestos (IVA 19%, 5%, exento), descuentos y subtotal.
  - Pasarela de cobro en efectivo con cálculo de vueltas/cambio, datáfono o QR (Nequi/Bancolombia).
  - Emisión de ticket térmico oficial POS-58 e impresión compatible con navegador (`window.print()`).

- **Inventario & Métricas:**
  - Control de valor a costo vs. precio de venta al público y margen bruto estimado.
  - Detección proactiva de stock bajo.
  - Registro de nuevos productos y ajuste de inventario (compras, mermas, conteo físico).

- **Cierre de Turno & Arqueo de Caja (Corte Z):**
  - Arqueo físico con calculadora por denominaciones de billetes y monedas en COP.
  - Detección automática de diferencia (cuadrado, faltante o sobrante).
  - Emisión de comprobante oficial de cierre Z para auditoría.

- **Historial de Ventas & Auditoría:**
  - Registro completo de tickets emitidos con previsualización y reimpresión.
  - Anulación de transacciones protegida por PIN de supervisor.
  - Registro de eventos de seguridad y telemetría de la terminal.

## 🛠️ Tecnologías

- **Framework:** React 19 + TypeScript
- **Bundler:** Vite 8
- **Estilos:** Tailwind CSS v4 con paleta Dark Mode (`#0c1322`, acentos carmesí `#dc2626` / `#ef4444`)
- **Audio:** Web Audio API (efectos de sonido táctiles para clics, lector láser y apertura de gaveta)
- **Tipografía:** Inter & JetBrains Mono

## 📦 Instalación y Ejecución Local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Compilar para producción
npm run build
```
