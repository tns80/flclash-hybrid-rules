import { describe, expect, it } from "vitest";
import {
  buildStaticRules,
  mergeRules,
  pickDirectRules,
  type RuleTargets,
} from "../src/rules";

const FULL: RuleTargets = {
  adblock: "REJECT",
  ai: "AI",
  google: "Google",
  youtube: "YouTube",
  github: "main",
  netflix: "main",
  tiktok: "main",
  telegram: "Telegram",
  steam: "Steam",
  apple: "Apple",
  microsoft: "Microsoft",
  proxy: "main",
};

const SIMPLE: RuleTargets = {
  adblock: "广告拦截",
  ai: "AI",
  google: "全部",
  youtube: "全部",
  github: "全部",
  netflix: "全部",
  tiktok: "全部",
  telegram: "全部",
  steam: "全部",
  apple: "全部",
  microsoft: "全部",
  proxy: "全部",
};

describe("buildStaticRules", () => {
  const full = buildStaticRules(FULL);
  const simple = buildStaticRules(SIMPLE);

  it("出口按 targets 注入", () => {
    expect(full).toContain("RULE-SET,youtube,YouTube");
    expect(simple).toContain("RULE-SET,youtube,全部");
    expect(full[0]).toBe("RULE-SET,category-ads-all,REJECT");
    expect(simple[0]).toBe("RULE-SET,category-ads-all,广告拦截");
  });

  it("MATCH 兜底在末位且指向主代理组", () => {
    expect(full[full.length - 1]).toBe("MATCH,main");
    expect(simple[simple.length - 1]).toBe("MATCH,全部");
  });

  it("双版本规则骨架完全一致（防再次漂移）", () => {
    const skeleton = (rules: string[]) =>
      rules.map((r) => {
        const parts = r.split(",");
        return parts[0] === "MATCH" ? "MATCH" : `${parts[0]},${parts[1]}`;
      });
    expect(skeleton(full)).toEqual(skeleton(simple));
  });

  it("Steam 下载 CDN 直连位于 steam 规则集之前", () => {
    const direct = full.indexOf("DOMAIN-SUFFIX,steamcontent.com,DIRECT");
    const steam = full.indexOf("RULE-SET,steam,Steam");
    expect(direct).toBeGreaterThan(-1);
    expect(direct).toBeLessThan(steam);
  });

  it("google 代理规则先于 google-cn 直连（防 YouTube 未联网）", () => {
    expect(full.indexOf("RULE-SET,google,Google")).toBeLessThan(
      full.indexOf("RULE-SET,google-cn,DIRECT"),
    );
  });
});

