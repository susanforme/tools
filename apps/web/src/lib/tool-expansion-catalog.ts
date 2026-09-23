import {
  ClipboardList,
  GraduationCap,
  PaintRoller,
  Route,
  Ruler,
  Store,
  Telescope,
  Wallpaper,
} from 'lucide-react';
export const EXPANSION_TOOLS = [
  {
    id: 'home-projects',
    icon: PaintRoller,
    color: 'text-amber-500',
    titleKey: 'practicalWorkbenches.groups.home.title',
    descKey: 'practicalWorkbenches.groups.home.description',
    keywords:
      '家装 油漆 墙纸 地板 瓷砖 土壤 paint wallpaper flooring tile soil',
  },
  {
    id: 'business-calculators',
    icon: Store,
    color: 'text-emerald-500',
    titleKey: 'practicalWorkbenches.groups.business.title',
    descKey: 'practicalWorkbenches.groups.business.description',
    keywords:
      '经营 盈亏平衡 毛利 折扣 体积重量 补货 break even margin discount shipping reorder',
  },
  {
    id: 'study-planner',
    icon: GraduationCap,
    color: 'text-violet-500',
    titleKey: 'practicalWorkbenches.groups.study.title',
    descKey: 'practicalWorkbenches.groups.study.description',
    keywords: '学习 成绩 期末 绩点 阅读 时间 weighted grade final GPA reading',
  },
  {
    id: 'office-workbench',
    icon: ClipboardList,
    color: 'text-cyan-500',
    titleKey: 'practicalWorkbenches.groups.office.title',
    descKey: 'practicalWorkbenches.groups.office.description',
    keywords:
      '办公 议程 RACI 决策 盘点 清单 agenda decision inventory checklist',
  },
  {
    id: 'pattern-designer',
    icon: Wallpaper,
    color: 'text-fuchsia-500',
    titleKey: 'visualDesign.patternTitle',
    descKey: 'visualDesign.patternDesc',
    keywords: '无缝 纹样 平铺 半落 镜像 repeat pattern tile seamless',
  },
  {
    id: 'astronomy-toolbox',
    icon: Telescope,
    color: 'text-indigo-500',
    titleKey: 'scienceExpansion.astro.title',
    descKey: 'scienceExpansion.astro.description',
    keywords: '天文 月相 行星 升落 观星 夜空 astronomy moon planet',
  },
  {
    id: 'image-measure',
    icon: Ruler,
    color: 'text-orange-500',
    titleKey: 'scienceExpansion.image.title',
    descKey: 'scienceExpansion.image.description',
    keywords: '图片 测量 标定 长度 角度 面积 image measure distance area',
  },
  {
    id: 'trip-planner',
    icon: Route,
    color: 'text-teal-500',
    titleKey: 'lifeWorkspace.trip.title',
    descKey: 'lifeWorkspace.trip.description',
    keywords: '旅行 行程 交通 住宿 预算 trip itinerary travel',
  },
] as const;
export const EXPANSION_KEYWORDS: Record<string, string> = {
  '/json': '多份 样例 推断 Schema JSON lines',
  '/openapi': 'response validate 实际响应 校验 schema',
  '/csv-convert': 'CSV join 多表 关联 unmatched',
  '/data-redactor': 'git diff ZIP secret scanner 密钥 泄露',
  '/har-analyzer': '第三方 域名 请求 Cookie 隐私 HAR',
  '/font': '字体 子集 glyph subset export',
  '/subtitle-editor': '字幕 质检 CPS CPL overlap 重叠',
  '/pdf-toolkit': 'PDF 无障碍 标签 替代文本 accessibility',
  '/ebook-reader': 'EPUB 无障碍 目录 标题 accessibility',
  '/geojson': 'GPX 坡度 爬升 海拔 UTM WGS84 坐标',
  '/document-scanner': 'OCR 可搜索 扫描件 文字层 searchable scan',
  '/audio-recorder': '语音 转写 Whisper transcript timestamps SRT VTT',
  '/audio-editor':
    '音乐 标签 MP3 ID3 封面 title artist album tags LUFS 响度 true peak',
  '/piano':
    '乐谱 MusicXML 移调 分谱 sheet music score transpose MIDI 输入 监视 音符 力度 controller',
  '/image-collage': '照片书 相册 排版 出血 photobook pages bleed',
  '/video-animation': '定格 延时 帧 洋葱皮 stop motion timelapse onion',
  '/svg-toolkit':
    '可视化 编辑 图层 对齐 组合 节点 visual layers nodes path morph 形变',
  '/packaging-designer': '激光 切割 榫卯 隔板 切缝 DXF laser kerf',
  '/data-charts':
    '图表 取数 标定 对数 坐标 digitize calibrate logarithmic 分布 异常值 missing outlier',
  '/math':
    '检验 t 卡方 方差 回归 残差 相关 t-test chi square ANOVA regression correlation',
  '/logic-workbench':
    '数字 电路 门 触发器 时钟 波形 digital circuit gates DFF clock waveform',
  '/home-inventory': '保修 借还 维修 凭证 warranty loan receipt repair',
  '/recipe-scale': '成本 损耗 出品 包装 定价 recipe cost yield margin',
  '/project-planner':
    '活动 台本 分钟 人员 设备 顺延 event run sheet cue 团队 产能 工时 capacity',
  '/form-builder':
    '题库 试卷 单选 多选 判断 填空 判分 quiz question grading 问卷 回答 CSV 分布 survey',
  '/kinship': '家谱 家庭 树 亲属 GEDCOM family tree',
};
