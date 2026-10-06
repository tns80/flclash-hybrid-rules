import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { bettboxMain, DEFAULT_RULE_OPTIONS } from "../src/bettbox-main";
import { DNS_SERVERS, SETTINGS } from "../src/settings";
import type { ClashConfig, ProxyGroup } from "../src/types";

const host = globalThis as typeof globalThis & {
  ruleOptionsEnable?: Record<string, boolean>;
};
afterEach(() => {
  delete host.ruleOptionsEnable;
});
const source = (): ClashConfig => ({
  proxies: [{ name: "日本 BGP1", type: "ss", server: "127.0.0.1", port: 443 }],
});
const groups = (cfg: ClashConfig): ProxyGroup[] => cfg["proxy-groups"]!;
const group = (cfg: ClashConfig, name: string) =>
  groups(cfg).find((g) => g.name === name)!;
// Mihomo uses regexp2 inline flags. These patterns otherwise use JS-compatible syntax.
const regex = (pattern: string) =>
  new RegExp(pattern.replace(/^\(\?i\)/, ""), "i");
const services = ["GitHub", "Netflix", "TikTok"] as const;
const serviceRules = [
  "RULE-SET,github,GitHub",
  "RULE-SET,netflix,Netflix",
  "RULE-SET,netflix-ip,Netflix,no-resolve",
  "RULE-SET,tiktok,TikTok",
];

