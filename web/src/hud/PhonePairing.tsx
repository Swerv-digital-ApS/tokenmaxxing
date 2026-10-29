import { toDataURL } from "qrcode";
import { useState } from "react";
import { withPlayer } from "../net.ts";
import { useRun, useTicker } from "./ui.tsx";

/** A phone gets a game session, not a token capable of importing usage. No external QR service. */
export function PhonePairing() {
  const [pair, setPair] = useState<{ code: string; expiresAt: number; qr: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { busy, error, run } = useRun();
  const seconds = pair ? Math.max(0, Math.ceil((pair.expiresAt - Date.now()) / 1000)) : 0;
  useTicker(1000, pair !== null && seconds > 0);
  const generate = run(async () => {
    setPair(null);
    setCopied(false);
    const next = await withPlayer((p) => p.mintPhoneLoginCode());
    const url = new URL("/play", location.origin);
    url.hash = new URLSearchParams({ code: next.code }).toString();
    const qr = await toDataURL(url.href, { width: 256, margin: 4, errorCorrectionLevel: "M" });
    setPair({ ...next, qr });
  });
  const copy = run(async () => {
    await navigator.clipboard.writeText(pair!.code);
    setCopied(true);
  });
  return (
    <section className="phone-pairing">
      <h3>Phone companion</h3>
      <p className="muted small">Play and check your stats on Android. Your computers keep syncing usage.</p>
      {pair && seconds > 0 ? (
        <>
          <p>In the Android app, choose Scan QR, or type the code below.</p>
          <img src={pair.qr} width={256} height={256} alt="Single-use phone sign-in QR code" />
          <p className="small">Works once. Expires in {seconds}s. Anyone with this code can sign in.</p>
          <div className="command">
            <code>{pair.code}</code>
            <button type="button" disabled={busy} onClick={copy}>
              {copied ? "Copied" : "Copy code"}
            </button>
          </div>
          <button type="button" className="link" onClick={() => setPair(null)}>
            Hide code
          </button>
        </>
      ) : (
        <>
          {pair && <p className="muted small">That code expired. Make another to connect your phone.</p>}
          <button type="button" className="primary" disabled={busy} onClick={generate}>
            Connect phone
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
