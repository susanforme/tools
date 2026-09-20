export interface ModelDocument {
  json: Record<string, unknown>;
  data: ArrayBuffer | string;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID');
  return value as Record<string, unknown>;
}
export function parseModelDocument(
  bytes: ArrayBuffer,
  binary: boolean,
): ModelDocument {
  let jsonText: string;
  if (binary) {
    const view = new DataView(bytes);
    if (
      bytes.byteLength < 20 ||
      view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== bytes.byteLength ||
      view.getUint32(16, true) !== 0x4e4f534a
    )
      throw new Error('INVALID');
    const length = view.getUint32(12, true);
    if (
      length > 4 * 1024 * 1024 ||
      length % 4 !== 0 ||
      length + 20 > bytes.byteLength
    )
      throw new Error('LIMIT');
    let offset = 12;
    while (offset < bytes.byteLength) {
      if (offset + 8 > bytes.byteLength) throw new Error('INVALID');
      const size = view.getUint32(offset, true);
      if (size % 4 !== 0 || offset + 8 + size > bytes.byteLength)
        throw new Error('INVALID');
      offset += 8 + size;
    }
    jsonText = new TextDecoder().decode(new Uint8Array(bytes, 20, length));
  } else {
    if (bytes.byteLength > 4 * 1024 * 1024) throw new Error('LIMIT');
    jsonText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  const json = record(JSON.parse(jsonText));
  if (record(json.asset).version !== '2.0') throw new Error('UNSUPPORTED');
  for (const key of [
    'nodes',
    'meshes',
    'accessors',
    'bufferViews',
    'images',
    'textures',
    'materials',
    'animations',
    'buffers',
    'scenes',
  ])
    if (
      json[key] !== undefined &&
      (!Array.isArray(json[key]) || (json[key] as unknown[]).length > 5000)
    )
      throw new Error('LIMIT');
  for (const key of ['extensionsUsed', 'extensionsRequired'])
    if (
      json[key] !== undefined &&
      (!Array.isArray(json[key]) ||
        (json[key] as unknown[]).some((v) => typeof v !== 'string'))
    )
      throw new Error('INVALID');
  const extensions = [
    ...((json.extensionsUsed as string[]) ?? []),
    ...((json.extensionsRequired as string[]) ?? []),
  ];
  if (
    extensions.some((name) =>
      [
        'KHR_draco_mesh_compression',
        'EXT_meshopt_compression',
        'KHR_texture_basisu',
      ].includes(name),
    )
  )
    throw new Error('UNSUPPORTED');
  let totalElements = 0;
  for (const accessor of (json.accessors as unknown[]) ?? []) {
    const count = record(accessor).count;
    if (typeof count === 'number') totalElements += count;
    if (totalElements > 5000000) throw new Error('LIMIT');
    if (
      typeof count !== 'number' ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > 1000000
    )
      throw new Error('LIMIT');
  }
  const nodes = ((json.nodes as unknown[]) ?? []).map(record);
  const state = new Uint8Array(nodes.length);
  function visit(index: number, depth: number): void {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= nodes.length ||
      depth > 64 ||
      state[index] === 1
    )
      throw new Error('INVALID');
    if (state[index] === 2) return;
    state[index] = 1;
    const children = nodes[index].children ?? [];
    if (!Array.isArray(children)) throw new Error('INVALID');
    for (const child of children) {
      if (typeof child !== 'number') throw new Error('INVALID');
      visit(child, depth + 1);
    }
    state[index] = 2;
  }
  nodes.forEach((_, index) => visit(index, 0));
  for (const group of ['buffers', 'images'])
    for (const item of (json[group] as unknown[]) ?? []) {
      const uri = record(item).uri;
      if (uri === undefined) continue;
      if (typeof uri !== 'string' || uri.length > 30 * 1024 * 1024)
        throw new Error('INVALID');
      if (uri.startsWith('data:')) {
        if (
          !/^data:(?:application\/(?:octet-stream|gltf-buffer)|image\/(?:png|jpeg|webp));base64,[a-zA-Z0-9+/=\s]+$/.test(
            uri,
          )
        )
          throw new Error('INVALID');
      } else if (
        /^[a-z][\w+.-]*:|^\/\//i.test(uri) ||
        uri.includes('\\') ||
        decodeURIComponent(uri).split('/').includes('..')
      )
        throw new Error('EXTERNAL');
    }
  return { json, data: binary ? bytes : jsonText };
}

export function sampleGltf(): File {
  const positions = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]);
  const uri =
    'data:application/octet-stream;base64,' +
    btoa(String.fromCharCode(...new Uint8Array(positions.buffer)));
  return new File(
    [
      JSON.stringify({
        asset: { version: '2.0' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0, name: 'Triangle' }],
        meshes: [
          { primitives: [{ attributes: { POSITION: 0 }, material: 0 }] },
        ],
        materials: [
          {
            pbrMetallicRoughness: {
              baseColorFactor: [0.2, 0.5, 0.9, 1],
              metallicFactor: 0,
              roughnessFactor: 0.7,
            },
            doubleSided: true,
          },
        ],
        buffers: [{ byteLength: 36, uri }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
        accessors: [
          {
            bufferView: 0,
            componentType: 5126,
            count: 3,
            type: 'VEC3',
            min: [-1, -1, 0],
            max: [1, 1, 0],
          },
        ],
      }),
    ],
    'sample.gltf',
    { type: 'model/gltf+json' },
  );
}
