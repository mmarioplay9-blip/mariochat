# Subir MarioChat a Koyeb

## 1. Sube el proyecto a GitHub

1. Entra a https://github.com
2. Crea un repositorio nuevo llamado `mariochat`.
3. Sube estos archivos/carpetas del proyecto:
   - `server.js`
   - `package.json`
   - `public/`
   - `.gitignore`

No hace falta subir los `.bat`, `.ps1`, `.zip` ni archivos de compartir local.

## 2. Crea la app en Koyeb

1. Entra a https://app.koyeb.com
2. Pulsa `Create App` o `Create Service`.
3. Elige `GitHub`.
4. Conecta tu cuenta de GitHub.
5. Selecciona el repositorio `mariochat`.

## 3. Configuracion

Usa estos valores:

```text
Build method: Node.js / Buildpack
Run command: npm start
Port: 3000
Instance: Free
```

Si Koyeb no pregunta el puerto, no pasa nada. MarioChat usa la variable `PORT` que Koyeb le entrega automaticamente.

## Si aparece `404 No active service`

Ese error significa que Koyeb no tiene un servicio sano corriendo para esa URL.

Revisa esto en Koyeb:

1. Entra a tu app en Koyeb.
2. Abre `Services`.
3. Confirma que hay un servicio creado y que esta en estado `Healthy` o `Running`.
4. Abre `Deployments`.
5. Si el ultimo deployment sale en `Failed`, entra a `Logs`.
6. Verifica que el servicio use:

```text
Run command: npm start
```

7. Confirma que subiste estos archivos a GitHub:

```text
server.js
package.json
Procfile
public/index.html
public/styles.css
public/app.js
public/chat-icon.svg
```

8. Si hiciste cambios despues de crear el servicio, vuelve a hacer `Redeploy`.

## 4. Deploy

1. Pulsa `Deploy`.
2. Espera a que termine.
3. Koyeb te dara una URL parecida a:

```text
https://mariochat-tuusuario.koyeb.app
```

Ese sera el enlace fijo para tus amigos.

## Importante

- El chat queda prendido aunque tu PC se apague.
- Los mensajes se guardan en memoria, no en base de datos. Si Koyeb reinicia la app, se borra el historial.
- Para voz tipo Discord 100% estable puede hacer falta un servidor TURN.
