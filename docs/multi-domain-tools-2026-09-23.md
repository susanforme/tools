# 多方向工具扩展（2026-09-23）

本次新增独立入口：`/workflow-review`、`/dockerfile-review`、`/serial-monitor`。其余功能并入原页面，通过页面顶部切换；JSON Schema 推断增加逐行多样例模式。

| 原页面 | 新功能 |
| --- | --- |
| `/openapi` | 实际 JSON 响应按 Schema 校验 |
| `/csv-convert` | 两表按键关联与未匹配报告 |
| `/data-charts` | 缺失、分位数、异常值与直方图 |
| `/data-redactor` | Git diff / ZIP 密钥模式扫描 |
| `/har-analyzer` | 第三方域名、请求量、Cookie 数量与字节量 |
| `/svg-toolkit` | 同结构路径形变预览与 SVG 导出 |
| `/font` | 按字符导出 TTF / OTF 字体子集 |
| `/audio-editor` | 响度与四倍采样真峰值估算 |
| `/subtitle-editor` | 时间重叠、CPS / CPL 与过短字幕检测 |
| `/pdf-toolkit` | 页面文本、结构标签与替代文本预检 |
| `/ebook-reader` | 语言、导航目录、替代文本与标题层级预检 |
| `/form-builder` | 问卷 CSV 分布与开放题回答整理 |
| `/project-planner` | 按人员和周汇总可用工时与任务量 |
| `/geojson` | 轨迹海拔 / 坡度、WGS84 ↔ UTM 批量转换 |
| `/piano` | MIDI 输入事件日志与 CSV 导出 |

这些页面在浏览器本地处理输入文件，不上传。工作流只展开静态 Matrix，Dockerfile 缓存判断是按指令顺序的估算。PDF / EPUB 检查属于预检，不能代替完整无障碍认证。响度和真峰值为快速估算，不能代替专业广播测量。字体子集输出为 TTF 或 OTF，不编码 WOFF2。串口与 MIDI 需要兼容浏览器及用户授权；自动化验证未覆盖真实设备。轨迹坡度按相邻点计算，GPS 高程噪声会影响结果。
