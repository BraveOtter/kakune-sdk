# Espacio de trabajo SDK de Kakune

Espacio de trabajo pnpm independiente para la base publica de TypeScript de Kakune. Publica cinco paquetes:

- `@kakune-ai/contracts`: tipos de protocolo y esquemas JSON canonicos.
- `@kakune-ai/client`: transporte sin dependencias basado en Fetch y Server-Sent Events.
- `@kakune-ai/sdk`: metodos de conveniencia para la API versionada de Kakune.
- `@kakune-ai/create-plugin`: CLI y biblioteca para crear la base de un plugin.
- `@kakune-ai/plugin-testkit`: validacion JSONL del protocolo y transportes de prueba en memoria.

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

`@kakune-ai/client` usa solo la API estandar Fetch y flujos de respuesta SSE. Proporcione una implementacion de Fetch si el entorno no ofrece `globalThis.fetch`.

```ts
import { createKakuneSdk } from "@kakune-ai/sdk";

const sdk = createKakuneSdk({ baseUrl: "https://kakune.example" });
const info = await sdk.getCoreInfo();

for await (const event of sdk.events()) {
  console.log(event.event, event.data);
}
```

Las rutas canonicas incluyen `GET /health/live`, `GET /health/ready`, `GET /api/v1/info`, `GET /api/v1/plugins/:name/manifest` y `GET /api/v1/events`. El documento publico completo OpenAPI 3.1.2 se publica en `@kakune-ai/contracts/openapi/core-api.openapi.json`.

### Flujos y ejecuciones

El flujo canonico es el valor compatible con JSON obtenido al analizar YAML. Tiene `apiVersion: "kakune/v1"`, `kind: "Workflow"`, `metadata` con `id` y `name`, `triggers`, el ID de nodo `entry` y `nodes`; `inputs`, `outputs`, `policy` y `layout` son opcionales.

```ts
const workflow: Workflow = {
  apiVersion: "kakune/v1",
  kind: "Workflow",
  metadata: { id: "nightly-report", name: "Nightly report" },
  triggers: [{ id: "manual", type: "kakune.trigger.manual@1" }],
  entry: "build-report",
  nodes: [{ id: "build-report", type: "kakune.report.build@1" }]
};
```

`@kakune-ai/sdk` ofrece auxiliares tipados para `listWorkflows`, `analyzeWorkflow`, `createWorkflow`, `getWorkflowSource`, `saveWorkflowSource`, `setWorkflowEnabled`, `createExecution`, `listExecutions` y `getExecution`. Los auxiliares de fuente reciben texto YAML; los de lista extraen el sobre canonico `{ items }`.

## Esquemas

Las rutas publicadas de los esquemas son:

```text
@kakune-ai/contracts/schemas/core-info.schema.json
@kakune-ai/contracts/schemas/workflow.schema.json
@kakune-ai/contracts/schemas/plugin-manifest.schema.json
@kakune-ai/contracts/schemas/core-sse-event.schema.json
@kakune-ai/contracts/schemas/connection-context-export.schema.json
@kakune-ai/contracts/schemas/provider-model-capabilities.schema.json
@kakune-ai/contracts/schemas/problem-details.schema.json
@kakune-ai/contracts/openapi/core-api.openapi.json
```

Los esquemas usan JSON Schema draft 2020-12. `workflow.schema.json` valida el valor semantico compatible con JSON despues de analizar el YAML, pero no analiza YAML por si mismo.

`core-sse-event.schema.json` define el sobre JSON versionado que se transporta en el campo SSE `data`. `connection-context-export.schema.json` es el formato portable de exportacion de conexiones para GUI/CLI y solo permite referencias a credenciales, nunca credenciales. `provider-model-capabilities.schema.json` hace explicitas las funciones de providers y modelos. `problem-details.schema.json` anade metadatos obligatorios de solicitud de Kakune a los campos Problem Details de RFC 9457.

## Crear un plugin

Compile primero el espacio de trabajo y ejecute el binario local:

```sh
corepack pnpm build
corepack pnpm --filter @kakune-ai/create-plugin exec kakune-create-plugin ./plugins/hello --id acme.hello --name "Plugin de ejemplo" --description "Plugin de ejemplo"
```

El comando crea un `kakune.plugin.json` de proceso, `nodes/hello.node.json` estatico, `package.json` y un `src/index.ts` JSON-RPC por stdio, y no sobrescribe ninguno de ellos.

Los manifiestos de proceso usan `manifestVersion: "1.0"`, un `id` separado por puntos, `name` visible, `version` semantica, `pluginProtocol: ">=1.0.0 <2.0.0"` y `runtime: { kind: "process", command, args }`. Los plugins reciben solicitudes JSON-RPC 2.0 delimitadas por lineas en stdin y deben reservar stdout para mensajes JSON-RPC.

## Testkit de plugins

`@kakune-ai/plugin-testkit` analiza y valida mensajes UTF-8 JSON-RPC 2.0 delimitados por lineas mediante los tipos de `@kakune-ai/contracts`. `createInMemoryPluginHost` ofrece extremos emparejados de Core y plugin para pruebas unitarias; solo transporta mensajes y nunca importa ni ejecuta codigo de plugins.

```ts
import { createInMemoryPluginHost, parsePluginJsonl } from "@kakune-ai/plugin-testkit";

const testHost = createInMemoryPluginHost();
testHost.host.send(parsePluginJsonl('{"jsonrpc":"2.0","id":1,"method":"initialize"}\n')[0]);
const request = await testHost.plugin.receive();
```

## Ejemplos de plugins

`examples/sample-typescript` usa `runPluginStdio` de `@kakune-ai/sdk`. `examples/external-python` usa solo la biblioteca estandar de Python. `examples/git-adapter` es un adaptador independiente que se puede copiar fuera del repositorio, sin dependencias npm de ejecucion; declara Node.js y Git y expone `kakune.git.status@1`.

## Publicar

Las instrucciones de preparacion y verificacion estan en [RELEASE.md](RELEASE.md). Cada paquete define una lista explicita de archivos, un mapa de exportaciones, metadatos de repositorio y un publisher de confianza. Un tag protegido `sdk-vX.Y.Z` publica los tarballs verificados exactamente con OIDC, checksums, SBOM CycloneDX y provenance de GitHub. CI no almacena tokens de escritura del registro.

```sh
npm install @kakune-ai/contracts@0.1.0 @kakune-ai/client@0.1.0 @kakune-ai/sdk@0.1.0
npm audit signatures
```
