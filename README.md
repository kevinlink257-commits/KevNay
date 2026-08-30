# Inverkev - PWA Gestión de Préstamos

Sistema Avanzado de Crédito y Cobranza - PWA instalable con login seguro.

## 🚀 Características
- Dashboard con estadísticas reales
- Cálculo automático de mora con tasa usura
- Calculadora general + calculadora de préstamos
- Notas, gráficos con Chart.js
- Misión y Visión
- Menú desplegable con configuración: estilo, colores, idioma
- Login protegido con SHA-256 (sin clave en texto plano)
- PWA instalable y offline

## 🔐 Login
La clave no está en el código, solo su hash SHA-256.
Clave actual: Inverkev#2026! (cámbiala generando nuevo hash)

## 📦 Archivos
- index.html - App principal
- manifest.json - Config PWA
- sw.js - Service Worker
- icon-192.png / icon-512.png / icon-180.png - Iconos

## 🌐 Deploy en Netlify
Conecta este repo en Netlify:
- Build command: (vacío)
- Publish directory: /

## 🔄 Cambiar clave
1. Genera SHA-256 de tu nueva clave en https://emn178.github.io/online-tools/sha256.html
2. Reemplaza HASH_AUTORIZADO en index.html línea ~40
3. Haz commit y push, Netlify despliega solo.

Desarrollado por Kevin Obeso - Inverkev
