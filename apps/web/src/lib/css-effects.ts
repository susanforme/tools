export type BoxShadowLayer = {
  inset: boolean;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
};

export function boxShadowCss(layers: BoxShadowLayer[]): string {
  if (layers.length === 0) return 'none';
  return layers
    .map((layer) => {
      const inset = layer.inset ? 'inset ' : '';
      return `${inset}${layer.offsetX}px ${layer.offsetY}px ${layer.blur}px ${layer.spread}px ${layer.color}`;
    })
    .join(', ');
}

export type RadiusCorners = {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
};

export function borderRadiusCss(corners: RadiusCorners, unit: 'px' | '%'): string {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;
  if (
    topLeft === topRight &&
    topRight === bottomRight &&
    bottomRight === bottomLeft
  ) {
    return `${topLeft}${unit}`;
  }
  return `${topLeft}${unit} ${topRight}${unit} ${bottomRight}${unit} ${bottomLeft}${unit}`;
}
