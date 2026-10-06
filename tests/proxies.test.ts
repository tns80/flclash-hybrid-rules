import { describe, expect, it } from "vitest";
import {
  buildAllAiProxyList,
  classifyProxiesByRegion,
  makeProxyNamesUnique,
  splitInfoAndNormalProxies,
} from "../src/proxies";
import { REGIONS } from "../src/regions";
import { SETTINGS } from "../src/settings";
import type { Proxy } from "../src/types";
import { RESERVED_GROUP_NAMES, rewriteProxyReferences } from "../src/proxy-names";

const p = (name: string): Proxy => ({ name });

describe("makeProxyNamesUnique", () => {
  it("keeps built-in references even when an input node uses that name", () => {
    const cfg = { proxies: [p("DIRECT")], "proxy-providers": { airport: { proxy: "DIRECT", override: { "dialer-proxy": "DIRECT" } } } };
    rewriteProxyReferences(cfg, makeProxyNamesUnique(cfg.proxies));
    expect(cfg.proxies[0].name).toBe("DIRECT_1");
    expect(cfg["proxy-providers"].airport.proxy).toBe("DIRECT");
    expect(cfg["proxy-providers"].airport.override["dialer-proxy"]).toBe("DIRECT");
  });
  it("reserves all generated names, including future suffix collisions", () => {
    const proxies = [...RESERVED_GROUP_NAMES].map(p);
    proxies.push(p("main_1"), p("main"), p("UK_1"), p("uk"));
    const renamed = makeProxyNamesUnique(proxies);
    expect(new Set(proxies.map((node) => node.name)).size).toBe(proxies.length);
    expect(proxies.every((node) => !RESERVED_GROUP_NAMES.has(node.name))).toBe(true);
    expect(renamed.get("main")).toBe("main_2");
    expect(renamed.get("UK")).toBe("UK_2");
    expect(renamed.get("uk")).toBe("uk_1");
  });
  it("updates inline dialers and provider download/dialer references", () => {
    const cfg = {
      proxies: [p("main"), { name: "UK", "dialer-proxy": "main" }],
      "proxy-providers": { airport: { proxy: "main", "dialer-proxy": "UK", override: { "dialer-proxy": "main" } } },
      "rule-providers": { custom: { proxy: "UK" } },
    };
    rewriteProxyReferences(cfg, makeProxyNamesUnique(cfg.proxies));
    expect(cfg.proxies.map((node) => node.name)).toEqual(["main_1", "UK_1"]);
    expect(cfg.proxies[1]["dialer-proxy"]).toBe("main_1");
    expect(cfg["proxy-providers"].airport).toEqual({ proxy: "main_1", "dialer-proxy": "UK_1", override: { "dialer-proxy": "main_1" } });
    expect(cfg["rule-providers"].custom.proxy).toBe("UK_1");
  });
  it("重名追加 _1/_2 后缀", () => {
    const proxies = [p("节点"), p("节点"), p("节点")];
    makeProxyNamesUnique(proxies);
    expect(proxies.map((x) => x.name)).toEqual(["节点", "节点_1", "节点_2"]);
  });
  it("后缀与既有名冲突时继续递增", () => {
    const proxies = [p("A"), p("A_1"), p("A")];
    makeProxyNamesUnique(proxies);
    expect(new Set(proxies.map((x) => x.name)).size).toBe(3);
  });
});

describe("splitInfoAndNormalProxies", () => {
  it("信息类节点按 INFO_FILTER 分离", () => {
    const { infoProxies, normalProxies } = splitInfoAndNormalProxies(
      [p("剩余流量：10G"), p("官网 example.com"), p("🇭🇰 香港 01")],
      SETTINGS.INFO_FILTER,
    );
    expect(infoProxies.map((x) => x.name)).toEqual([
      "剩余流量：10G",
      "官网 example.com",
    ]);
    expect(normalProxies.map((x) => x.name)).toEqual(["🇭🇰 香港 01"]);
  });
});

describe("classifyProxiesByRegion", () => {
  const proxies = [
    p("🇭🇰 香港 IEPL"),
    p("JP 东京 01"),
    p("Frankfurt 德国"),
    p("神秘节点 X"),
    p("🇭🇰 香港 IEPL"), // 重复名（上游已去重场景外的防御）
  ];
  const result = classifyProxiesByRegion(proxies, REGIONS);

  it("按地区归组", () => {
    expect(result.activeRegionNameSet.has("HK")).toBe(true);
    expect(result.activeRegionNameSet.has("JP")).toBe(true);
    expect(result.activeRegionNameSet.has("EU")).toBe(true);
    expect(result.activeRegionMap.get("HK")!.proxies).toEqual(["🇭🇰 香港 IEPL"]);
  });
  it("未匹配节点进 Other", () => {
    expect(result.otherProxyNames).toEqual(["神秘节点 X"]);
  });
  it("无节点地区不出现", () => {
    expect(result.activeRegionNameSet.has("US")).toBe(false);
  });
});

describe("buildAllAiProxyList", () => {
  const regions = [
    { name: "HK", icon: "", proxies: ["hk1", "hk2"] },
    { name: "JP", icon: "", proxies: ["jp1"] },
  ];
  it("排除 HK 地区节点", () => {
    expect(buildAllAiProxyList(regions, ["other1"], ["hk1", "hk2", "jp1", "other1"])).toEqual([
      "jp1",
      "other1",
    ]);
  });
  it("仅有 HK 时回退全部节点", () => {
    expect(buildAllAiProxyList([regions[0]], [], ["hk1", "hk2"])).toEqual([
      "hk1",
      "hk2",
    ]);
  });
});
