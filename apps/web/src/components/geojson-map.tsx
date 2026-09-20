import type { GeoResult } from '@/lib/geojson-tool';
import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function GeoJsonMap({
  collection,
}: {
  collection: GeoResult['collection'];
}) {
  const { t } = useTranslation();
  const element = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | null = null;
    let observer: ResizeObserver | null = null;
    setError(null);
    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')])
      .then(([L]) => {
        if (disposed || !element.current) return;
        map = L.map(element.current, {
          crs: L.CRS.EPSG4326,
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true,
        }).setView([0, 0], 1);
        L.control
          .zoom({
            zoomInTitle: t('geojson.zoomIn'),
            zoomOutTitle: t('geojson.zoomOut'),
          })
          .addTo(map);
        const layer = L.geoJSON(collection, {
          pointToLayer: (_feature, latlng) =>
            L.circleMarker(latlng, { radius: 6 }),
          onEachFeature: (feature, item) => {
            const label = document.createElement('span');
            label.textContent = String(
              feature.properties?.name ?? feature.id ?? feature.geometry.type,
            );
            item.bindTooltip(label);
          },
        }).addTo(map);
        const extent = layer.getBounds();
        if (extent.isValid())
          map.fitBounds(extent, { padding: [24, 24], maxZoom: 14 });
        observer = new ResizeObserver(() => {
          map?.invalidateSize();
          if (extent.isValid())
            map?.fitBounds(extent, { padding: [24, 24], maxZoom: 14 });
        });
        observer.observe(element.current);
      })
      .catch((cause: unknown) => {
        if (!disposed) setError((cause as Error).message);
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      map?.remove();
    };
  }, [collection, t]);
  return (
    <section className="space-y-2">
      <p className="text-sm text-muted-foreground">{t('geojson.mapNote')}</p>
      {error && (
        <p role="alert" className="break-all text-destructive">
          {t('geojson.failed', { message: error })}
        </p>
      )}
      <div
        ref={element}
        className="relative isolate z-0 h-96 w-full rounded-lg border"
        aria-label={t('geojson.map')}
      />
    </section>
  );
}
