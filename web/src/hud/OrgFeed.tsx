import { ORG_FEED_NOTICE } from "@tokenmaxxing/core/org-feed.ts";
import { useEffect, useState } from "react";
import { town } from "../net.ts";
import { useRun } from "./ui.tsx";

interface Link {
  orgId: string;
  email: string;
}

interface Pending {
  orgId: string;
  expiresAt: number;
}

/**
 * On my own card: opt in to an organization's cloud usage (claude.ai, Codex on the web, and the rest
 * that never lands in a local log). The notice is the opt-in. Nothing is counted before it.
 */
export function OrgFeed() {
  const [orgId, setOrgId] = useState("");
  const [links, setLinks] = useState<Link[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState<{ orgId: string; code: string } | null>(null);
  const { error, busy, run } = useRun();

  useEffect(() => {
    void town.orgFeed().then(
      (s) => {
        setLinks(s.links);
        setPending(s.pending);
      },
      () => {},
    );
  }, []);

  const claim = run(async () => {
    const id = orgId.trim().toLowerCase();
    const r = await town.startOrgClaim(id);
    setCode({ orgId: id, code: r.code });
    setPending({ orgId: id, expiresAt: r.expiresAt });
  });
  const unlink = (id: string) =>
    run(async () => {
      await town.unlinkOrgFeed(id);
      const s = await town.orgFeed();
      setLinks(s.links);
      setPending(s.pending);
      if (code?.orgId === id) setCode(null);
    });

  const orgs = [...new Set(links.map((l) => l.orgId))];
  return (
    <>
      <h3>Organization usage</h3>
      <p className="muted small">{ORG_FEED_NOTICE}</p>
      {orgs.map((id) => (
        <div key={id}>
          <p className="small">
            {id}{" "}
            <button type="button" className="link" disabled={busy} onClick={() => unlink(id)}>
              Unlink
            </button>
          </p>
          <ul className="members">
            {links
              .filter((l) => l.orgId === id)
              .map((l) => (
                <li key={l.email}>
                  <span>{l.email}</span>
                </li>
              ))}
          </ul>
        </div>
      ))}
      {code ? (
        <p className="small">
          Give <code>{code.code}</code> to {code.orgId}. It works once, for 15 minutes.
        </p>
      ) : (
        pending && (
          <p className="muted small">A code for {pending.orgId} is waiting. Make a new one to see it.</p>
        )
      )}
      <form onSubmit={claim}>
        <input
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          maxLength={32}
          placeholder="swerv"
          aria-label="Organization id"
        />{" "}
        <button type="submit" className="primary" disabled={busy || !orgId.trim()}>
          Get a code
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </>
  );
}
