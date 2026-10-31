// The demo's token endpoint over HTTP, for a drive that tests a refresh the
// host lets go of (a development build's only, app.ts `setDemoTokens`): run
// `bun demo-tokens.ts [port]` (4310 by default), then launch the demo at
// `/settings?developer=on&demoTokens=http://127.0.0.1:<port>`. It spends a
// refresh token as the request arrives, as a server does, and answers a round
// trip later with the tokens the demo issues, at the app's time (`X-Demo-At`)
// for the token URL it asked (`X-Demo-Url`). Start one per drive: under the
// agent the demo's tokens repeat from launch to launch (its randomness is
// seeded), and a token this server saw spent stays spent. It answers no CORS
// preflight, so it serves a native drive, not a web page.
import { rotate, ROUND_TRIP_MS } from './demo';

const port = Number(process.argv[2] ?? 4310);
Bun.serve({
  hostname: '127.0.0.1',
  port,
  async fetch(request) {
    const form = new URLSearchParams(await request.text());
    const answer = rotate(request.headers.get('X-Demo-Url') ?? '', form, Number(request.headers.get('X-Demo-At')) + ROUND_TRIP_MS);
    console.log(`refresh ${form.get('refresh_token')}: ${answer.status}`);
    await Bun.sleep(ROUND_TRIP_MS);
    return answer;
  },
});
console.log(`demo tokens at http://127.0.0.1:${port}`);
