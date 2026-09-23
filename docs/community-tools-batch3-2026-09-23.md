# 第三批 20 组工具能力

新增 10 个工具入口，另 10 组能力合并到现有工具。首页、导航搜索、中英文翻译同步接入；新增入口采用不同图标颜色，浏览器已确认 10 张卡片均出现且计算颜色各不相同。数学扩展仍只使用
`/math`，不恢复已删除的旧数学链接。

| 工具入口                                     | 本次能力                                              |
| -------------------------------------------- | ----------------------------------------------------- |
| `/data-charts`                               | CSV/JSON、数据透视汇总、柱状/折线/散点/饼图、图片导出 |
| `/project-planner`                           | 看板、甘特图、里程碑、任务依赖与进度                  |
| `/form-builder`                              | 字段排序、校验、条件显示、预览、独立 HTML、答案 JSON  |
| `/document-maker`                            | 报价单/收据/装箱单、编号、金额与税额、多页 PDF        |
| `/citation-tool`                             | BibTeX/RIS/CSL-JSON 转换去重、引用与参考文献格式      |
| `/contacts-tool`                             | VCF/CSV、联系人合并、批量字段编辑                     |
| `/bookmark-manager`                          | 浏览器书签 HTML、目录、搜索、去重、合并导出           |
| `/logic-workbench`                           | 真值表、布尔化简、卡诺图、等价检查                    |
| `/algorithm-lab`                             | 排序、二分查找、BFS/Dijkstra、单步/播放、操作计数     |
| `/packaging-designer`                        | 纸盒/信封/纸袋、尺寸/粘贴边、裁切/折叠线、SVG/PDF     |
| `/math?tool=functions`                       | 函数/参数曲线、交点、切线、数值导数与积分             |
| `/resistor-code?section=electrical`          | 欧姆定律、串并联、分压、LED 限流、RC                  |
| `/sprite-sheet?studio=pixels`                | 像素画、图层、调色板、洋葱皮、逐帧编辑与 GIF          |
| `/geojson?tab=tracks`                        | GPX/KML/GeoJSON、路径合并/裁剪、距离与海拔            |
| `/gltf-inspector`                            | STL/OBJ、尺寸/缩放、面积与封闭体积，保留 GLTF         |
| `/focus-timer?tab=interval`                  | 自定义阶段、循环、Tabata、阶段提示音                  |
| `/font?tab=layout`                           | 字体配对、变量轴、间距/行高、流体字号、CSS            |
| `/audio-editor?tab=repair`                   | 归一化、淡入淡出、静音检测、速度、声道                |
| `/pdf-toolkit?mode=forms` / `mode=bookmarks` | 表单读取/填写、JSON、扁平化、自定义字体、目录编辑     |
| `/recipe-scale?mode=batch` / `mode=mold`     | 多原料缩放、烘焙百分比、水合率与模具体积换算          |

## 验证

- 生产构建、TypeScript 检查通过；`bunx vitest run apps/web --maxWorkers=2`：102 个文件、358 个测试通过。
- 数学测试覆盖表达式优先级、拒绝脚本、导数/积分、奇点、交点；浏览器 `x²` 在
  `[0,3]` 上积分为 `9`。
- LED 样本 `5 V / 2 V / 20 mA` 得到 `150 Ω / 0.06 W`；配方
  `500 g 面粉 + 350 g 水` 两倍缩放为 `1700 g`、水合率 `70%`。
- 循环计时覆盖暂停、迟到 tick、卸载清理；浏览器 1 秒运动 + 1 秒休息完成一轮。
- PDF 单测验证表单保存/扁平化、JSON 校验、中文字体提示、层级目录和原有外链目标保留。浏览器实际导出的 PDF 读回为 2 页、姓名
  `Grace Hopper`、复选框选中。上传 Arial TTF 后的 Unicode 样本 `Δοκιμή`
  也导出并读回一致，验证了生产环境 `@pdf-lib/fontkit` CDN 路径。
- 最终构建中实际导出中文 PDF 书签，读回标题 `第二章`、页码 `2`、层级 `1` 一致。
- 分组真实操作与导出记录：[媒体](./batch3-media-verification-2026-09-23.md)、[分析与设计](./batch3-analysis-verification-2026-09-23.md)、[生产力](./batch3-productivity-verification-2026-09-23.md)。

## 范围边界

- 函数表达式使用有限语法；`log` 为十进对数、`ln`
  为自然对数。计算在可终止 worker 内执行。交点为有界数值搜索，可能漏掉根；导数/积分为数值近似，奇点或不收敛时提示错误。
- 图像纵轴采用采样值 2%–98% 范围，避免渐近线压扁曲线；异常大跳跃断开显示。
- 电子计算使用理想元件公式；水合率依据用户标记的水与面粉重量，不推断其他原料的含水量；模具按等体积比例缩放。
- PDF 表单限 AcroForm，签名和其他不支持字段只读；中文等字符需上传含相应字形的 TTF/OTF 字体。单文件/字体最多 20
  MB，500 页/字段/书签、16 层目录。无法解析的原目录目标保持原始动作。
- 其他格式、大小与算法边界见各组验证记录。未验证实体打印与所有第三方 PDF 阅读器。
