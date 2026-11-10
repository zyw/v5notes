# V5Notes

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md)

A privately hosted note service. Notes are stored as Markdown and can be read and edited from the admin console and the desktop client, then kept in sync on your own server.

## Projects

| Directory | Role |
| --- | --- |
| `v5notes2` | API server. Java 21 and Spring Boot 4.1. Sign-in, notes, folders, trash, files, and admin APIs. |
| `v5notes-admin2` | Admin console. Vue 3, TypeScript, Element Plus, and Vite. |
| `v5notes-client2` | Desktop client. Vue 3 and Tauri, for reading and writing Markdown notes online. |

All three interfaces support Simplified Chinese, Traditional Chinese, and English. The client sends `Content-Language`, and the API returns messages in that language.

## Run locally

Prepare MySQL and Redis, then set the connections in `v5notes2/note-admin/src/main/resources/application-dev.yml`.

```bash
# API, port 8080 by default. Schema migrations run on startup.
cd v5notes2
mvn -DskipTests package
java -jar note-admin/target/v5notes2.jar --spring.profiles.active=dev
```

```bash
# Admin console
cd v5notes-admin2
pnpm install
pnpm dev
```

```bash
# Desktop client
cd v5notes-client2
npm install
npm run dev
npm run tauri dev
```

## Use

1. Start the API.
2. Open the admin console and create a user who can sign in.
3. In the client, enter the server address, username, and password.

The client must use the same `clientid` as the server. If it differs, set `VITE_CLIENT_ID` before building. If the server uses a different RSA public key for sign-in, set `VITE_API_PUBLIC_KEY`.

## Repository

- GitHub: https://github.com/zyw/v5notes
- Gitee: https://gitee.com/zyw/v5notes
