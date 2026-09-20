export interface SbomComponent {
  id: string;
  identity: string;
  name: string;
  version: string;
  licenses: string[];
  purl: string;
}
export interface SbomEdge {
  from: string;
  to: string;
  type: string;
}
export interface SbomVulnerability {
  id: string;
  affected: string[];
  severity: string;
  state: string;
  description: string;
}
export interface SbomReport {
  format: string;
  components: SbomComponent[];
  edges: SbomEdge[];
  vulnerabilities: SbomVulnerability[];
  unresolved: number;
  omittedServices: number;
}
export interface SbomDiff {
  identity: string;
  name: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  before: string[];
  after: string[];
  beforeLicenses: string[];
  afterLicenses: string[];
  dependencyChanged: boolean;
  vulnerabilityChanged: boolean;
}
export interface SbomRequest {
  before: File;
  after?: File;
}
export interface SbomResult {
  before: SbomReport;
  after: SbomReport | null;
  changes: SbomDiff[];
}
type Obj = Record<string, unknown>;
function object(value: unknown): Obj {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('SBOM_STRUCTURE');
  return value as Obj;
}
function list(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('SBOM_STRUCTURE');
  return value;
}
function string(value: unknown, required = false): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || (required && !value))
    throw new Error('SBOM_STRUCTURE');
  return value;
}
const unique = (values: string[]) => [...new Set(values)].sort();
function packageIdentity(purl: string, group: string, name: string): string {
  if (!purl) return `name:${group}/${name}`;
  const [main, ...qualifiers] = purl.split(/(?=[?#])/);
  const at = main!.lastIndexOf('@');
  const identity = at > main!.lastIndexOf('/') ? main!.slice(0, at) : main!;
  return identity + qualifiers.join('');
}
export function parseSbom(text: string): SbomReport {
  if (new TextEncoder().encode(text).length > 5 * 1024 * 1024)
    throw new Error('LIMIT');
  let root: Obj;
  try {
    root = object(JSON.parse(text) as unknown);
  } catch {
    throw new Error('SBOM_JSON');
  }
  const cyclone = root.bomFormat === 'CycloneDX';
  const version = string(cyclone ? root.specVersion : root.spdxVersion, true);
  if (cyclone ? !/^1\.[3-7]$/.test(version) : !/^SPDX-2\.[23]$/.test(version))
    throw new Error('SBOM_FORMAT');
  const components: SbomComponent[] = [];
  const edges: SbomEdge[] = [];
  const vulnerabilities: SbomVulnerability[] = [];
  const ids = new Set<string>();
  const addComponent = (component: SbomComponent) => {
    if (ids.has(component.id)) throw new Error('DUPLICATE_ID');
    if (components.length >= 10000) throw new Error('LIMIT');
    ids.add(component.id);
    components.push(component);
  };
  const addEdge = (edge: SbomEdge) => {
    if (edges.length >= 30000) throw new Error('LIMIT');
    edges.push(edge);
  };
  if (cyclone) {
    const metadata = root.metadata === undefined ? null : object(root.metadata);
    const pending = [
      ...list(root.components),
      ...(metadata?.component ? [metadata.component] : []),
    ].map((value) => ({ value, depth: 0 }));
    while (pending.length) {
      const { value, depth } = pending.pop()!;
      if (depth > 64) throw new Error('LIMIT');
      const raw = object(value);
      const name = string(raw.name, true);
      const group = string(raw.group);
      const purl = string(raw.purl);
      const licenses = list(raw.licenses).map((license) => {
        const item = object(license);
        if (item.expression !== undefined) return string(item.expression, true);
        const l = object(item.license);
        return string(l.id ?? l.name, true);
      });
      addComponent({
        id: string(raw['bom-ref']) || `anonymous:${components.length}`,
        identity: packageIdentity(purl, group, name),
        name: group ? `${group}/${name}` : name,
        version: string(raw.version),
        licenses: unique(licenses),
        purl,
      });
      for (const child of list(raw.components))
        pending.push({ value: child, depth: depth + 1 });
    }
    for (const value of list(root.dependencies)) {
      const dep = object(value);
      const from = string(dep.ref, true);
      for (const to of list(dep.dependsOn))
        addEdge({ from, to: string(to, true), type: 'DEPENDS_ON' });
      for (const to of list(dep.provides))
        addEdge({ from, to: string(to, true), type: 'PROVIDES' });
    }
    for (const [index, value] of list(root.vulnerabilities).entries()) {
      if (index >= 10000) throw new Error('LIMIT');
      const raw = object(value);
      const analysis = raw.analysis === undefined ? null : object(raw.analysis);
      vulnerabilities.push({
        id: string(raw.id) || string(raw['bom-ref']) || `#${index + 1}`,
        affected: unique(
          list(raw.affects).map((value) => string(object(value).ref, true)),
        ),
        severity: unique(
          list(raw.ratings)
            .map((value) => string(object(value).severity))
            .filter(Boolean),
        ).join(', '),
        state: analysis ? string(analysis.state) : '',
        description: string(raw.description).slice(0, 4000),
      });
    }
  } else {
    for (const value of list(root.packages)) {
      const raw = object(value);
      const name = string(raw.name, true);
      const purl = list(raw.externalRefs)
        .map(object)
        .find((ref) => ref.referenceType === 'purl');
      const packageUrl = purl ? string(purl.referenceLocator, true) : '';
      addComponent({
        id: string(raw.SPDXID, true),
        identity: packageIdentity(packageUrl, '', name),
        name,
        version: string(raw.versionInfo),
        licenses: unique(
          [string(raw.licenseConcluded), string(raw.licenseDeclared)].filter(
            Boolean,
          ),
        ),
        purl: packageUrl,
      });
    }
    for (const value of list(root.relationships)) {
      const raw = object(value);
      addEdge({
        from: string(raw.spdxElementId, true),
        to: string(raw.relatedSpdxElement, true),
        type: string(raw.relationshipType, true),
      });
    }
  }
  const documentId = cyclone ? '' : string(root.SPDXID);
  const unresolved = new Set(
    [
      ...edges.flatMap((edge) => [edge.from, edge.to]),
      ...vulnerabilities.flatMap((v) => v.affected),
    ].filter(
      (id) =>
        !ids.has(id) &&
        id !== documentId &&
        id !== 'NONE' &&
        id !== 'NOASSERTION',
    ),
  ).size;
  return {
    format: cyclone ? `CycloneDX ${version}` : version,
    components: components.sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
    ),
    edges,
    vulnerabilities,
    unresolved,
    omittedServices: cyclone ? list(root.services).length : 0,
  };
}
export function compareSbom(before: SbomReport, after: SbomReport): SbomDiff[] {
  const group = (report: SbomReport) => {
    const map = new Map<string, SbomComponent[]>();
    for (const item of report.components) {
      const items = map.get(item.identity) ?? [];
      items.push(item);
      map.set(item.identity, items);
    }
    return map;
  };
  const a = group(before);
  const b = group(after);
  const signature = (report: SbomReport) => {
    const ids = new Map(
      report.components.map((item) => [
        item.id,
        `${item.identity}@${item.version}`,
      ]),
    );
    const edges = new Map<string, string[]>();
    for (const edge of report.edges) {
      const data = edges.get(edge.from) ?? [];
      data.push(`${edge.type}:${ids.get(edge.to) ?? edge.to}`);
      edges.set(edge.from, data);
    }
    const vulns = new Map<string, string[]>();
    for (const vuln of report.vulnerabilities)
      for (const ref of vuln.affected) {
        const data = vulns.get(ref) ?? [];
        data.push(JSON.stringify([vuln.id, vuln.severity, vuln.state]));
        vulns.set(ref, data);
      }
    return { edges, vulns };
  };
  const left = signature(before);
  const right = signature(after);
  return [...new Set([...a.keys(), ...b.keys()])].sort().map((identity) => {
    const beforeItems = a.get(identity) ?? [];
    const afterItems = b.get(identity) ?? [];
    const av = beforeItems.map((item) => item.version || '—').sort();
    const bv = afterItems.map((item) => item.version || '—').sort();
    const al = unique(beforeItems.flatMap((item) => item.licenses));
    const bl = unique(afterItems.flatMap((item) => item.licenses));
    const dependencyChanged =
      JSON.stringify(
        unique(beforeItems.flatMap((item) => left.edges.get(item.id) ?? [])),
      ) !==
      JSON.stringify(
        unique(afterItems.flatMap((item) => right.edges.get(item.id) ?? [])),
      );
    const vulnerabilityChanged =
      JSON.stringify(
        unique(beforeItems.flatMap((item) => left.vulns.get(item.id) ?? [])),
      ) !==
      JSON.stringify(
        unique(afterItems.flatMap((item) => right.vulns.get(item.id) ?? [])),
      );
    return {
      identity,
      name: (afterItems[0] ?? beforeItems[0])!.name,
      status: !beforeItems.length
        ? 'added'
        : !afterItems.length
          ? 'removed'
          : JSON.stringify([av, al]) !== JSON.stringify([bv, bl]) ||
              dependencyChanged ||
              vulnerabilityChanged
            ? 'changed'
            : 'unchanged',
      before: av,
      after: bv,
      beforeLicenses: al,
      afterLicenses: bl,
      dependencyChanged,
      vulnerabilityChanged,
    };
  });
}
