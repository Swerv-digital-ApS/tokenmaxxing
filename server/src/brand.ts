/**
 * Branding a company's house from its website: Firecrawl reads the site's
 * colours and logo, Claude turns them into a pixel-art house palette, and the
 * logo is copied here so browsers load it from us, not from the company's host.
 */
import { lookup } from "node:dns/promises";
import { readdir, rm } from "node:fs/promises";
import { BlockList, isIP } from "node:net";
import { dirname, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Brand } from "@tokenmaxxing/core/world.ts";
import { getErrorMessage } from "hanzio";

type Palette = Omit<Brand, "logo">;

/** Next to Rivet's data, so the same volume keeps both. */
const storage = process.env.RIVETKIT_STORAGE_PATH;
export const LOGO_DIR = storage ? join(dirname(storage), "logos") : ".data/logos";
export const LOGO_FILE = /^\d+\.(png|jpg|gif|webp|svg|ico)$/;

/** The part of Firecrawl's `branding` format we use. */
interface Branding {
  colorScheme?: "light" | "dark";
  colors?: Partial<Record<"primary" | "secondary" | "accent" | "background" | "textPrimary", string>>;
  logo?: string | null;
  images?: { logo?: string | null; favicon?: string | null };
  personality?: unknown;
}

/** Without Firecrawl, a website only goes on the sign. */
export const canBrand = () => Boolean(process.env.FIRECRAWL_API_KEY);

/** Palette and logo for `host`. */
export async function brandFor(
  companyId: number,
  name: string,
  host: string,
): Promise<{ palette: Palette; logo: string | null }> {
  const branding = await scrape(`https://${host}`, process.env.FIRECRAWL_API_KEY ?? "");
  const src = branding.logo ?? branding.images?.logo ?? branding.images?.favicon;
  const [palette, logo] = await Promise.all([
    pickPalette(name, host, branding),
    src ? fetchLogo(src).catch(() => null) : null,
  ]);
  return { palette, logo: logo && (await saveLogo(companyId, logo)) };
}

async function scrape(url: string, key: string): Promise<Branding> {
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ url, formats: ["branding"] }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: { branding?: Branding };
  } | null;
  if (!res.ok || !body?.success || !body.data?.branding) throw new Error(`firecrawl ${res.status}`);
  return body.data.branding;
}

// MARK: Palette

const HEX = /^#[0-9a-f]{6}$/i;
const hexOr = (v: unknown, fallback: string) =>
  typeof v === "string" && HEX.test(v) ? v.toLowerCase() : fallback;

const luminance = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

/** Without Claude: the site's own colours, dropped where they'd make a house unreadable. */
export function plainPalette(b: Branding): Palette {
  const c = b.colors ?? {};
  const roof = hexOr(c.primary, "#c0504d");
  const bg = hexOr(c.background, "#ffffff");
  return {
    roof,
    wall: luminance(bg) > 0.75 ? bg : "#f3e7cf",
    trim: hexOr(c.secondary ?? c.accent, "#6b4a33"),
    plaque: b.colorScheme === "dark" ? hexOr(c.background, "#1b1f2a") : "#ffffff",
  };
}

const PALETTE_SCHEMA = {
  type: "object",
  properties: {
    roof: { type: "string", description: "Roof colour, #rrggbb: usually the brand's signature colour." },
    wall: { type: "string", description: "Wall colour, #rrggbb: light, so dark window frames read on it." },
    trim: { type: "string", description: "Door and window frame colour, #rrggbb: contrasts with the wall." },
    plaque: { type: "string", description: "Background behind the logo, #rrggbb: the logo must read on it." },
  },
  required: ["roof", "wall", "trim", "plaque"],
  additionalProperties: false,
};

