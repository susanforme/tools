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
      'JSON Merge Patch URL tracking UTM retry backoff Docker Compose 去跟踪 依赖',
  },
  {
    id: 'data-prep',
    category: 'developer',
    icon: ChartNoAxesCombined,
    color: 'text-emerald-500',
    titleKey: 'nextTools.dataTitle',
    descKey: 'nextTools.dataDescription',
    keywords:
      'CSV crosstab conflicts rules daily totals GeoJSON simplify 交叉 透视 冲突 校验 简化',
  },
  {
    id: 'media-finishing',
    category: 'video',
    icon: Clapperboard,
    color: 'text-rose-500',
    titleKey: 'nextTools.mediaTitle',
    descKey: 'nextTools.mediaDescription',
    keywords:
      '字幕 偏移 SVG 替换 PDF 矢量页码 立体声 相位 字体 字形 subtitle svg pdf stereo font',
  },
  {
    id: 'planning-calculators',
    category: 'life',
    icon: ListChecks,
    color: 'text-amber-500',
    titleKey: 'nextTools.planningTitle',
    descKey: 'nextTools.planningDescription',
    keywords:
      '关键路径 决策 敏感度 考试 倒排 订阅 预测 行李 体积 planning critical path exam budget luggage',
  },
] as const;
