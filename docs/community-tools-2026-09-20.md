# 社区工具扩展（2026-09-20）

本轮按三个 subagent 与主任务拆分，20 项能力落在 9 个新页面及现有工具页中。所有数据处理在浏览器完成；可分享选项使用 query 状态，文件、密钥和输入内容不放入 URL。

| 功能 | 入口 | 范围 |
| --- | --- | --- |
| Chrome Coverage | `/chrome-coverage` | 使用区间合并、未用源码、两次报告比较 |
| React Profiler | `/react-profiler` | DevTools v5 导出，commit、组件耗时；缺名称时保留 Fiber ID |
| Git Patch | `/diff?mode=patch` | Unified Diff 左右/统一视图；不支持 binary/combined diff |
| CSS 层叠 | `/css?tab=cascade` | 原生 CSSOM 验证层、优先级、important；首个目标元素直接命中规则，不包含内联/嵌套/动画/继承来源 |
| CSP 报告 | `/csp?tab=reports` | 传统 csp-report 与 Reporting API，按资源/指令/页面汇总；5 MB，20000 条 |
| EditorConfig | `/git-tool?mode=editorconfig-match` | 多层配置、root/unset、规则来源 |
| Prometheus/OpenMetrics | `/prometheus?tab=metrics` | 经典样本文本、标签、元数据、exemplar、EOF；不支持原生直方图 |
| PromQL | `/prometheus?tab=promql` | 官方 Lezer 语法树与错误区间；不执行查询或做服务器语义校验 |
| pprof | `/pprof` | protobuf/gzip，CPU/内存热点、调用栈；Long 保留 64 位整数；未符号化数据展示地址 |
| 无障碍树 | `/html?tab=ax-tree` | 导入 AXTree，角色、名称、状态、父子层级 |
| Arrow IPC | `/arrow-viewer` | 未压缩 IPC file/stream，Schema/批次、JSON/CSV；50 MiB，前 10000 行 |
| BSON/EJSON | `/binary-data?format=bson` | 保留 Long/ObjectId 等类型的编码与解码；2 MB |
| Amazon Ion | `/binary-data?format=ion` | 文本/二进制转换，保留注解、时间戳、decimal；2 MB |
| JWE | `/jwt?mode=jwe` | dir/A256GCM，五段式解析、加解密 |
| PASETO | `/jwt?mode=paseto` | v4.local/public、footer、隐式断言、时间声明校验 |
| PKCS#12/PFX | `/certificate-tool?tab=pkcs12` | 密码、证书/私钥条目数、证书 PEM；不导出私钥、不作系统信任认证；10 MB |
| OpenPGP | `/openpgp` | 文本/文件加解密、分离签名验签、公钥指纹；20 MB |
| PCAP/PCAPNG | `/pcap-viewer` | Wireshark 显示过滤器、分页、协议树、原始数据；32 MB |
| DMARC | `/email-headers?tab=dmarc` | XML/GZ、发送源、SPF/DKIM 对齐、邮件量；解压后20 MB |
| HCL/Terraform | `/hcl-inspector` | 正式 Tree-sitter grammar、错误行列、资源/模块/变量清单；不执行配置 |

## 构建与加载

- TanStack 自动路由拆分，已有页面的新面板使用 `lazy`，大依赖使用动态 `import()`。
- `apps/web/vite.config.ts` 固定 CDN 版本：PromQL、Arrow、BSON、Ion、Tree-sitter、jose、PASETO、OpenPGP、forge。已有 protobufjs/long 外置配置继续复用。
- HCL runtime/grammar 与 Wiregasm 资源 URL 集中在 Vite 配置；只有用户执行相应功能时加载。
- Wiregasm 的原始 WASM 约 66 MB，超过 jsDelivr 单文件限制；使用约 18 MB 的官方 gzip 文件，在 Worker 中解压。开发服务的自动 Content-Encoding 解压也已兼容。
- PCAP 和性能报告在可取消 Worker 中运行，离开页面释放；CSS 输入放入受 CSP 限制的 opaque-origin iframe。

## 验证

- 全量类型检查与生产构建通过；Web Vitest 211 条、API 5 条，共 216 条测试通过。
- 生产浏览器实际导入：Coverage 双报告、React v5、pprof gzip、Patch、EditorConfig、AXTree、Arrow、PCAP/PCAPNG、PFX、DMARC gzip。
- 生产密码学验证：JWE/PASETO 加解密和错误密钥；OpenPGP 二进制文件、分离签名及篡改失败。
- 生产数据验证：BSON/Ion 往返，Arrow Int64 `9007199254740993`，PromQL/HCL 合法和非法输入。
- 回归修复：pprof 的 CDN protobufjs 必须显式配置 Long；Tree-sitter grammar 显式 fetch 字节避免浏览器 process shim 误判；安全工具输入变化后禁止异步旧结果回填。
- CSS 验证包括匿名层与 important 层顺序反转；抓包验证包括 ARP 协议详情及无效过滤语法。

## 参考来源

[Chrome Coverage](https://developer.chrome.com/docs/devtools/coverage/)、[React Profiler 格式](https://github.com/facebook/react/blob/main/packages/react-devtools-shared/src/devtools/views/Profiler/utils.js)、[CSS Cascade](https://www.w3.org/TR/css-cascade-5/)、[CSP 报告](https://developer.mozilla.org/en-US/docs/Web/API/CSPViolationReport)、[EditorConfig](https://github.com/editorconfig/editorconfig-core-js)、[diff](https://github.com/kpdecker/jsdiff)、[pprof](https://github.com/google/pprof/blob/main/proto/profile.proto)、[AXTree](https://chromedevtools.github.io/devtools-protocol/tot/Accessibility/)。

[Prometheus 文本](https://prometheus.io/docs/instrumenting/exposition_formats/)、[PromQL](https://github.com/prometheus/prometheus/tree/main/web/ui/module/lezer-promql)、[Arrow](https://github.com/apache/arrow-js)、[BSON](https://github.com/mongodb/js-bson)、[Ion](https://github.com/amazon-ion/ion-js)、[HCL grammar](https://github.com/tree-sitter-grammars/tree-sitter-hcl)。

[jose](https://github.com/panva/jose)、[PASETO](https://github.com/auth70/paseto-ts)、[forge](https://github.com/digitalbazaar/forge)、[OpenPGP.js](https://github.com/openpgpjs/openpgpjs)、[Wiregasm](https://github.com/good-tools/wiregasm)、[DMARC 报告参考](https://domainaware.github.io/parsedmarc/)。