describe("FlClash Hybrid", () => {
  it("builds MetaCubeX mrs providers with daily local cache", () => {
    const cfg = bettboxMain(source());
    for (const [key, directory, file] of [
      ["github", "geosite", "github"],
      ["netflix", "geosite", "netflix"],
      ["tiktok", "geosite", "tiktok"],
      ["netflix-ip", "geoip", "netflix"],
    ]) {
      expect(cfg["rule-providers"]![key]).toEqual({
        type: "http",
        format: "mrs",
        interval: 86400,
        behavior: directory === "geoip" ? "ipcidr" : "domain",
        path: `${SETTINGS.RULE_PROVIDER_PATH}/${key}.mrs`,
        url: `${SETTINGS.RULE_PROVIDER_URL_BASE}/${directory}/${file}.mrs`,
      });
    }
  });

  it("routes new services in the existing priority order and exposes manual groups", () => {
    const cfg = bettboxMain(source());
    for (const rule of serviceRules) expect(cfg.rules).toContain(rule);
    const ordered = [
      "RULE-SET,category-ads-all,广告拦截",
      "RULE-SET,private,DIRECT",
      cfg.rules!.find((r: string) => r.startsWith("AND,"))!,
      "RULE-SET,openai,AI",
      "RULE-SET,youtube,YouTube",
      "RULE-SET,google,Google",
      ...serviceRules,
      "RULE-SET,telegram,Telegram",
      "RULE-SET,steam,Steam",
      "RULE-SET,apple,Apple",
      "RULE-SET,microsoft,Microsoft",
      "RULE-SET,spotify,Spotify",
      "RULE-SET,gfw,main",
      "RULE-SET,cn,DIRECT",
      "MATCH,main",
    ];
    const positions = ordered.map((r) => cfg.rules!.indexOf(r));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    for (const name of services) {
      expect(DEFAULT_RULE_OPTIONS[name]).toBe(true);
      expect(group(cfg, name).type).toBe("select");
      expect(group(cfg, name).proxies).toEqual([
        "main",
        "All",
        "HK",
        "TW",
        "JP",
        "SG",
        "KR",
        "US",
        "CA",
        "UK",
        "EU",
        "AU",
        "AS",
        "Other",
      ]);
      expect(group(cfg, "GLOBAL").proxies).toContain(name);
      expect(group(cfg, name).proxies).not.toContain("日本 BGP1");
    }
  });

  it.each(services)("disabling %s independently routes to main", (name) => {
    host.ruleOptionsEnable = { [name]: false };
    const cfg = bettboxMain(source());
    expect(groups(cfg).some((g) => g.name === name)).toBe(false);
    expect(group(cfg, "GLOBAL").proxies).not.toContain(name);
    for (const rule of serviceRules)
      expect(cfg.rules).toContain(
        rule.replace(new RegExp(`,${name}(,|$)`), ",main$1"),
      );
  });

  it.each([{}, { "proxy-providers": {} }])(
    "has no dangling targets with empty source %j",
    (input) => {
      const cfg = bettboxMain(input);
      const names = new Set([
        ...groups(cfg).map((g) => g.name),
        "DIRECT",
        "REJECT",
      ]);
      for (const g of groups(cfg))
        for (const p of g.proxies!) expect(names.has(p)).toBe(true);
      for (const r of cfg.rules! as string[])
        expect(
          names.has(
            r
              .split(",")
              .filter((v) => v !== "no-resolve")
              .at(-1)!,
          ),
        ).toBe(true);
      for (const name of services) {
        expect(group(cfg, name).proxies).toEqual(["main"]);
        expect(group(cfg, "GLOBAL").proxies).toContain(name);
      }
    },
  );

  it("keeps region-free service candidates valid", () => {
    host.ruleOptionsEnable = { 地区分组: false };
    const cfg = bettboxMain(source());
    for (const name of services)
      expect(group(cfg, name).proxies).toEqual(["main", "All"]);
    expect(
      groups(cfg).some((g) => ["CA", "UK", "EU", "Other"].includes(g.name)),
    ).toBe(false);
  });

  it("recognizes CA and UK while removing all UK patterns from EU and Other", () => {
    const cfg = bettboxMain(source());
    const ca = regex(group(cfg, "CA").filter!);
    const uk = regex(group(cfg, "UK").filter!);
    const eu = regex(group(cfg, "EU").filter!);
    const other = regex(group(cfg, "Other")["exclude-filter"]!);
    for (const token of [
      "加拿大",
      "CANADA",
      "Toronto",
      "Vancouver",
      "Montreal",
      "YYZ",
      "YVR",
      "🇨🇦",
    ]) {
      const node = `${token} 01`;
      expect(ca.test(node)).toBe(true);
      expect(other.test(node)).toBe(true);
    }
    expect(ca.test("CA 01")).toBe(false);
    for (const token of [
      "英国",
      "United Kingdom",
      "England",
      "London",
      "Manchester",
      "UK",
      "GBR",
      "LHR",
      "🇬🇧",
    ]) {
      const node = `${token} 01`;
      expect(uk.test(node)).toBe(true);
      expect(eu.test(node)).toBe(false);
      expect(other.test(node)).toBe(true);
    }
    for (const node of [
      "香港",
      "台湾",
      "日本",
      "新加坡",
      "韩国",
      "美国",
      "德国",
      "澳大利亚",
      "越南",
    ])
      expect(other.test(node)).toBe(true);
    expect(other.test("巴西 01")).toBe(false);
  });

  it("preserves runtime DNS, TUN and sniffer architecture", () => {
    const cfg = bettboxMain(source());
    expect(cfg.tun).toMatchObject({
      "strict-route": true,
      stack: "mixed",
      "auto-route": true,
      "auto-detect-interface": true,
      "dns-hijack": ["any:53", "tcp://any:53"],
    });
    expect(cfg.sniffer!.enable).toBe(true);
    expect(cfg.dns).toMatchObject({
      "respect-rules": true,
      "prefer-h3": false,
      "enhanced-mode": "fake-ip",
      nameserver: DNS_SERVERS.GLOBAL_DOH,
      "proxy-server-nameserver": DNS_SERVERS.CN_DOH,
      "direct-nameserver": ["system", ...DNS_SERVERS.CN_DOH],
      "direct-nameserver-follow-policy": true,
    });
    const policy = cfg.dns!["nameserver-policy"];
    for (const name of ["github", "netflix", "tiktok"])
      expect(
        Object.entries(policy).find(([key]) =>
          key
            .replace(/^rule-set:/, "")
            .split(",")
            .includes(name),
        )?.[1],
      ).toEqual(DNS_SERVERS.GLOBAL_DOH);
    expect(
      policy["rule-set:cn,apple-cn,google-cn,microsoft-cn,steam-cn"],
    ).toEqual(DNS_SERVERS.CN_DOH);
  });

  it("retains providers and runtime inclusion without snapshotting node names", () => {
    const providers = {
      airport: {
        type: "http",
        url: "https://example.com/sub.yaml",
        path: "./airport.yaml",
        interval: 3600,
      },
    };
    const cfg = bettboxMain({ "proxy-providers": providers });
    expect(cfg["proxy-providers"]).toBe(providers);
    for (const name of [
      "URL Test - All",
      "URL Test - CA",
      "URL Test - UK",
      "URL Test - Other",
      "URL Test - AI",
    ]) {
      expect(group(cfg, name)["include-all"]).toBe(true);
      expect(group(cfg, name)["empty-fallback"]).toBe("DIRECT");
      expect(group(cfg, name)["exclude-filter"]).toBeTruthy();
    }
    const before = JSON.stringify(groups(cfg));
    cfg.proxies = [{ name: "Canada newly added", type: "ss" }];
    expect(JSON.stringify(groups(cfg))).toBe(before);
  });

  it("tests the actual commented CUSTOM_FILTER example, retaining defaults", () => {
    const text = readFileSync(
      new URL("../src/user-config.ts", import.meta.url),
      "utf8",
    );
    const example = text.match(
      /\/\/ export const CUSTOM_FILTER = \/(.+)\/i;/,
    )![1];
    const re = new RegExp(example, "i");
    for (let n = 1; n <= 10; n++)
      for (const prefix of ["日本 BGP", "日本 BGP ", "日本-BGP"])
        expect(re.test(`${prefix}${n}`)).toBe(n >= 6);
    expect(re.test("日本 BGP100")).toBe(false);
    expect(re.test("美国 BGP6")).toBe(false);
    expect(text).toContain(
      "export const CUSTOM_FILTER = /示例占位符1|示例占位符2|示例占位符3/i;",
    );
  });
});
