export const SARIF_MAX_BYTES = 20 * 1024 * 1024;
export const SARIF_LEVELS = ['error', 'warning', 'note', 'none'] as const;
export type SarifLevel = (typeof SARIF_LEVELS)[number];
type JsonObject = Record<string, unknown>;
export type SarifRegion = {
  startLine: number | null;
  startColumn: number | null;
  endLine: number | null;
  endColumn: number | null;
  snippet: string;
};
export type SarifLocation = {
  id: number | null;
  uri: string;
  unresolved: boolean;
  region: SarifRegion;
  message: string;
  logicalName: string;
};
export type SarifFix = {
  description: string;
  changes: Array<{
    uri: string;
    unresolved: boolean;
    replacements: Array<{
      deletedRegion: SarifRegion;
      insertedText: string;
      binary: boolean;
    }>;
  }>;
};
export type SarifRule = {
  id: string;
  name: string;
  description: string;
  help: string;
  helpUri: string;
};
export type SarifFinding = {
  id: string;
  runIndex: number;
  resultIndex: number;
  ruleKey: string;
  ruleId: string;
  level: SarifLevel;
  kind: string;
  message: string;
  baselineState: string;
  suppressions: string[];
  locations: SarifLocation[];
  relatedLocations: SarifLocation[];
  fixes: SarifFix[];
  warnings: string[];
};
export type SarifRun = {
  index: number;
  tool: string;
  automationId: string;
  resultCount: number;
  resultsPresent: boolean;
  externalData: boolean;
};
export type SarifReport = {
  version: '2.1.0';
  runs: SarifRun[];
  rules: Record<string, SarifRule>;
  findings: SarifFinding[];
};
export type SarifFilters = {
  run: string;
  level: string;
  rule: string;
  file: string;
};

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalidFormat');
  return value as JsonObject;
}
function optionalObject(value: unknown): JsonObject {
  return value === undefined ? {} : object(value);
}
function array(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('invalidFormat');
  return value;
}
function own(value: JsonObject, key: string): unknown {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}
function text(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new Error('invalidFormat');
  return value;
}
function integer(value: unknown, minimum = 0): number | null {
  if (value === undefined) return null;
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    throw new Error('invalidFormat');
  return value;
}
function level(value: unknown): SarifLevel | null {
  if (value === undefined) return null;
  if (!SARIF_LEVELS.includes(value as SarifLevel))
    throw new Error('invalidFormat');
  return value as SarifLevel;
}
type Component = {
  data: JsonObject;
  rules: JsonObject[];
  ids: Map<string, number>;
  key: string;
};
type RuleRef = {
  component: Component;
  rule: JsonObject;
  index: number | null;
  id: string;
  unresolved: boolean;
  key: string;
};

