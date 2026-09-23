# 新增 20 项工具

这 20 项复用现有的四个工具箱；每项可以通过 `?mode=<ID>`
直接打开。均在浏览器本地处理输入。

| 入口                    | 新增操作                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/web-diagnostics`      | `graphqlOutline` GraphQL 结构概览；`cacheAge` HTTP 缓存时效；`envReferences` 环境变量引用检查；`npmScriptGraph` 包脚本依赖检查；`packageExportsAudit` 包导出路径检查 |
| `/data-prep`            | `csvUnpivot` 宽表转长表；`csvFillDown` 空值向下填充；`csvGroupPercentiles` 分组分位数；`csvMissingDates` 日期缺口；`csvRollingAverage` 滚动平均                      |
| `/media-finishing`      | `subtitleSpeed` 字幕变速同步；`svgIds` SVG ID 加前缀；`svgAccessibility` SVG 无障碍检查；`pdfPageSizes` PDF 页面尺寸清单；`audioSilence` 音频静音区间                |
| `/planning-calculators` | `teamCapacity` 团队工时供需；`maintenanceCalendar` 维护周期日历；`stockRunway` 库存可用天数；`eventConflicts` 资源日程冲突；`workdayDeadline` 工作日截止日期         |

GraphQL 概览统计语法树，不做 schema 校验或执行成本估计；脚本依赖只识别直接的
`npm/pnpm/bun run` 调用；HTTP 缓存时效按共享缓存优先使用 `s-maxage`。SVG
ID 加前缀拒绝内嵌 CSS，以免留下未改写的选择器。音频静音检测采用 20 毫秒峰值窗口。数据整理 CSV 输入上限 2
MB、20,000 行，计划 CSV 上限 500 KB、5,000 行；音频上限 25
MB、30 分钟；PDF 上限 40 MB、500 页。
