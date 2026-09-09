# Espacio de trabajo SDK de Kakune

Espacio de trabajo pnpm independiente para la base publica de TypeScript de Kakune. Publica cuatro paquetes:

- `@kakune/contracts`: tipos de protocolo y esquemas JSON canonicos.
- `@kakune/client`: transporte sin dependencias basado en Fetch y Server-Sent Events.
- `@kakune/sdk`: metodos de conveniencia para la API versionada de Kakune.
- `@kakune/create-plugin`: CLI y biblioteca para crear la base de un plugin.

## Requisitos

- Node.js 22 o posterior
- Corepack (incluido con las versiones compatibles de Node.js)

## Instalar, compilar y probar

```sh
corepack enable
corepack pnpm install
corepack pnpm build
corepack pnpm test
```

Para comprobar los tipos estaticos:

```sh
corepack pnpm typecheck
```

## Cliente y SDK

`@kakune/client` usa solo la API estandar Fetch y flujos de respuesta SSE. Proporcione una implementacion de Fetch si el entorno no ofrece `globalThis.fetch`.

```ts
import { createKakuneSdk } from "@kakune/sdk";

const sdk = createKakuneSdk({ baseUrl: "https://kakune.example" });
const info = await sdk.getCoreInfo();

for await (const event of sdk.events()) {
  console.log(event.event, event.data);
}
```

La API base usa `GET /api/v1/info`, `GET /api/v1/plugins/:name/manifest` y `GET /api/v1/events`.

## Esquemas

Las rutas publicadas de los esquemas son:

```text
@kakune/contracts/schemas/core-info.schema.json
@kakune/contracts/schemas/workflow.schema.json
@kakune/contracts/schemas/plugin-manifest.schema.json
@kakune/contracts/schemas/plugin-json-rpc-message.schema.json
```

Los esquemas usan JSON Schema draft 2020-12. `workflow.schema.json` valida el valor semantico compatible con JSON despues de analizar el YAML, pero no analiza YAML por si mismo.

## Crear un plugin

Compile primero el espacio de trabajo y ejecute el binario local:

```sh
corepack pnpm build
corepack pnpm --filter @kakune/create-plugin exec kakune-create-plugin ./plugins/hello --name @acme/hello --description "Plugin de ejemplo"
```

El comando crea `kakune.plugin.json`, `package.json` y `src/index.ts`, y no sobrescribe ninguno de ellos.

## Publicar

Cada paquete define una lista explicita de archivos y un mapa de exportaciones. En un entorno autenticado en el registro, publique en este orden:

```sh
corepack pnpm --filter @kakune/contracts publish --access public
corepack pnpm --filter @kakune/client publish --access public
corepack pnpm --filter @kakune/sdk publish --access public
corepack pnpm --filter @kakune/create-plugin publish --access public
```
