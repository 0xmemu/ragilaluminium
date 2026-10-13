# ADR-009: Baileys Long-Session Persistence and Liveness

## Status

Accepted

## Date

2026-08-13

## Context

The Ragil gateway uses Baileys with a multi-file auth directory, but the first
OpenClaw-inspired adaptation only copied the reconnect and watchdog shape. It
did not observe Baileys protocol-frame activity, used an overly short idle
threshold, and wrote the primary credentials file through Baileys' normal
non-atomic writer. That combination could make a healthy linked connection look
stale and could weaken recovery after a process interruption.

The gateway is a separate Node service at `/opt/baileys-bot/index.js` and its
auth state is stored at `/opt/baileys-bot/session`. A normal network reconnect
must reuse that auth state without requiring another QR scan. A WhatsApp
`loggedOut` response remains a real relink condition.

## Decision

Use the OpenClaw long-session pattern at the gateway boundary:

- keep Baileys `useMultiFileAuthState` and cacheable signal keys;
- persist `creds.json` through a serialized, atomic write with a valid backup;
- restore a missing or invalid primary credentials file from the backup;
- observe `sock.ws` `frame` events as transport activity, while leaving
  Baileys' own keepalive responsible for protocol pings;
- use a 25-second Baileys keepalive, a 5-minute transport-stale threshold, and
  a 2-hour application-silence threshold by default;
- reconnect 408/network losses with exponential backoff and resume attempts
  after a cooldown instead of permanently stopping the daemon;
- preserve the existing gateway HTTP/webhook contract; explicit force-connect,
  `/disconnect`, and WhatsApp logout remain the only session-clearing paths.

## Alternatives Considered

### Raw WebSocket `ping()` as the heartbeat

Rejected. `sock.ws` is Baileys' socket event emitter, not the underlying `ws`
client, and the wrapper does not expose `ping()`. The existing call was a
no-op. Baileys already sends protocol keepalive requests and emits decoded
frames that can be observed safely.

### Treat application messages as the only liveness signal

Rejected. A linked WhatsApp account can be idle for hours. Message activity is
not a transport-health signal and would cause false reconnects.

### Disable the watchdog completely

Rejected. A dead TCP/WebSocket connection still needs bounded detection and
recovery. The watchdog remains, but its thresholds and activity source match
the transport behavior.

## Consequences

- Normal Baileys/network reconnects reuse the saved linked-device credentials.
- Idle healthy connections are no longer closed after a few minutes merely
  because no chat message arrived.
- A logged-out or deliberately cleared auth directory still requires a new QR
  scan or pairing code; long-session logic cannot override WhatsApp invalidation.
- Operational validation must include one successful pairing, a service
  restart, and observation that the gateway returns to `open` without another
  pairing action.
