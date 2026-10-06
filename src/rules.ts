import { uniq } from "./utils";
import {
  BLOCK_GOOGLE_QUIC,
  BYPASS_DOMAINS,
  FORCE_PROXY_DOMAINS,
} from "./user-config";

/**
 * 分流规则构建器
 * ------------------------------------------------------------------
 * 规则遵循严格的有序匹配机制（先匹配即生效，越具体的规则越靠前）。
 * 多个版本共享同一份规则骨架，仅通过 RuleTargets 参数化注入不同出口策略组。
 */

/**
 * Google 系 QUIC 阻断规则（UDP 443 → REJECT，迫使客户端立即回落 TCP）。
 * 必须置于所有 Google/AI/YouTube 规则之前；使用 REJECT 而非 REJECT-DROP，
 * 避免浏览器因静默丢包超时等待数秒。
 */
const GOOGLE_QUIC_DOMAINS = [
  "googleapis.com",
  "gstatic.com",
  "google.com",
  "googlevideo.com",
  "youtube.com",
  "ytimg.com",
  "ggpht.com",
];

const googleQuicRule = (enabled: boolean = BLOCK_GOOGLE_QUIC): string[] =>
  enabled
    ? [
        `AND,((NETWORK,udp),(DST-PORT,443),(OR,(${GOOGLE_QUIC_DOMAINS.map(
          (d) => `(DOMAIN-SUFFIX,${d})`,
        ).join(",")}))),REJECT`,
      ]
    : [];

/**
 * 分流出口目标映射接口。
 * 完整版/Bettbox 版独立服务分组，极简版收敛至「全部/AI/广告拦截」三组。
 */
export interface RuleTargets {
  /** 广告出口（REJECT / DIRECT /「广告拦截」组） */
  adblock: string;
  ai: string;
  google: string;
  youtube: string;
  github: string;
  netflix: string;
  tiktok: string;
  telegram: string;
  steam: string;
  apple: string;
  microsoft: string;
  spotify?: string;
  /** 主代理出口（兜底与未指定独立组的国外服务） */
  proxy: string;
  /** 是否阻断 Google QUIC（默认取 user-config BLOCK_GOOGLE_QUIC） */
  blockQuic?: boolean;
}

/**
 * 构建静态分流规则列表。
 * - 顺序敏感：广告拦截 → 自定义 → 游戏直连 → 基础设施 → QUIC阻断 → AI → Google → 业务服务 → GFW → 国内直连 → MATCH
 */
export const buildStaticRules = (t: RuleTargets): string[] => [
  // 广告拦截
  `RULE-SET,category-ads-all,${t.adblock}`,

  // 用户自定义
  ...uniq(BYPASS_DOMAINS).map((d) => `DOMAIN-SUFFIX,${d},DIRECT`),
  ...uniq(FORCE_PROXY_DOMAINS).map((d) => `DOMAIN,${d},${t.proxy}`),

  // 腾讯游戏 / WeGame 直连（防止 TUN 模式干扰游戏登录与联机）
  "DOMAIN-SUFFIX,wegame.com.cn,DIRECT",
  "DOMAIN-KEYWORD,wegame,DIRECT",
  "DOMAIN-SUFFIX,igame.qq.com,DIRECT",
  "DOMAIN-SUFFIX,tgp.qq.com,DIRECT",

  // 基础设施直连
  "RULE-SET,cloudflare,DIRECT",
  "RULE-SET,private,DIRECT",
  "RULE-SET,private-ip,DIRECT,no-resolve",

  // Google QUIC 阻断（必须排在 Google/AI 规则之前）
  ...googleQuicRule(t.blockQuic),

  // AI 独立服务（避免被后续规则误匹配）
  `RULE-SET,openai,${t.ai}`,
  `RULE-SET,anthropic,${t.ai}`,
  `RULE-SET,perplexity,${t.ai}`,
  `RULE-SET,cursor,${t.ai}`,
  `RULE-SET,notion,${t.ai}`,
  `RULE-SET,xai,${t.ai}`,
  `RULE-SET,category-ai,${t.ai}`,

  // Google 服务（严格顺序：googleapis/gstatic 锁定出口，google 优先于 google-cn 匹配）
  `DOMAIN-SUFFIX,googleapis.com,${t.google}`,
  `DOMAIN-SUFFIX,gstatic.com,${t.google}`,
  `RULE-SET,googlefcm,${t.google}`,
  `RULE-SET,youtube,${t.youtube}`,
  `RULE-SET,google,${t.google}`,
  `RULE-SET,google-ip,${t.google},no-resolve`,
  "RULE-SET,google-cn,DIRECT",

  // Hybrid 独立业务服务
  `RULE-SET,github,${t.github}`,
  `RULE-SET,netflix,${t.netflix}`,
  `RULE-SET,netflix-ip,${t.netflix},no-resolve`,
  `RULE-SET,tiktok,${t.tiktok}`,

  // Telegram 通讯服务
  `RULE-SET,telegram,${t.telegram}`,
  `RULE-SET,telegram-ip,${t.telegram},no-resolve`,

  // Steam（下载 CDN 强制直连以跑满本地带宽，商店/社区走代理）
  "DOMAIN-SUFFIX,steamcontent.com,DIRECT",
  "DOMAIN-SUFFIX,steamserver.net,DIRECT",
  "DOMAIN-SUFFIX,steampipe.akamaized.net,DIRECT",
  "RULE-SET,steam-cn,DIRECT",
  `RULE-SET,steam,${t.steam}`,

  // Apple & Microsoft（国区 CDN / 更新直连，全球走代理）
  "RULE-SET,apple-cn,DIRECT",
  `RULE-SET,apple,${t.apple}`,
  "RULE-SET,microsoft-cn,DIRECT",
  `RULE-SET,microsoft,${t.microsoft}`,

  // 流媒体服务
  `RULE-SET,spotify,${t.spotify ?? t.proxy}`,

  // 网络连通性检测与时间同步直连
  "RULE-SET,connectivity-check,DIRECT",
  "RULE-SET,category-ntp,DIRECT",

  // 境外与境内兜底
  `RULE-SET,gfw,${t.proxy}`,
  "RULE-SET,cn,DIRECT",
  "RULE-SET,cn-ip,DIRECT,no-resolve",
  `MATCH,${t.proxy}`,
];

