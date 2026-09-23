import {
  ChartNoAxesCombined,
  Clapperboard,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';

export const NEXT_WORKBENCHES = [
  {
    id: 'web-diagnostics',
    category: 'developer',
    icon: ShieldCheck,
    color: 'text-blue-500',
    titleKey: 'nextTools.webTitle',
    descKey: 'nextTools.webDescription',
    keywords:
      'JSON Merge Patch URL tracking UTM retry backoff Docker Compose GraphQL cache age env references npm scripts package exports 去跟踪 缓存 环境变量 脚本依赖 导出路径',
  },
  {
    id: 'data-prep',
    category: 'developer',
    icon: ChartNoAxesCombined,
    color: 'text-emerald-500',
    titleKey: 'nextTools.dataTitle',
    descKey: 'nextTools.dataDescription',
    keywords:
      'CSV crosstab conflicts rules daily totals GeoJSON simplify unpivot fill down grouped percentiles missing dates rolling average 交叉 透视 冲突 校验 简化 宽表 长表 向下填充 分位数 日期缺口 滚动平均',
  },
  {
    id: 'media-finishing',
    category: 'video',
    icon: Clapperboard,
    color: 'text-rose-500',
    titleKey: 'nextTools.mediaTitle',
    descKey: 'nextTools.mediaDescription',
    keywords:
      '字幕 偏移 变速 SVG 替换 ID 前缀 无障碍 PDF 矢量页码 页面尺寸 立体声 相位 音频 静音 字体 字形 subtitle svg pdf stereo font silence',
  },
  {
    id: 'planning-calculators',
    category: 'life',
    icon: ListChecks,
    color: 'text-amber-500',
    titleKey: 'nextTools.planningTitle',
    descKey: 'nextTools.planningDescription',
    keywords:
      '关键路径 决策 敏感度 考试 倒排 订阅 预测 行李 体积 团队 工时 维护 日历 库存 可用天数 资源 日程 冲突 工作日 截止日期 planning critical path exam budget luggage capacity maintenance stock schedule deadline',
  },
] as const;