const PALETTE_PROMPT = `You pick colours for a company's house in a cosy 16-bit pixel-art town.
You get the company's name and the branding scraped from its website. Choose four colours so
the house is instantly recognisable as theirs, yet sits well next to warm, slightly muted
pixel-art houses: prefer the brand's own colours, soften neon or pure black/white a little,
and keep the wall light. The plaque sits behind their logo, so match the background the logo
was designed for (the site's colour scheme tells you which).`;

let anthropic: Anthropic | undefined;

async function pickPalette(name: string, host: string, b: Branding): Promise<Palette> {
  const plain = plainPalette(b);
  if (!process.env.ANTHROPIC_API_KEY) return plain;
  anthropic ??= new Anthropic();
  try {
    const res = await anthropic.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: PALETTE_SCHEMA } },
      system: PALETTE_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            company: name,
            website: host,
            colorScheme: b.colorScheme,
            colors: b.colors,
            personality: b.personality,
          }),
        },
      ],
    });
    const text = res.content.find((c) => c.type === "text")?.text;
    if (res.stop_reason !== "end_turn" || !text) return plain;
    const out = JSON.parse(text) as Record<string, unknown>;
    return {
      roof: hexOr(out.roof, plain.roof),
      wall: hexOr(out.wall, plain.wall),
      trim: hexOr(out.trim, plain.trim),
      plaque: hexOr(out.plaque, plain.plaque),
    };
  } catch (err) {
    console.warn(`[brand] palette for ${host}: ${getErrorMessage(err)}`);
    return plain;
  }
}

// MARK: Logo

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};
const MAX_LOGO_BYTES = 512 * 1024;

// IPv4-mapped IPv6 (`::ffff:127.0.0.1`) is checked against the IPv4 rules by BlockList itself.
const PRIVATE = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const)
  PRIVATE.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [
  ["::", 127],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  PRIVATE.addSubnet(net, bits, "ipv6");

/**
 * True when every address `host` resolves to is on the public internet.
 * ponytail: checked before the fetch, so DNS rebinding between the two can still
 * slip through; pin the resolved IP in the request if that ever matters.
 */
export async function isPublicHost(host: string): Promise<boolean> {
  const bare = host.replace(/^\[|\]$/g, "");
  const addrs = isIP(bare)
    ? [{ address: bare, family: isIP(bare) }]
    : await lookup(bare, { all: true }).catch(() => []);
  return addrs.length > 0 && addrs.every((a) => !PRIVATE.check(a.address, a.family === 6 ? "ipv6" : "ipv4"));
}

/** Downloads an image the site links to: public hosts only, a few redirects, 512 KB at most. */
export async function fetchLogo(src: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  let url = new URL(src);
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== "data:" && (!/^https?:$/.test(url.protocol) || !(await isPublicHost(url.hostname))))
      return null;
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    const ext = LOGO_TYPES[res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? ""];
    if (!res.ok || !ext || !res.body || Number(res.headers.get("content-length")) > MAX_LOGO_BYTES)
      return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (let r = await reader.read(); !r.done; r = await reader.read()) {
      size += r.value.length;
      if (size > MAX_LOGO_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(r.value);
    }
    return { bytes: Buffer.concat(chunks), ext };
  }
  return null;
}

/** Deletes a company's logo, whatever its type. */
export async function forgetLogo(companyId: number): Promise<void> {
  const files = await readdir(LOGO_DIR).catch(() => []);
  await Promise.all(
    files.filter((f) => f.startsWith(`${companyId}.`)).map((f) => rm(join(LOGO_DIR, f), { force: true })),
  );
}

/** Stores the logo (replacing any old one) and returns its path, versioned so browsers refetch it. */
async function saveLogo(companyId: number, logo: { bytes: Uint8Array; ext: string }): Promise<string> {
  await forgetLogo(companyId);
  const file = `${companyId}.${logo.ext}`;
  await Bun.write(join(LOGO_DIR, file), logo.bytes);
  return `/logos/${file}?v=${Bun.hash(logo.bytes).toString(36)}`;
}
