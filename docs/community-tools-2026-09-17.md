# 2026-09-17 社区工具扩展

已对照现有路由去重。以下 20 项包含新增工具和现有工具增强；数据在浏览器处理。模式/筛选保留在 URL，导入内容不写入 URL。

| #   | 工具                           | 入口                                         | 社区 / 官方依据                                                                                            |
| --- | ------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Heap Snapshot 对比             | `/heap-snapshot`                             | [Chrome DevTools](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots)               |
| 2   | Chrome Trace 时间线            | `/chrome-trace`                              | [Perfetto](https://perfetto.dev/docs/)                                                                     |
| 3   | NetLog 网络日志                | `/netlog-viewer`                             | [Chromium NetLog](https://www.chromium.org/developers/design-documents/network-stack/netlog/)              |
| 4   | Playwright Trace 离线查看      | `/playwright-trace`                          | [Playwright](https://playwright.dev/docs/trace-viewer)                                                     |
| 5   | AsyncAPI 查看与校验            | `/asyncapi`                                  | [AsyncAPI Parser](https://github.com/asyncapi/parser-js)                                                   |
| 6   | CEL 表达式调试                 | `/cel`                                       | [CEL for ECMAScript](https://github.com/bufbuild/cel-es)                                                   |
| 7   | SQL 表依赖分析                 | `/sql?tab=dependencies`                      | [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser)                                        |
| 8   | SQL DDL 转 ER 图               | `/sql?tab=ddl`                               | [Mermaid ER](https://mermaid.js.org/syntax/entityRelationshipDiagram.html)                                 |
| 9   | SPDX 许可证表达式              | `/spdx-expression`                           | [jslicense](https://jslicense.github.io/)                                                                  |
| 10  | ICU 国际化文案调试             | `/i18n-checker?tab=icu`                      | [FormatJS](https://formatjs.github.io/docs/core-concepts/icu-syntax/)                                      |
| 11  | Protobuf Schema 编解码         | `/hex-inspector?tab=protobuf` 的 Schema 模式 | [Protobuf.js](https://github.com/protobufjs/protobuf.js)                                                   |
| 12  | MQTT 报文解析                  | `/mqtt-packet`                               | [MQTT.js / mqtt-packet](https://github.com/mqttjs/mqtt.js/)                                                |
| 13  | OpenSSH 公钥校验与标准指纹增强 | `/certificate-tool?tab=ssh`                  | [RFC 4253](https://www.rfc-editor.org/rfc/rfc4253)                                                         |
| 14  | RSS / Atom 查看与校验          | `/feed-inspector`                            | [RSS 2.0](https://www.rssboard.org/rss-specification)、[Atom](https://www.rfc-editor.org/rfc/rfc4287)      |
| 15  | CSS 选择器可视化增强           | `/html?tab=visual`                           | [querySelectorAll](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll)             |
| 16  | SVG Path 编辑与测量            | `/svg-toolkit?mode=path`                     | [SVG Path Editor](https://github.com/Yqnn/svg-path-editor)、[svgpath](https://github.com/fontello/svgpath) |
| 17  | BlurHash / ThumbHash 生成      | `/image-palette?tab=placeholder`             | [BlurHash](https://github.com/woltapp/blurhash)、[ThumbHash](https://github.com/evanw/thumbhash)           |
| 18  | glTF / GLB 模型检查            | `/gltf-inspector`                            | [three-gltf-viewer](https://github.com/donmccurdy/three-gltf-viewer)                                       |
| 19  | WebGPU 能力检测                | `/browser-capabilities?tab=gpu`              | [GPUWeb](https://github.com/gpuweb/gpuweb)                                                                 |
| 20  | WebCodecs 能力检测             | `/browser-capabilities?tab=codecs`           | [W3C samples](https://w3c.github.io/webcodecs/samples/)                                                    |

## 实现范围

- Heap 对比对象数量和 shallow
  size，查看入向/出向引用，不计算 dominator 或 retained size。
- Chrome Trace 支持 JSON 同步事件，不解析 Perfetto
  protobuf。Playwright 查看动作、网络和存档截图，不执行或重放 DOM。
- SQL 限 PostgreSQL /
  MySQL 的支持语法；依赖分析不推断列血缘。SPDX 只解析许可证表达式，不判断法律兼容性。
- AsyncAPI 和 Protobuf 使用本地引用；MQTT 只离线解析，不连接 broker。
- CSS 预览隔离并移除可执行内容及外部资源。glTF
  2.0 的关联资源必须一起选择；不加载 Draco、Meshopt、KTX2 压缩资源。
- WebGPU / WebCodecs 查询当前浏览器能力，不等同于性能测试。

## 拆分与加载

三组 subagent 分别负责性能、Schema/SQL、协议；主任务负责可视化和集成。路由由 TanStack 自动拆分，相关标签使用 React.lazy，计算密集任务按操作创建有限时 Worker。

本轮新增大依赖已在 `apps/web/vite.config.ts`
固定版本并走生产 CDN，包括 AsyncAPI、CEL、SQL
parser、FormatJS、Protobuf、Long、MQTT、Three.js。图片占位符及 SVG 引擎也按需加载。Three.js
addons 映射到真实的 `examples/jsm` CDN 路径。
