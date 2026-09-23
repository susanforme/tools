# 第五批社区工具扩展（2026-09-23）

本批实现 20 组能力：新增 4 个入口，另 16 组并入已有工具。数学能力继续集中在 `/math`，不恢复旧链接。文件处理和计算均在浏览器本地进行。

| # | 功能 | 入口 | 范围 |
| --- | --- | --- | --- |
| 1 | 可搜索扫描件 | `/document-scanner?section=extra` | 图片或扫描 PDF 识别、逐行校正、可选文字层 PDF |
| 2 | 语音转写 | `/audio-recorder?workbench=transcript` | 浏览器本地识别、时间戳编辑、TXT/SRT/VTT |
| 3 | 音乐标签 | `/audio-editor?workbench=tags` | MP3 ID3 标题/歌手/专辑/音轨/封面、批量改名导出 |
| 4 | 乐谱查看 | `/piano?workbench=score` | MusicXML 导入、声部分离、缩放、移调、打印 |
| 5 | 照片书 | `/image-collage?workbench=book` | 封面、多页图文、排序、出血和 PDF |
| 6 | 定格与延时 | `/video-animation?workbench=sequence` | 帧序列、逐帧时长、洋葱皮、复制帧、视频/GIF |
| 7 | 可视 SVG 编辑 | `/svg-toolkit?mode=visual` | 对象、文字、图层、对齐、组合、节点和 SVG/PNG |
| 8 | 无缝纹样 | `/pattern-designer` | 常规/半落/镜像重复、预览、单元与大图导出 |
| 9 | 激光切割结构 | `/packaging-designer?section=extra` | 板厚、切缝、指接盒、隔板、试切卡及 SVG/DXF |
| 10 | 图表图片取数 | `/data-charts?workspace=digitizer` | 三点坐标标定、线性/对数轴、点击取点、CSV |
| 11 | 统计检验与回归 | `/math?tool=tests` | t、卡方、ANOVA、相关与线性回归、残差 |
| 12 | 数字电路 | `/logic-workbench?workspace=circuit` | 门电路、输入/时钟/D 触发器、连线和时序 |
| 13 | 天文观测 | `/astronomy-toolbox` | 月相、行星高度/方位、升落、夜间时段和 ICS |
| 14 | 图片测量 | `/image-measure` | 平面标定、长度/角度/多边形面积、标注 PNG/CSV |
| 15 | 旅行行程 | `/trip-planner` | 站点、交通、住宿、时间冲突、预算、PDF/ICS |
| 16 | 保修与借还 | `/home-inventory?workspace=expanded` | 购买、保修、维修、借还、凭证和日历 |
| 17 | 配方成本 | `/recipe-scale?workspace=expanded` | 成本、损耗、出品、包装、单位成本和目标售价 |
| 18 | 活动台本 | `/project-planner?workspace=expanded` | 分钟议程、人员、设备、提示、顺延和打印 |
| 19 | 题库与试卷 | `/form-builder?workspace=expanded` | 四类题型、分类组卷、判分、题目/答案 PDF |
| 20 | 家谱 | `/kinship?workspace=expanded` | 人物关系图、亲属计算、GEDCOM 导入/导出 |

首次语音识别需下载模型；本地资源消耗和完成时间取决于设备与网络。天文时段每 10 分钟按太阳与天体高度估算，不包含天气、遮挡和光害。图片尺寸换算假定被测物与标定线共面。激光试切卡用于按实际材料和机器校准切缝。GEDCOM 导入聚焦人物和家庭关系，导入前展示未覆盖字段数量。

开发工具区另将 38 个原统一主色的图标分配了不同颜色，并同步首页卡片与导航。