describe("pickDirectRules", () => {
  it.each(["DIRECT", "Direct", "direct", "dIrEcT"])("normalizes target %s", (target) => {
    expect(pickDirectRules([`DOMAIN-SUFFIX,growingio.com,${target}`]))
      .toEqual(["DOMAIN-SUFFIX,growingio.com,DIRECT"]);
  });
  it("normalizes only the target while keeping payload and params", () => {
    expect(pickDirectRules([
      "IP-CIDR,192.0.2.0/24,Direct,no-resolve",
      "DOMAIN-KEYWORD,Direct,Direct",
      "RULE-SET,Direct,Direct,no-resolve",
      "PROCESS-PATH,C:\\Direct (app)\\direct.exe,direct",
    ])).toEqual([
      "IP-CIDR,192.0.2.0/24,DIRECT,no-resolve",
      "DOMAIN-KEYWORD,Direct,DIRECT",
      "RULE-SET,Direct,DIRECT,no-resolve",
      "PROCESS-PATH,C:\\Direct (app)\\direct.exe,DIRECT",
    ]);
  });
  it("does not mistake payloads, parameters or sub-rule references for targets", () => {
    expect(pickDirectRules([
      "DOMAIN-KEYWORD,DIRECT,main", "DOMAIN,DIRECT,main",
      "RULE-SET,DIRECT,main", "IP-CIDR,192.0.2.0/24,main,DIRECT",
      "SUB-RULE,(NETWORK,tcp),DIRECT", "UNKNOWN,payload,DIRECT",
      "DOMAIN,,Direct", "DOMAIN,Direct",
    ])).toEqual([]);
  });
  it.each([
    "DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD", "IP-CIDR", "IP-CIDR6",
    "SRC-IP-CIDR", "DST-PORT", "SRC-PORT", "PROCESS-NAME", "PROCESS-PATH",
    "RULE-SET", "GEOSITE", "GEOIP",
  ])("reads the third field for %s", (type) => {
    expect(pickDirectRules([`${type},payload,Direct`])).toEqual([`${type},payload,DIRECT`]);
  });
  it.each([
    "AND,((NETWORK,tcp),(DOMAIN-KEYWORD,DIRECT)),Direct",
    "OR,((DOMAIN,a.com),(AND,((NETWORK,tcp),(DST-PORT,443)))),direct",
    "NOT,((DOMAIN,DIRECT)),dIrEcT",
  ])("normalizes the outer logical target: %s", (rule) => {
    expect(pickDirectRules([rule])).toEqual([rule.replace(/,[^,]+$/, ",DIRECT")]);
    expect(pickDirectRules([rule.replace(/,[^,]+$/, ",main")])).toEqual([]);
  });
  it("rejects malformed logical payloads", () => {
    expect(pickDirectRules(["AND,((NETWORK,tcp),Direct", "NOT,),DIRECT", "OR,payload,DIRECT"]))
      .toEqual([]);
  });
  it.each(["MATCH,DIRECT", "MATCH,Direct", "MATCH,direct", "MATCH,dIrEcT", "MATCH,REJECT", "MATCH,OldGroup", " match ,DIRECT"])(
    "never inherits terminal rule %s", (terminal) => {
      const direct = "DOMAIN-SUFFIX,example.com,DIRECT";
      const ip = "IP-CIDR,192.0.2.0/24,DIRECT,no-resolve";
      const picked = pickDirectRules([direct, ip, terminal]);
      expect(picked).toEqual([direct, ip]);
      for (const target of [FULL, SIMPLE]) {
        const result = mergeRules(buildStaticRules(target), picked);
        expect(result.filter((r) => /^MATCH,/i.test(r))).toEqual([`MATCH,${target.proxy}`]);
        expect(result.at(-1)).toBe(`MATCH,${target.proxy}`);
        expect(result).toContain(direct);
        expect(result).toContain(ip);
      }
    },
  );
  it("仅保留 DIRECT 规则，跳过注释与空行", () => {
    expect(
      pickDirectRules([
        "DOMAIN,a.com,DIRECT",
        "DOMAIN,b.com,Proxy",
        "# DOMAIN,c.com,DIRECT",
        "",
        "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
      ]),
    ).toEqual(["DOMAIN,a.com,DIRECT", "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve"]);
  });
  it("不误保留 DIRECTOR 之类前缀", () => {
    expect(pickDirectRules(["DOMAIN,x.com,DIRECTOR"])).toEqual([]);
  });
});

describe("mergeRules", () => {
  const base = ["RULE-SET,a,X", "MATCH,main"];
  it("canonicalizes direct extra targets before deduplication and keeps one final MATCH", () => {
    expect(mergeRules([...base, "MATCH,Other"], [
      "DOMAIN-SUFFIX,growingio.com,Direct", "DOMAIN-SUFFIX,growingio.com,direct",
      "IP-CIDR,192.0.2.0/24,Direct,no-resolve", "MATCH,Direct",
    ])).toEqual([
      "RULE-SET,a,X", "DOMAIN-SUFFIX,growingio.com,DIRECT",
      "IP-CIDR,192.0.2.0/24,DIRECT,no-resolve", "MATCH,main",
    ]);
  });
  it("rejects terminal extra rules even if passed without pickDirectRules", () => {
    expect(mergeRules(base, ["MATCH,DIRECT", "MATCH,REJECT", "MATCH,OldGroup"]))
      .toEqual(base);
  });
  it("额外规则插入 MATCH 之前", () => {
    expect(mergeRules(base, ["DOMAIN,u.com,DIRECT"])).toEqual([
      "RULE-SET,a,X",
      "DOMAIN,u.com,DIRECT",
      "MATCH,main",
    ]);
  });
  it("无额外规则返回副本", () => {
    const out = mergeRules(base, []);
    expect(out).toEqual(base);
    expect(out).not.toBe(base);
  });
  it("无 MATCH 时追加并去重", () => {
    expect(mergeRules(["RULE-SET,a,X"], ["RULE-SET,a,X", "D,u,DIRECT"])).toEqual([
      "RULE-SET,a,X",
      "D,u,DIRECT",
    ]);
  });
});
