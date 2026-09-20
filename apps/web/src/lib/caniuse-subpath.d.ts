declare module 'caniuse-lite/dist/unpacker/feature' {
  import type { Feature, PackedFeature } from 'caniuse-lite';
  export default function unpackFeature(value: PackedFeature): Feature;
}