export function parseSarif(source: string): SarifReport {
  if (new TextEncoder().encode(source).byteLength > SARIF_MAX_BYTES)
    throw new Error('sizeLimit');
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.replace(/^\uFEFF/, '')) as unknown;
  } catch {
    throw new Error('invalidJson');
  }
  const root = object(parsed);
  if (root.version !== '2.1.0') throw new Error('version');
  if (!Object.hasOwn(root, 'runs')) throw new Error('invalidFormat');
  const runs = root.runs === null ? [] : array(root.runs);
  if (runs.length > 100) throw new Error('runLimit');
  const report: SarifReport = {
    version: '2.1.0',
    runs: [],
    rules: {},
    findings: [],
  };
  let detailCount = 0;
  let characters = 0;
  const bounded = (value: string): string => {
    characters += value.length;
    if (value.length > 256 * 1024 || characters > 16 * 1024 * 1024)
      throw new Error('outputLimit');
    return value;
  };
  const detail = (): void => {
    if (++detailCount > 100_000) throw new Error('detailLimit');
  };

  runs.forEach((rawRun, runIndex) => {
    const run = object(rawRun);
    const tool = object(run.tool);
    const driver = object(tool.driver);
    if (!text(driver.name)) throw new Error('invalidFormat');
    const components = [driver, ...array(tool.extensions).map(object)].map(
      (data, index): Component => {
        const rules = array(data.rules).map(object);
        return {
          data,
          rules,
          ids: new Map(rules.map((rule, i) => [text(rule.id), i])),
          key: `${runIndex}/${index - 1}`,
        };
      },
    );
    const resolveRule = (
      reference: JsonObject,
      fallbackId = '',
      fallbackIndex: unknown = undefined,
    ): RuleRef => {
      const compRef = optionalObject(reference.toolComponent);
      const extensionIndex = integer(compRef.index, -1);
      let component = components[0];
      let unresolved = false;
      if (extensionIndex !== null) {
        component = components[extensionIndex + 1] ?? components[0];
        unresolved = !components[extensionIndex + 1];
      } else if (compRef.name !== undefined || compRef.guid !== undefined) {
        const found = components.find(
          (candidate) =>
            (compRef.name === undefined ||
              candidate.data.name === compRef.name) &&
            (compRef.guid === undefined ||
              candidate.data.guid === compRef.guid),
        );
        component = found ?? components[0];
        unresolved = !found;
      }
      unresolved ||=
        (compRef.name !== undefined && component.data.name !== compRef.name) ||
        (compRef.guid !== undefined && component.data.guid !== compRef.guid);
      const id = text(reference.id) || fallbackId;
      let index = integer(reference.index ?? fallbackIndex, -1);
      if (index === -1) index = null;
      if (index === null && id) {
        let prefix = id;
        while (prefix) {
          const found = component.ids.get(prefix);
          if (found !== undefined) {
            index = found;
            break;
          }
          const slash = prefix.lastIndexOf('/');
          prefix = slash < 0 ? '' : prefix.slice(0, slash);
        }
      }
      const rule = index === null ? {} : (component.rules[index] ?? {});
      const descriptorId = text(rule.id);
      // 未知引用明确标记，不能把另一component的规则当作已解析。
      unresolved ||=
        (!!id &&
          !!descriptorId &&
          id !== descriptorId &&
          !id.startsWith(`${descriptorId}/`)) ||
        (index !== null && !component.rules[index]) ||
        (Object.keys(rule).length === 0 &&
          !!(
            id ||
            reference.index !== undefined ||
            fallbackIndex !== undefined
          ));
      return {
        component,
        rule: unresolved ? {} : rule,
        index,
        id: id || text(rule.id),
        unresolved,
        key: `${component.key}/${index ?? `id:${id}`}${unresolved ? '/unresolved' : ''}`,
      };
    };
    const overrides = array(run.invocations).map((value) => {
      const values = new Map<string, SarifLevel>();
      array(object(value).ruleConfigurationOverrides).forEach((rawOverride) => {
        const override = object(rawOverride);
        const ref = resolveRule(object(override.descriptor));
        const overrideLevel = level(object(override.configuration).level);
        if (!ref.unresolved && overrideLevel)
          values.set(ref.key, overrideLevel);
      });
      return values;
    });
    const artifacts = array(run.artifacts).map(object);
    const bases = optionalObject(run.originalUriBaseIds);
    const logicalLocations = array(run.logicalLocations).map(object);
    const resolveUri = (
      raw: unknown,
      chain = new Set<string>(),
    ): { uri: string; unresolved: boolean } => {
      const loc = optionalObject(raw);
      const index = integer(loc.index, -1);
      let uri = text(loc.uri);
      let baseId = text(loc.uriBaseId);
      if (!uri && index !== null && index >= 0) {
        const marker = `artifact:${index}`;
        if (chain.has(marker) || chain.size > 32)
          return { uri: `[artifact:${index}]`, unresolved: true };
        const artifact = artifacts[index];
        if (!artifact) return { uri: `[artifact:${index}]`, unresolved: true };
        chain.add(marker);
        const referenced = optionalObject(artifact.location);
        uri = text(referenced.uri);
        baseId ||= text(referenced.uriBaseId);
        if (!uri && !baseId)
          return { uri: `[artifact:${index}]`, unresolved: true };
      }
      if (/^[a-z][a-z\d+.-]*:/i.test(uri)) return { uri, unresolved: false };
      if (!baseId) return { uri, unresolved: false };
      const marker = `base:${baseId}`;
      if (
        chain.has(marker) ||
        chain.size > 32 ||
        own(bases, baseId) === undefined
      )
        return { uri: `[${baseId}]/${uri}`, unresolved: true };
      chain.add(marker);
      const base = resolveUri(own(bases, baseId), chain);
      if (base.unresolved)
        return { uri: `${base.uri}${uri}`, unresolved: true };
      try {
        return { uri: new URL(uri, base.uri).href, unresolved: false };
      } catch {
        return { uri: `${base.uri}${uri}`, unresolved: true };
      }
    };
    const results = array(run.results);
    if (report.findings.length + results.length > 50_000)
      throw new Error('resultLimit');
    report.runs.push({
      index: runIndex,
      tool: bounded(text(driver.name)),
      automationId: bounded(text(optionalObject(run.automationDetails).id)),
      resultCount: results.length,
      resultsPresent: Object.hasOwn(run, 'results'),
      externalData:
        Object.keys(optionalObject(run.externalPropertyFileReferences)).length >
        0,
    });
    results.forEach((rawResult, resultIndex) => {
      const result = object(rawResult);
      const reference = optionalObject(result.rule);
      if (
        reference.id !== undefined &&
        result.ruleId !== undefined &&
        reference.id !== result.ruleId
      )
        throw new Error('invalidFormat');
      if (
        reference.index !== undefined &&
        result.ruleIndex !== undefined &&
        reference.index !== result.ruleIndex
      )
        throw new Error('invalidFormat');
      const ref = resolveRule(reference, text(result.ruleId), result.ruleIndex);
      const warnings = new Set<string>();
      if (ref.unresolved) warnings.add('unresolvedRule');
      const message = (raw: unknown, required = false): string => {
        if (raw === undefined && !required) return '';
        const value = object(raw);
        let content = text(value.text) || text(value.markdown);
        if (!content && value.id !== undefined) {
          const id = text(value.id);
          const template =
            own(optionalObject(ref.rule.messageStrings), id) ??
            own(optionalObject(ref.component.data.globalMessageStrings), id);
          if (template !== undefined)
            content =
              text(object(template).text) || text(object(template).markdown);
          else {
            content = `[${id}]`;
            warnings.add('unresolvedMessage');
          }
        }
        if (
          required &&
          value.text === undefined &&
          value.markdown === undefined &&
          value.id === undefined
        )
          throw new Error('invalidFormat');
        const args = array(value.arguments).map(text);
        let expandedLength = content.length;
        if (expandedLength > 256 * 1024) throw new Error('outputLimit');
        return bounded(
          content.replace(
            /{{|}}|{(\d+)}/g,
            (match: string, index: string | undefined) => {
              if (match === '{{') return '{';
              if (match === '}}') return '}';
              const argument =
                index === undefined ? undefined : args[Number(index)];
              if (argument === undefined) {
                warnings.add('unresolvedMessage');
                return match;
              }
              expandedLength += argument.length - match.length;
              if (expandedLength > 256 * 1024) throw new Error('outputLimit');
              return argument;
            },
          ),
        );
      };
      const region = (raw: unknown): SarifRegion => {
        const value = optionalObject(raw);
        return {
          startLine: integer(value.startLine, 1),
          startColumn: integer(value.startColumn, 1),
          endLine: integer(value.endLine, 1),
          endColumn: integer(value.endColumn, 1),
          snippet: bounded(text(optionalObject(value.snippet).text)),
        };
      };
      const artifact = (raw: unknown): { uri: string; unresolved: boolean } => {
        const resolved = resolveUri(raw);
        if (resolved.unresolved) warnings.add('unresolvedUri');
        return { ...resolved, uri: bounded(resolved.uri) };
      };
      const location = (raw: unknown): SarifLocation => {
        detail();
        const value = object(raw);
        const physical = optionalObject(value.physicalLocation);
        const logical = array(value.logicalLocations)
          .map((rawLogical) => {
            const logical = object(rawLogical);
            const index = integer(logical.index, -1);
            const resolved =
              index !== null && index >= 0
                ? { ...logicalLocations[index], ...logical }
                : logical;
            if (index !== null && index >= 0 && !logicalLocations[index])
              warnings.add('unresolvedLocation');
            return text(resolved.fullyQualifiedName) || text(resolved.name);
          })
          .filter(Boolean)
          .join(' → ');
        return {
          id: integer(value.id),
          ...artifact(physical.artifactLocation),
          region: region(physical.region ?? physical.contextRegion),
          message: message(value.message),
          logicalName: bounded(logical),
        };
      };
      const fixes = array(result.fixes).map((rawFix): SarifFix => {
        detail();
        const fix = object(rawFix);
        return {
          description: message(fix.description),
          changes: array(fix.artifactChanges).map((rawChange) => {
            detail();
            const change = object(rawChange);
            return {
              ...artifact(change.artifactLocation),
              replacements: array(change.replacements).map((rawReplacement) => {
                detail();
                const replacement = object(rawReplacement);
                const contents = optionalObject(replacement.insertedContent);
                return {
                  deletedRegion: region(replacement.deletedRegion),
                  insertedText: bounded(text(contents.text)),
                  binary: contents.binary !== undefined,
                };
              }),
            };
          }),
        };
      });
      if (!Object.hasOwn(report.rules, ref.key)) {
        const description = optionalObject(
          ref.rule.fullDescription ?? ref.rule.shortDescription,
        );
        const help = optionalObject(ref.rule.help);
        report.rules[ref.key] = {
          id: bounded(text(ref.rule.id) || ref.id),
          name: bounded(text(ref.rule.name)),
          description: bounded(
            text(description.text) || text(description.markdown),
          ),
          help: bounded(text(help.text) || text(help.markdown)),
          helpUri: bounded(text(ref.rule.helpUri)),
        };
      }
      const kind = text(result.kind) || 'fail';
      if (
        ![
          'notApplicable',
          'pass',
          'fail',
          'review',
          'open',
          'informational',
        ].includes(kind)
      )
        throw new Error('invalidFormat');
      const explicitLevel = level(result.level);
      if (kind !== 'fail' && explicitLevel !== null && explicitLevel !== 'none')
        throw new Error('invalidFormat');
      const invocationIndex = integer(
        optionalObject(result.provenance).invocationIndex,
        -1,
      );
      const effectiveLevel =
        explicitLevel ??
        (kind !== 'fail'
          ? 'none'
          : ((invocationIndex !== null
              ? overrides[invocationIndex]?.get(ref.key)
              : null) ??
            level(optionalObject(ref.rule.defaultConfiguration).level) ??
            'warning'));
      const content = message(result.message, true);
      const locations = array(result.locations).map(location);
      const relatedLocations = array(result.relatedLocations).map(location);
      report.findings.push({
        id: `${runIndex}:${resultIndex}`,
        runIndex,
        resultIndex,
        ruleKey: ref.key,
        ruleId: bounded(ref.id),
        level: effectiveLevel,
        kind: bounded(kind),
        message: content,
        baselineState: bounded(text(result.baselineState)),
        suppressions: array(result.suppressions).map((raw) => {
          const s = object(raw);
          return bounded(
            [text(s.kind), text(s.status)].filter(Boolean).join(' / '),
          );
        }),
        locations,
        relatedLocations,
        fixes,
        warnings: [...warnings],
      });
    });
  });
  return report;
}

export function filterSarifFindings(
  findings: SarifFinding[],
  filters: SarifFilters,
): SarifFinding[] {
  const rule = filters.rule.toLowerCase();
  const file = filters.file.toLowerCase();
  return findings.filter(
    (finding) =>
      (filters.run === 'all' || String(finding.runIndex) === filters.run) &&
      (filters.level === 'all' || finding.level === filters.level) &&
      (!rule || finding.ruleId.toLowerCase().includes(rule)) &&
      (!file ||
        finding.locations.some((location) =>
          location.uri.toLowerCase().includes(file),
        )),
  );
}

export function exportSarifFindings(
  report: SarifReport,
  filters: SarifFilters,
): string {
  const findings = filterSarifFindings(report.findings, filters);
  const keys = new Set(findings.map((finding) => finding.ruleKey));
  return JSON.stringify(
    {
      format: 'breeze-tools/sarif-findings-v1',
      sourceVersion: report.version,
      filters,
      runs: report.runs,
      rules: Object.fromEntries(
        Object.entries(report.rules).filter(([key]) => keys.has(key)),
      ),
      findings,
    },
    null,
    2,
  );
}