/**
 * 合并用户既有规则中的 DIRECT 规则到 MATCH 之前，保持向后兼容。
 */
export const mergeRules = (
  baseRules: string[] = [],
  extraRules: string[] = [],
): string[] => {
  const extra = Array.isArray(extraRules)
    ? extraRules.filter((rule) => rule && !isMatchRule(rule))
        .map((rule) => normalizeDirectRule(rule) ?? rule)
    : [];
  const match = baseRules.find(isMatchRule);
  return uniq([
    ...baseRules.filter((rule) => !isMatchRule(rule)),
    ...extra,
    ...(match ? [match] : []),
  ]);
};

const isMatchRule = (rule: string): boolean => /^MATCH\s*,/i.test(String(rule).trim());

// Mihomo ordinary rules use TYPE,payload,target[,params]. SUB-RULE's third
// field names another rule list, not an outbound target, so it is not inherited.
const ORDINARY_RULE_TYPES = new Set([
  "DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD", "DOMAIN-REGEX", "DOMAIN-WILDCARD",
  "GEOSITE", "GEOIP", "SRC-GEOIP", "IP-ASN", "SRC-IP-ASN",
  "IP-CIDR", "IP-CIDR6", "SRC-IP-CIDR", "IP-SUFFIX", "SRC-IP-SUFFIX",
  "DST-PORT", "SRC-PORT", "IN-PORT", "DSCP", "PROCESS-NAME", "PROCESS-PATH",
  "PROCESS-NAME-REGEX", "PROCESS-PATH-REGEX", "PROCESS-NAME-WILDCARD",
  "PROCESS-PATH-WILDCARD", "NETWORK", "UID", "IN-TYPE", "IN-USER", "IN-NAME",
  "REMATCH-NAME", "RULE-SET",
]);

/** Locate only the outbound field; commas inside logical payloads are nested. */
const normalizeDirectRule = (rule: string): string | undefined => {
  const r = String(rule || "").trim();
  if (!r || r.startsWith("#") || isMatchRule(r)) return undefined;
  const type = r.slice(0, r.indexOf(",")).trim();
  let fields: string[];
  if (type === "AND" || type === "OR" || type === "NOT") {
    fields = [];
    let depth = 0, start = 0;
    for (let i = 0; i < r.length; i++) {
      if (r[i] === "(") depth++;
      else if (r[i] === ")" && --depth < 0) return undefined;
      else if (r[i] === "," && depth === 0) {
        fields.push(r.slice(start, i));
        start = i + 1;
      }
    }
    if (depth !== 0) return undefined;
    fields.push(r.slice(start));
    if (!fields[1]?.trim().startsWith("(")) return undefined;
  } else {
    if (!ORDINARY_RULE_TYPES.has(type)) return undefined;
    fields = r.split(",");
  }
  if (!fields[1]?.trim() || fields[2]?.trim().toUpperCase() !== "DIRECT")
    return undefined;
  fields[2] = "DIRECT";
  return fields.join(",");
};

/** Preserve DIRECT exceptions by target field and canonicalize the built-in name. */
export const pickDirectRules = (rules: string[] = []): string[] =>
  rules.flatMap((rule) => {
    const normalized = normalizeDirectRule(rule);
    return normalized === undefined ? [] : [normalized];
  });
