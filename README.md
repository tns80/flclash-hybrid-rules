# flclash-hybrid-rules

项目仓库：[tns80/flclash-hybrid-rules](https://github.com/tns80/flclash-hybrid-rules)

Upstream: [wchiway/mihomo-proxy](https://github.com/wchiway/mihomo-proxy)

本项目基于原作者 wchiway 的 mihomo-proxy，保留原项目源码、测试体系和许可证（见 LICENSE）。

FlClash Hybrid 脚本地址：
https://raw.githubusercontent.com/tns80/flclash-hybrid-rules/refs/heads/main/bettbox-flclash.js

后续更新可使用 git fetch upstream，并在人工审查后合并 upstream/main。

mihomo（Clash Meta）配置增强脚本 · v3.2.2 Hybrid

在 Sparkle / Clash Verge Rev（电脑）或 FlClash（手机）中作为**覆写脚本**加载，自动完成节点分组、服务级分流、DNS 防泄露分流与 TUN/Sniffer 网络优化。主要面向国内复杂网络（含校园网）与多地区机场订阅，目标是改善 Google 全家桶 / AI / 流媒体的稳定性，并减少非预期 DNS 解析路径；脚本不能保证所有系统与 App 场景都没有 DNS 泄露。

---

## 四个版本，按需选择

|                      | mihomo-proxy.js（完整版）                                    | simple-mihomo.js（极简版）         | flclash-mobile.js（FlClash 极简版） | bettbox-flclash.js（Bettbox / FlClash Hybrid） |
| -------------------- | ------------------------------------------------------------ | ---------------------------------- | ----------------------------------- | ---------------------------------------- |
| 目标客户端           | Sparkle / Clash Verge Rev                                    | Sparkle / Clash Verge Rev          | **FlClash**（手机 / 极简用户）      | **Bettbox** / **FlClash**（全平台）      |
| 策略组数量           | 20+（地区组 + 服务组）                                       | 3 个                               | 3 个                                | 20+（完整服务组 + 地区组）               |
| 地区分组             | HK / TW / JP / SG / KR / US / EU / AU / AS + Other           | 无                                 | 无                                  | HK / TW / JP / SG / KR / US / CA / UK / EU / AU / AS + Other（可开关） |
| 服务组               | Google / YouTube / AI / Telegram / Steam / Apple / Microsoft | 统一收敛到「全部」                 | 统一收敛到「全部」                  | Google / YouTube / GitHub / Netflix / TikTok / AI / Telegram / Steam / Apple / Microsoft / Spotify / 广告拦截（各可独立开关） |
| 节点纳入方式         | 脚本枚举节点名（可排序）                                     | 脚本枚举节点名（可排序）           | 内核 `include-all` 运行时纳入       | 内核 `include-all` 运行时纳入            |
| proxy-providers 订阅 | 不支持（只读 `proxies`）                                     | 不支持                             | ✅ 支持                             | ✅ 支持                                  |
| 订阅增删节点         | 需重新应用脚本                                               | 需重新应用脚本                     | ✅ 自动跟随                         | ✅ 自动跟随                              |
| AI 纯净池            | ✅ 剔除香港                                                  | ✅ 剔除香港                        | ✅ 剔除香港                         | ✅ 剔除香港（可开关）                    |
| 广告拦截             | 固定 REJECT                                                  | 「广告拦截」组可切 REJECT / DIRECT | 同极简版                            | 「广告拦截」组可切 REJECT / DIRECT / main（可开关） |
| UI 可视化开关        | ❌ 无                                                        | ❌ 无                              | ❌ 无                               | ✅ 原生适配（`Compatible_With_Bettbox`） |
| 分流规则 / DNS / TUN | 同一套                                                       | 同一套                             | 同一套                              | 同一套                                   |
| 适合人群             | 想精细控制每类服务出口（桌面端）                             | 只想选个节点就用（桌面端）         | 手机上用，追求极简与省电            | **Bettbox / FlClash 用户，既要完整分流与地区分组，又要免重载与可视化开关** |

```text
# 完整版（桌面端）
https://raw.githubusercontent.com/tns80/flclash-hybrid-rules/refs/heads/main/mihomo-proxy.js

# 极简版（桌面端）
https://raw.githubusercontent.com/tns80/flclash-hybrid-rules/refs/heads/main/simple-mihomo.js

# 手机版（FlClash 极简版）
https://raw.githubusercontent.com/tns80/flclash-hybrid-rules/refs/heads/main/flclash-mobile.js

# Bettbox / FlClash 系列专属版（完整分流 + 地区分组 + 可视化开关）
https://raw.githubusercontent.com/tns80/flclash-hybrid-rules/refs/heads/main/bettbox-flclash.js
```

---

## 功能特性

### 1. 节点自动分类与排序

- 地区识别：中英文名 / 缩写 / 国旗 emoji 均可识别；Hybrid 地区组为 HK / TW / JP / SG / KR / US / CA / UK / EU / AU / AS / Other
- 线路识别：IEPL / IPLC / BGP / 游戏 / 家宽（住宅）
- 倍率识别：`0.2x`、`1倍`、`2X` 等计费倍率
- 组内自动排序：专线优先 → 低倍率优先 → 名称序
- 信息类节点（到期 / 官网 / 剩余流量）自动分离，不混入代理组
- 重名节点自动加 `_1 / _2` 后缀去冲突

### 2. 策略组

完整版自动生成：

- `main`（主入口）/ `All`（全量 + 自动测速）/ `GLOBAL`（总览）
- `AI`：非香港纯净池（OpenAI / Claude / Gemini / Perplexity / Cursor / Notion / Copilot）
- `Google` / `YouTube`：独立分流，不依赖 GFW 列表
- `Telegram`：SG 优先 + fallback 自愈
- `Steam` / `Apple` / `Microsoft`：国区直连 + 全球走代理，可一键切 DIRECT
- 各地区 URL-Test 自动测速组（隐藏，供地区组引用）

极简版仅三组：

- `全部`：所有节点 + 内置「自动测速」（默认自动选优）
- `AI`：剔除香港的纯净节点池 + 独立自动测速
- `广告拦截`：REJECT（默认）/ DIRECT / 全部

手机版（FlClash）与极简版同名三组，区别在于节点不由脚本枚举，而是写
`include-all: true` + `exclude-filter` 让**内核在运行时纳入**：订阅更新或机场
增删节点后无需重新应用脚本，`proxy-providers` 型订阅也能正确分组，
生成的配置里不含成百上千行节点名，手机上加载更快。测速间隔放宽到 600s、
容差 80ms，降低后台唤醒频率与移动网络抖动导致的频繁切换。

Bettbox / FlClash v3.2.2 Hybrid（`bettbox-flclash.js`）：

兼具桌面完整版的丰富策略组与移动端的轻量动态架构：
- **完整策略组体系**：`main`（主入口）/ `All` / `GLOBAL`，服务组为 `Google` / `YouTube` / `GitHub` / `Netflix` / `TikTok` / `AI`（排除香港）/ `Telegram` / `Steam` / `Apple` / `Microsoft` / `Spotify` / `广告拦截`
- **地区自动分组**：HK / TW / JP / SG / KR / US / CA / UK / EU / AU / AS / `Other`（非地区节点），每组包含专属隐藏自动测速与手动选择
- **节点动态纳入**：采用 `include-all: true` + 地区 `filter` 与通用 `exclude-filter`，订阅更新或节点变动无需重新应用脚本，全面兼容 `proxy-providers` 订阅
- **Bettbox 可视化开关原生适配**：脚本首行声明 `const Compatible_With_Bettbox = { ruleOptionsEnable: true };`，在 Bettbox（v1.18.8+）客户端覆写面板中直接呈现可视化开关，用户无需改动代码即可一键启闭任意服务分流组或地区分组（业务服务关闭后回流 `main`；广告拦截关闭后规则目标为 `DIRECT`，直接放行）

### 节点保留名与动态 provider 限制

四版共享 RESERVED_GROUP_NAMES，包含服务/地区/测速组、Telegram - Fallback、info、极简组名及内核内置目标。内联撞名节点改为唯一后缀名称，例如 UK → UK_1；若 UK_1 已存在则继续递增，并更新支持的 dialer-proxy / provider 下载引用。内置 DIRECT 等引用保持内置目标语义。

Bettbox/FlClash 的 include-all filter 在节点应用 provider override 后，仅排除完整名称与脚本生成的策略组/保留名称相同的动态节点（不区分大小写），以避免 Mihomo duplicate name 导致整个配置无法加载。这不是包含关键词就过滤：保留名 UK 会排除 UK，但保留 UK_01、UK 01、Premium UK、UK-HOME；AI 同理不会误伤仅包含相同字母片段的普通节点名。过滤不枚举 provider 内容，也不误删显式测速组引用，HTTP/file/inline provider 的更新仍会动态生效。**限制：** 脚本不会自动重命名动态 provider 节点，被排除的撞名节点不能从这些动态池选择。如需使用该节点，请在机场订阅或 provider override 中将最终节点名称改为非保留名。此来源的状态为 SAFE DEGRADATION / KNOWN LIMITATION。

地区短代码使用 ASCII 字母边界，不依赖 JS/regexp2 的 Unicode 词边界差异；空格、-、_、|、[]、()、数字均可分隔。CA 保持国家/城市/机场名识别，不新增裸 CA。混合多个国家标记的歧义节点名仍应由机场规范命名。

### 3. DNS 架构（防泄露 Smart 分流）

- Fake-IP 黑名单模式，黑名单仅保留：private / cn / lan / stun / ntp / 非 Google 系统联网探测
- `respect-rules: true`：DNS 出口遵循分流规则
- 防泄露三级白名单（`nameserver-policy` 按序匹配）：
  1. 内网/私有域名 → 系统 DNS + 国内 DoH（兼容校园网内网）
  2. 需翻墙域名族（Google / YouTube / GitHub / Netflix / TikTok / AI / GFW / Telegram / Spotify）→ 国际 DoH
  3. 国内域名族（cn / apple-cn / google-cn / microsoft-cn / steam-cn）→ 国内 DoH（AliDNS / DNSPod）
- **默认上游 = 国际 DoH（Cloudflare 1.1.1.1 + Quad9 9.9.9.9，IP 地址形式），连接遵循路由规则**——
  已列入国际 policy 的服务使用该上游；实际出站还受策略组选择、客户端后处理和系统网络设置影响
- `proxy-server-nameserver` = 国内加密 DoH：独立解析节点域名；可达性仍取决于网络与上游服务
- `ipv6: false`：关闭 AAAA 解析，规避国内 IPv6 链路不稳定导致的查询超时卡顿
- 不继承订阅 `fallback`、`fallback-filter`、`fallback-lazy-query` 或旧 `proxy-server-nameserver-policy`，避免引入另一套解析路径。Mihomo 的 fallback 也可遵循 respect-rules，不能把它无条件等同于直连泄露

### DNS 遗留字段策略（Mihomo v1.19.32 schema）

| 处理 | 字段 |
| --- | --- |
| 清除 | fallback、fallback-filter（含 geoip/geoip-code/geosite/ipcidr/domain）、fallback-lazy-query、proxy-server-nameserver-policy |
| 由脚本重建 | nameserver、proxy-server-nameserver、direct-nameserver、direct-nameserver-follow-policy、nameserver-policy、default-nameserver、enhanced-mode、fake-ip-range / fake-ip-range6、fake-ip-filter-mode |
| 显式合并 | fake-ip-filter：仅源配置未指定 mode 或使用 blacklist 时继承并去重；whitelist/rule 的条目不能直接解释为 blacklist，故不继承 |
| 保持现有脚本值 | enable、listen、ipv6、cache-algorithm、prefer-h3、use-hosts、use-system-hosts、respect-rules |
| 继承兼容调节参数 | cache-max-size、fake-ip-ttl、ipv6-timeout、listen-routing-mark |

脚本没有盲目丢弃整个 dns 对象；当前 schema 的解析路径字段分别重建或清除。未来新增字段需要重新审查。

### 4. 分流规则要点

- Google FCM 走代理（防推送断流）
- Hybrid 的 GitHub、Netflix（domain + IP）、TikTok 各有独立策略组，默认启用；关闭后回退 main
- **全球 `google` 优先于 `google-cn` 匹配**：google-cn 列表混有
  connectivitycheck.gstatic.com / fonts.googleapis.com 等全球关键域名（其国内 CDN 已失效），
  先代理后直连可避免 YouTube「未联网」、Chrome 商店卡死、页面白屏
- AI 域名独立分流（openai / anthropic / perplexity / cursor / notion / category-ai），不依赖 GFW 列表
- 腾讯游戏 / WeGame 直连（wegame / igame.qq.com / tgp.qq.com），DNS 同步走国内解析并豁免 fake-ip，防止登录校验异常与联机故障
- steam-cn / apple-cn / microsoft-cn 直连（`-cn` 为脚本内部逻辑名，实际映射远端 `@cn` 文件）
- 广告拦截（category-ads-all）；Cloudflare Analytics（cloudflareinsights.com）前置直连防误杀，
  人机验证页（challenges.cloudflare.com）**刻意跟随主站路由**——保持 Turnstile 校验 IP 与主站一致，避免触发风控
- 保留用户配置中已有的自定义 DIRECT 规则（合并到 MATCH 之前）

### 5. 网络增强

- TUN：mixed 栈 / strict-route = true（严格接管 TUN 路由）/ endpoint-independent-nat / dns-hijack / MTU 1500
- Runtime：tcp-concurrent / unified-delay / store-selected / log-level warning
- Sniffer：HTTP + TLS + QUIC(HTTP/3)。全局 `override-destination=false`；HTTP 单独为 false，TLS / QUIC 单独为 true，并覆盖全局默认值

---

## 使用方法

### 电脑（Sparkle / Clash Verge Rev）

1. 打开客户端的「覆写 / 扩展脚本」设置
2. 添加完整版或极简版脚本链接（或下载后本地引用）
3. 应用到订阅配置，重启内核（建议 TUN 模式）

### 手机与全平台客户端（Bettbox / FlClash）

1. 设置 → 高级设置 → **脚本** → 添加 → 右上角远程下载脚本链接：
   - 想要完整策略组 + 可视化开关：使用 `bettbox-flclash.js` 链接
   - 想要极简三组：使用 `flclash-mobile.js` 链接
   - 保存脚本
2. 配置 → 选中你的订阅 → **覆写** → 模式选「**脚本**」→ 勾选刚添加的脚本
3. **（Bettbox 独占）可视化开关**：如果使用 Bettbox（v1.18.8+），进入该覆写设置界面可直接看到可视化开关面板，直接勾选/取消勾选即可动态控制各分流策略组与地区分组的启闭
4. 回到首页启动代理

**必须核对的 App 设置**（这些字段由 FlClash/Bettbox 在脚本执行后强制改写，
脚本内写什么都不生效，详见 `src/flclash-main.ts` / `src/bettbox-main.ts` 顶部注释）：

| App 设置项                   | 应设为          | 不这么设的后果                                          |
| ---------------------------- | --------------- | ------------------------------------------------------- |
| 设置 → 网络 → **覆写 DNS**   | **关闭**（默认）| 打开会按客户端版本/所选字段覆盖脚本 DNS 配置    |
| 设置 → 网络 → **追加系统 DNS** | **关闭**（默认）| 打开会向 `nameserver` 注入 `system://`，增加系统解析路径 |
| 出站模式                     | 规则            | 全局 / 直连会绕开分流规则                               |
| TUN 栈                       | mixed           | 其他栈在部分机型上兼容性较差                            |
| 查找进程                     | off             | 手机端无进程规则，开启（App 默认 always）徒增开销       |

其余如 log-level / ipv6 / 各端口 / tcp-concurrent / unified-delay /
keep-alive-interval / 「记住选择」等，同样以 App 设置为准。
被保留的部分是脚本的核心价值：分流规则、策略组、规则集、DNS、Sniffer、hosts。

脚本会在订阅加载时自动：重建 proxy-groups → 注入 rule-providers → 重写 dns / tun / sniffer / runtime。

### 自定义

自定义常量位于 `src/user-config.ts`（四版共享）：

```ts
/** 强制直连的域名（后缀匹配），示例：["mycompany.com", "internal.example"] */
export const BYPASS_DOMAINS: string[] = [];
/** 强制走代理的域名（精确匹配；完整版走 main 组，极简版走「全部」组） */
export const FORCE_PROXY_DOMAINS: string[] = [];
/** 需要从订阅中剔除的节点名过滤器（正则） */
export const CUSTOM_FILTER = /示例占位符1|示例占位符2|示例占位符3/i;
```

两种修改方式：

1. **推荐**：改 `src/user-config.ts` 后 `pnpm build` 重新生成（改动进入四份产物且不会丢失）
2. **临时**：直接编辑产物 JS 顶部的同名常量（在 IIFE 内第一段）——注意
   下次 `pnpm build` 会覆盖手改内容

手机版的 `CUSTOM_FILTER` 会被编译进策略组的 `exclude-filter`（由内核用
regexp2 匹配），所以自定义时注意别让它命中「自动测速」「AI 自动测速」
这两个组名，否则组内会缺少测速入口。

---

## 常见问题

**Q：如何确认没有 DNS 泄露？**
用 [browserleaks.com/dns](https://browserleaks.com/dns) 或 [ipleak.net](https://ipleak.net) 复测，并结合实际生成的 DNS 配置、连接日志和出口判断。AliDNS / DNSPod 是脚本主动配置的国内 DoH，看到它们本身不能单独证明泄露；重点检查非预期的本地运营商 DNS 或其他非设计解析路径。Chrome / Edge 的「安全 DNS」会使用浏览器自己的 DoH 上游；TUN 可能路由这条 HTTPS 连接，但不能使其自动遵循脚本的 nameserver-policy。需要统一 policy 时可关闭浏览器安全 DNS，再复测。

**Q：导入后所有节点超时？**
节点服务器域名解析失败是可能原因之一。脚本使用国内加密 DoH 独立解析节点域名；实际可达性仍需核查。若机场域名解析异常，可检查节点域名、上游响应与客户端最终配置。

**Q：YouTube 提示「未联网」/ Google 页面白屏？**
本脚本已通过规则顺序修复（google 先于 google-cn）。若仍出现，清一次浏览器 DNS 缓存（`chrome://net-internals/#dns`）并重启 TUN。

**Q：校园网 / 弱网卡顿？**
将脚本中 TUN 的 `mtu: 1500` 下调为 `1280`。

**Q：想改地区顺序 / 测速参数？**
完整版调整 `SETTINGS.REGION_ORDER` 与 `URL_TEST_EXTRA`；极简版调整 `SETTINGS.URL_TEST_EXTRA`；
手机版调整 `SETTINGS.MOBILE_URL_TEST_EXTRA`。

**Q：FlClash 里策略组是空的 / 只有 DIRECT？**
先确认订阅本身有节点（配置页能看到节点列表）。手机版靠内核 `include-all` 纳入节点，
只有当订阅既无 `proxies` 也无 `proxy-providers` 时才会回退成 DIRECT。
若节点存在却被过滤光，检查 `CUSTOM_FILTER` 是否写得过宽（它会进 `exclude-filter`）。

**Q：手机上 DNS 泄露测试仍显示国内解析商？**
先检查 App 的「覆写 DNS」「追加系统 DNS」、系统 Private DNS，以及浏览器安全 DNS，再核对实际生成配置。国内 DoH 是主动设计的一部分，不能只看解析商名称就认定泄露。App 的这些选项会在脚本执行之后改写 DNS 配置。

**Android / Samsung Private DNS：** 若目标是让查询统一受 Mihomo nameserver-policy 控制，建议在系统网络设置中关闭自定义 Private DNS / DoT，具体菜单因机型和版本而异。DoT 请求可能脱离 Mihomo DNS 模块的统一 policy 控制，53 端口的 dns-hijack 不能解密这类请求；实际流量路由仍需真机核实。

---

## 注意事项

- 需要 mihomo（Clash Meta）内核；系统代理模式下 fake-ip 不生效，建议 TUN 模式
- 会覆盖订阅中的 proxy-groups / rules / dns / tun / sniffer 配置
- 手机版仅适用于支持 JS 覆写脚本的 **FlClash v0.8.85+**；Clash Meta for Android
  等不提供脚本覆写能力的客户端无法使用（可改用其内置的覆写/配置合并功能）
- 规则集使用 MetaCubeX meta-rules-dat 的 `.mrs` 格式，首次加载需联网下载
- 脚本内多处注释标注了「顺序关键 / 语法注意」的段落（google-cn 顺序、
  nameserver-policy 单前缀写法等），修改前请先阅读注释，均为实测踩坑结论

---

## 项目结构

```text
mihomo-proxy.js    # 完整版（构建产物，请勿手改）
simple-mihomo.js   # 极简版（构建产物，请勿手改）
flclash-mobile.js  # 手机极简版 / FlClash（构建产物，请勿手改）
bettbox-flclash.js # Bettbox / FlClash 专属版（构建产物，请勿手改）
src/               # 四版共享的 TypeScript 源码
├── index.ts       #   完整版打包入口
├── simple.ts      #   极简版打包入口
├── flclash.ts     #   手机极简版打包入口
├── bettbox.ts     #   Bettbox 专属版打包入口
├── main.ts        #   完整版主流程（服务级独立策略组）
├── simple-main.ts #   极简版主流程（全部 / AI / 广告拦截 三组）
├── flclash-main.ts#   手机极简版主流程（同三组，节点走内核 include-all）
├── bettbox-main.ts#   Bettbox 专属版主流程（全量服务组 + 地区组 + 可视化开关适配）
├── user-config.ts #   用户自定义区（四版共享）
├── settings.ts    #   常量配置（SETTINGS / DNS_SERVERS / Fake-IP）
├── utils.ts       #   工具函数（倍率/线路解析缓存等）
├── regions.ts     #   地区定义（完整版用）
├── rule-providers.ts # 规则集（key ↔ 远端文件名解耦）
├── rules.ts       #   分流规则骨架（出口目标参数化，四版注入各自策略组名）
├── proxies.ts     #   节点分类
├── proxy-groups.ts#   完整版策略组生成
├── dns.ts         #   DNS 防泄露架构
├── runtime.ts     #   Runtime / Sniffer / TUN
└── types.ts       #   类型定义
tests/             # vitest 单元测试（工具函数 / 规则 / 节点分类）
scripts/verify.mjs         # 第 1 级校验：node:vm 冒烟断言 + YAML 导出
scripts/verify-kernel.mjs  # 第 2 级校验：真实 mihomo 内核 -t
scripts/verify-runtime.mjs # 第 3 级校验：启动内核查 API，验策略组运行时成员
vite.config.ts     # Vite 8 库模式四产物构建配置
.github/workflows/ci.yml  # CI：类型检查 → 单测 → 构建 → 内核校验 → 产物提交/一致性（main post-push validation）
```

---

## 构建与开发（Vite 8 全 Rust 工具链）

四份产物均由 **Vite 8 + TypeScript** 从同一份 `src/` 构建生成——规则骨架、
规则集、DNS、TUN 在源码层共享，**构建期即保证四版一致，不再手工同步**。
Vite 8 已用 Rolldown（打包）+ Oxc（转换/压缩）的全 Rust 工具链取代
esbuild + Rollup,本项目直接使用其原生配置（`rolldownOptions`）。

```bash
pnpm install        # 安装依赖（Node 20+ / pnpm 11+，lock 文件已入库）
pnpm typecheck      # tsc 类型检查
pnpm test           # vitest 单元测试
pnpm build          # 四产物构建 → node:vm 冒烟断言 → 同步到仓库根目录
pnpm verify:kernel  # 真实内核 -t 校验（需本地 mihomo 或设 MIHOMO_BIN）
pnpm verify:runtime # 启动内核查 API，验 include-all / exclude-filter 实际生效
```

构建约束（面向 boa_engine 与 QuickJS 两种宿主运行时）：

- 产物为**单文件普通脚本**（非 ESM），以 IIFE 打包并由 footer 注入顶层
  `main(config, profileName)`。Sparkle / Clash Verge Rev 以
  `{script}; main(config, name)` 求值；FlClash（flutter_js → QuickJS）以
  `{script}\nmain(config)` 求值，只传 1 个参数，同一份桥接同时满足两者
- target ES2020（boa 与 QuickJS 均支持 90%+ 最新 ES 规范），`minify: false`
  保留全部中文注释，产物可读可审计
- 第 1 级 `node:vm` 裸沙箱验证四版规则/DNS/策略组及边界输入，通过后导出 YAML 并同步四份产物到本地仓库根目录；第 2 级使用真实 Mihomo `-t` 检查配置可解析；第 3 级启动关闭 TUN 的内核，检查 `/proxies`、本地 DNS 与 HTTP fixture。CI 对 main push 执行 post-push validation，对 PR 执行验证和产物一致性检查；没有 branch protection 时，这不是阻止未经验证 commit 进入 main 的发布前 Gate。
- runtime fixture 使用本地 proxy-provider、inline rule-provider 与本地 DNS/HTTP 响应器。PASS 不代表真实 TUN 流量、生产 DoH 路由或 Android 真机 DNS leak PASS；未执行的场景为 NOT_RUN。

---

## 更新日志

### v3.2.2 Hybrid（2026-10）

- 修复原订阅 DIRECT 策略目标大小写不规范导致 Mihomo `proxy [Direct] not found`。
- preserved DIRECT 现在按目标字段识别并规范为内置 `DIRECT`。
- 防止匹配参数中出现 DIRECT 时被误判为 DIRECT 出口规则。

### v3.2.1 Hybrid（2026-10）

- 清理原订阅备用 DNS 路径和节点解析 policy，保留兼容的 Fake-IP blacklist、TTL/cache/listener 参数。
- 禁止继承任何 MATCH，保留普通 DIRECT 例外，最终 MATCH 由脚本独占。
- 内联节点与保留组名冲突时加后缀，并更新节点/provider 的 dialer/download 引用；DIRECT 等内置目标引用保持原义。
- 动态 provider 的保留名节点从 include-all 池中排除，显式组引用保持有效；撞名节点仍需机场或用户 provider override 改名，节点可用性修复为 PARTIAL。
- 地区 ASCII token 边界统一，支持空格、连字符、下划线、竖线、括号和数字，恢复 GB；CA 仍不采用裸 CA。
- 广告拦截 OFF → DIRECT；更新 DNS、Sniffer、CI 说明和 MIT 元数据。

### v3.2 Hybrid（2026-10）

- GitHub 独立策略组。
- Netflix domain + IP 独立策略组。
- TikTok 独立策略组。
- 新增 CA 地区组、UK 地区组；UK 从 EU 独立，Other 自动排除已识别地区。
- `strict-route = true`，保留现有 mixed 栈和 DNS hijack。
- github / netflix / tiktok 纳入 GLOBAL_DOH policy；国际 DoH 为 Cloudflare 1.1.1.1 + Quad9 9.9.9.9。
- 保留 include-all / proxy-providers 动态节点架构，订阅增删节点无需重新执行脚本。
- 本次发布对齐文档、banner 和版本元信息，不改变现有网络运行逻辑。

### v3.1（2026-09）

- **新增 Bettbox / FlClash 系列专属版 `bettbox-flclash.js`**：
  - 首行适配 Bettbox 的 `Compatible_With_Bettbox = { ruleOptionsEnable: true }` 可视化配置开关声明，在客户端 UI 中直接呈现可视化控制面板
  - 继承 `include-all` + `filter` / `exclude-filter` 模式：所有订阅节点在内核运行时自动归类，订阅更新与节点变动无需手动重新应用脚本，全面兼容 `proxy-providers` 订阅
  - 支持全套精细独立分流策略组（Google / YouTube / AI / Telegram / Steam / Apple / Microsoft / Spotify / 广告拦截 / GLOBAL）
  - 支持按地区自动分组（HK / TW / JP / SG / KR / US / EU / AU / AS 与 Other），每组包含专属隐藏自动测速与手动选择
  - 每个分流服务组与地区分组均与 Bettbox 可视化开关深度联动，关闭后流量自动平滑回退至 `main` 组
  - CI 与三级校验测试流水线升级为四产物全覆盖（增加 40+ 项 Bettbox 专属断言与内核 `-t` 校验）

### v3.0（2026-08）

对齐内核 **v1.19.30**（当前稳定版）新增能力，并修掉两处配置层面的隐患。
三版产物版本号统一为 v3.0（此前手机版单独记作 v1.0，同源产物版本不一致易误导）。

- **DNS 补上直连解析这条路径**：新增 `direct-nameserver`（system + 国内 DoH）
  与 `direct-nameserver-follow-policy: true`。此前默认 `nameserver` 是国际 DoH，
  凡是「走直连但又不在 `nameserver-policy` 白名单里」的域名——用户
  `BYPASS_DOMAINS`、`DOMAIN-KEYWORD,wegame`、`connectivity-check` 集合等——
  解析都会绕到境外再经代理回来，慢且拿到境外 CDN 边缘节点。
  follow-policy 保持开启是关键：google / gfw / AI 族即使被用户规则改判直连，
  仍用国际 DoH 解析，不会退化成被污染的国内结果
- **健康检查锁定 `expected-status: 204`**：测速地址是 `generate_204`，
  而内核默认 `expected-status` 为 `*`（任何响应都算通过），
  酒店 / 校园网门户劫持返回 200 页面时节点会被误判为可用
- **手机版 include-all 测速组新增 `empty-fallback: DIRECT`**（内核 v1.19.27+）：
  `CUSTOM_FILTER` 写太宽导致组被过滤空时，兜底在 App 里直接可见，
  且与「无节点来源」分支的 DIRECT 回退一致
  （另：内核的 `COMPATIBLE` 实为 `outbound.NewCompatible()` 返回的 `Direct`，
  行为等同直连而非失败，源码注释中的旧说法已勘误）
- **策略组新增 `default-selected`**（内核 v1.19.28+）：把「默认选中自动测速组」
  写成显式语义，不再依赖内核 `selectedProxy()` 找不到选中项时返回
  `proxies[0]` 的隐式行为，成员顺序调整时默认项不再跟着漂
- **修复 sniffer 端口区间重叠**：HTTP 的 `8080-8880` 覆盖了 TLS 的 `8443`，
  两者同为 TCP 且 `override-destination` 取值相反，重叠即行为不确定
  （内核 v1.19.30 的 `coordinate TCP sniffers on overlapping ports` 才把
  这类冲突理顺）。现拆为 `8080-8442` + `8444-8880`，8443 单独留给 TLS
- 新增 `xai` 规则集（Grok），并入 AI 分流与国际 DoH 解析白名单
- 校验加强：
  - 第 1 级移植内核 `ValidAndSplitDomain` 做域名通配语法回归
    （v1.19.30 起 `+` 只能是多段域名首个完整段、`*` 只能是完整一段，
    写错直接 `invalid domain`），覆盖 `fake-ip-filter` / `nameserver-policy`
    键 / `hosts` 键 / `skip-domain`；另加 sniffer 端口互斥、
    `expected-status`、`default-selected` 成员合法性、
    `empty-fallback` 不得填策略组等断言
  - 第 3 级新增运行时断言并按内核版本 gate：`expected-status` /
    `empty-fallback` / `default-selected` 这三个字段旧内核会**静默忽略
    且 `-t` 照样通过**，只有查 `/proxies` API 才能区分"写了"和"生效了"。
    已在 v1.19.30 与 v1.19.25 上分别验证（后者自动跳过新字段断言）
  - 探针配置关闭 `store-selected`，避免缓存里的历史选择盖掉 `default-selected`

### v2.4（2026-07）

- **新增手机版 `flclash-mobile.js`（FlClash 专用）**：与极简版同名三组、
  同一套分流规则 / DNS 防泄露 / Sniffer 源码（构建期保证三版一致），
  但节点改由内核 `include-all` + `exclude-filter` 在运行时纳入：
  - 订阅更新、机场增删节点后无需重新应用脚本
  - 支持 `proxy-providers` 型订阅（手机端常见，旧两版只读 `proxies` 会分组为空）
  - 生成的配置不再内联成百上千行节点名，手机上加载更快
  - 测速间隔 600s / 容差 80ms，降低后台唤醒与移动网络抖动导致的频繁切换
- 适配 FlClash 运行时（flutter_js → QuickJS，`main(config)` 单参数调用）；
  README 补充 FlClash 会在脚本执行后强制改写的字段清单与对应 App 设置指引
  （「覆写 DNS」「追加系统 DNS」若被打开会破坏防泄露架构，属首要排查项）
- 新增第 3 级校验 `pnpm verify:runtime`：实际启动内核并查 `/proxies` API，
  断言 `include-all` 确实纳入订阅节点、不含 DIRECT/REJECT（否则自动测速会把
  直连当成最快节点选中）、信息类节点与香港节点被正确排除——这类运行时行为
  是 `-t` 配置测试的盲区

### v2.3（2026-07）

- 工程化：拆分为 `src/` TypeScript 模块，Vite 8（Rolldown + Oxc
  全 Rust 工具链，不再使用 esbuild/Rollup）库模式打包回单文件
- **双版本统一构建**：极简版（v1.2）与完整版共享同一份规则骨架 /
  规则集 / DNS / TUN 源码，出口目标参数化注入，构建期保证两版一致
  （彻底解决历史上两文件手工同步导致的漂移）
- 新增 Steam 游戏下载 CDN 直连（steamcontent.com / steamserver.net /
  steampipe.akamaized.net，前置于 steam 规则集），DNS 同步指向国内 DoH
  以解析就近 CDN 节点；极简版同步获得该修正
- TUN 卡顿修复：`strict-route` 降级关闭（减轻全流量接管开销），
  DNS `ipv6: false`（规避国内 IPv6 链路 AAAA 查询超时）
- WeGame 无法进入修复：腾讯游戏域名（wegame / igame.qq.com / tgp.qq.com）
  直连 + 腾讯系域名族 DNS 走国内解析并豁免 fake-ip
- Cloudflare 策略反转：仅直连 cloudflareinsights.com（防广告规则误杀），
  challenges.cloudflare.com 改为跟随主站路由（保持 Turnstile 校验 IP 一致）
- 完整版零节点回退：空订阅 / 拉取失败时业务组（main / AI / Google 等）
  回退 DIRECT，配置仍可通过内核校验（对齐极简版既有行为）
- 用户自定义占位默认值置空：不再向产物注入 example.com / test.com 示例规则
- 双级校验：`node:vm` 冒烟断言（含双版规则骨架一致性 + 零节点规则出口
  检查）+ 真实内核 `mihomo -t`（含零节点边界配置，已过 v1.19.25）；
  vitest 单元测试 36 项
- CI：类型检查 → 单测 → 构建 → **内核校验（CI validation）** → 产物提交 /
  一致性检查；pnpm-lock.yaml 入库保证可复现构建

### v2.2（2026-07）

- 修复 hosts 中 `services.googleapis.cn` CNAME 映射使用数组语法（域名别名不支持数组，可能被内核忽略）
- 修复 Sniffer TLS/QUIC 的 `override-destination` 未显式启用，导致纯 IP 连接场景域名分流规则失效
- ~~修正 `nameserver-policy` 注释中关于 key 顺序的错误描述（YAML Map 无序，实际依靠 rule-set 互斥而非顺序）~~
  （勘误：该结论有误，v2.3 已确认内核以**有序 Map** 读取 `nameserver-policy` 并按书写顺序匹配，
  现依赖顺序保证 category-ntp 排在 google 族之后，详见 `src/dns.ts` 注释）
- 修正 `google-cn` 规则注释，明确其仅覆盖不在 google 集合中的纯国区域名
- 统一两个脚本的 `mergeRules` 行为（完整版改用 `startsWith("MATCH,")` 匹配，与极简版一致）

### v2.1（2026-07）

- DNS 全面重设计：respect-rules + 三级白名单 policy + 默认国际 DoH 经代理出站（修复 DNS 泄露）
- 修复 google-cn 规则顺序导致的 YouTube「未联网」、Chrome 商店卡死、页面白屏
- 修复 nameserver-policy 多规则集 key 写法导致的内核启动失败（`not found rule-set`）
- 修复 proxy-server-nameserver 不可达导致的全节点超时
- Fake-IP 黑名单精简至最小集，Rule Providers 全量迁移到 .mrs 并与远端文件名解耦
- 新增 EU / AU 地区、倍率与专线识别、节点自动排序
- 新增 Google / YouTube / AI / Steam / Apple / Microsoft 独立服务组；FCM 改走代理
- 新增极简版 simple-mihomo.js（全部 / AI / 广告拦截 三组）
- TUN / Sniffer / Runtime 更新至最新内核选项；所有配置经 mihomo v1.19.28 真实内核 `-t` 校验

---

## 致谢

本项目参考并受以下项目与社区启发：

- Mihomo / Clash Meta 核心项目（<https://github.com/MetaCubeX/mihomo>）
- sing-mix 相关规则与分流思路（<https://github.com/Sakyvo/sing-mix>）
- MetaCubeX GeoSite / GeoIP 规则集（<https://github.com/MetaCubeX/meta-rules-dat>）
- Koolson 图标资源库（<https://github.com/Koolson/Qure>）
- LinuxDO 社区的经验与最佳实践


## FlClash v3.2.2 Hybrid 分支

本分支基于 mihomo-proxy 的 Bettbox TypeScript 实现，仅参考 [Perfect-Rules](https://github.com/n0de-sudo/Perfect-Rules) 的独立服务/地区组产品能力。源码入口为 src/bettbox-main.ts；构建产物为 bettbox-flclash.js（pnpm build 自动生成，不手改）。

- 新增 GitHub、Netflix、TikTok 三个 select 服务组，默认启用。候选为 main / All / 各地区 / Other；开关关闭时规则回退 main，无节点时生成合法 DIRECT fallback，GLOBAL 包含已启用服务。Bettbox 可视化开关在 ruleOptionsEnable 和 serviceConfigs 中同步提供。
- 新增 CA、UK，顺序 HK / TW / JP / SG / KR / US / CA / UK / EU / AU / AS / Other。CA 不使用裸 CA；英国匹配从 EU 移至 UK，Other 自动排除所有已识别地区。
- GitHub / Netflix / TikTok 的 domain 和 Netflix 的 IP 规则使用 MetaCubeX meta-rules-dat .mrs、24h 更新和本地 rules 缓存；服务规则位于 Google / YouTube 后、Telegram 前，保留原有广告、自定义、基础设施、QUIC、AI 及兜底优先级。
- 保留 include-all / filter / exclude-filter / empty-fallback / proxy-providers；订阅增删节点无需重新执行脚本，不枚举节点名。
- DNS 保持 respect-rules=true、prefer-h3=false、Fake-IP、GLOBAL_DOH（Cloudflare 1.1.1.1 + Quad9 9.9.9.9）/ CN_DOH 分流、proxy-server-nameserver、direct-nameserver 和 direct-nameserver-follow-policy。github / netflix / tiktok 加入国际 nameserver-policy。DNS hijack、Sniffer、广告和 Google QUIC 保留。
- 共享 src/runtime.ts 中 strict-route = true；stack=mixed、auto-route / auto-detect-interface=true，dns-hijack 为 any:53 和 tcp://any:53，其他 TUN 参数保持原值。此共享改动应用于四个构建版本。
- CUSTOM_FILTER 默认保持通用占位配置。src/user-config.ts 提供可选示例：`/(?:日本|JAPAN|JP|🇯🇵).*?BGP\s*(?:10|[6-9])(?!\d)/i`，排除日本 BGP6~10（数字前允许空格），保留 BGP1~5。需自行替换 CUSTOM_FILTER 后重新构建。

验证：pnpm install、pnpm typecheck、pnpm test、pnpm build、pnpm verify、pnpm verify:kernel、pnpm verify:runtime。内核校验依赖可定位的 Mihomo（可设置 MIHOMO_BIN）；未找到内核的跳过输出应记录为 NOT_RUN，不作为 PASS。
