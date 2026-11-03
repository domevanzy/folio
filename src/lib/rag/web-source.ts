import "server-only";
import { Resolver } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIPv4 } from "node:net";
import { HttpError } from "@/lib/http";
import { maxSourceText, webSourceUrl } from "@/lib/validation";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(address, prefix);

const maxHtmlBytes = 2 * 1024 * 1024;

export function extractWebText(html: string) {
  const plain = (value: string) =>
    value
      .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
      .replace(
        /<(script|style|noscript|svg|nav|header|footer|template)\b[^<>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,
        "",
      )
      .replace(/<\/?(?:p|div|h[1-6]|li|br|section|article|tr)\b[^<>]*>/gi, "\n")
      .replace(/<[^<>]*>/g, "")
      .replace(
        /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
        (token, entity: string) => {
          if (entity.startsWith("#")) {
            const hex = entity[1]?.toLowerCase() === "x";
            const code = Number.parseInt(
              entity.slice(hex ? 2 : 1),
              hex ? 16 : 10,
            );
            return code > 0 && code <= 0x10ffff
              ? String.fromCodePoint(code)
              : token;
          }
          const named: Record<string, string> = {
            amp: "&",
            lt: "<",
            gt: ">",
            quot: '"',
            apos: "'",
            nbsp: " ",
          };
          return named[entity.toLowerCase()] ?? token;
        },
      )
      .replace(/[^\S\r\n]+/g, " ")
      .replace(/ *\r?\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replaceAll(String.fromCharCode(0), "")
      .trim();
  const title = plain(
    html.match(/<title\b[^<>]*>([^<]*)<\/title>/i)?.[1] ?? "",
  );
  const body =
    html.match(/<body\b[^<>]*>([\s\S]*?)(?:<\/body>|$)/i)?.[1] ??
    html.replace(/<head\b[^<>]*>[\s\S]*?(?:<\/head>|$)/i, "");
  return { title, content: plain(body) };
}

export async function importWebSource(input: string) {
  let url = new URL(input);
  const signal = AbortSignal.timeout(12_000);
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  try {
    for (let hop = 0; hop <= 4; hop++) {
      signal.throwIfAborted();
      if (!webSourceUrl.safeParse(url.href).success)
        throw new HttpError(400, "Ungültige Webseitenadresse.");
      const host = url.hostname;
      if (!isIPv4(host) && (!host.includes(".") || host.includes(":")))
        throw new HttpError(400, "Nur öffentliche Webseiten sind zulässig.");
      const addresses = isIPv4(host) ? [host] : await resolver.resolve4(host);
      if (
        !addresses.length ||
        addresses.some((address) => blocked.check(address))
      )
        throw new HttpError(400, "Nur öffentliche Webseiten sind zulässig.");

      const result = await new Promise<{ redirect: string } | { html: string }>(
        (resolve, reject) => {
          const request =
            url.protocol === "https:" ? httpsRequest : httpRequest;
          const req = request(
            url,
            {
              signal,
              agent: false,
              family: 4,
              // Pin the checked address while retaining the URL hostname for TLS.
              lookup: (_hostname, _options, callback) =>
                callback(null, addresses[0], 4),
              headers: { Accept: "text/html", "Accept-Encoding": "identity" },
            },
            (response) => {
              response.on("error", reject);
              const status = response.statusCode ?? 0;
              if (
                [301, 302, 303, 307, 308].includes(status) &&
                response.headers.location
              ) {
                resolve({ redirect: response.headers.location });
                response.destroy();
                return;
              }
              if (
                status !== 200 ||
                !/^text\/html(?:\s*;|$)/i.test(
                  response.headers["content-type"] ?? "",
                )
              ) {
                reject(
                  new HttpError(
                    400,
                    "Die Adresse liefert keine lesbare HTML-Seite.",
                  ),
                );
                response.destroy();
                return;
              }
              const chunks: Buffer[] = [];
              let bytes = 0;
              response.on("data", (chunk: Buffer) => {
                bytes += chunk.length;
                if (bytes > maxHtmlBytes) {
                  reject(new HttpError(413, "Die Webseite ist zu groß."));
                  response.destroy();
                } else chunks.push(chunk);
              });
              response.on("end", () =>
                resolve({ html: Buffer.concat(chunks).toString("utf8") }),
              );
            },
          );
          req.on("error", reject);
          req.end();
        },
      );
      if ("redirect" in result) {
        url = new URL(result.redirect, url);
        continue;
      }
      const { title, content } = extractWebText(result.html);
      if (!content)
        throw new HttpError(400, "Die Webseite enthält keinen lesbaren Text.");
      if (content.length > maxSourceText)
        throw new HttpError(413, "Die Webseite enthält zu viel Text.");
      return {
        name: (title || url.hostname).slice(0, 180),
        content,
        originalUrl: url.href,
      };
    }
    throw new HttpError(400, "Die Webseite leitet zu oft weiter.");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Die Webseite konnte nicht geladen werden.");
  }
}
