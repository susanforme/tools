import { identified } from './life-workspace-data';
import { object, shortText, named, uniqueIds } from './organizer-tools';
import { validDay } from './organizer-records';
import { calculateKinship } from './kinship';
export type FamilyMember = {
  id: string;
  name: string;
  sex: 'M' | 'F' | 'U';
  birth: string;
  death: string;
};
export type FamilyLink = {
  id: string;
  from: string;
  to: string;
  kind: 'parent' | 'partner';
};
export type FamilyTree = { members: FamilyMember[]; links: FamilyLink[] };
function validFamilyDate(value: unknown): value is string {
  if (!shortText(value, 100)) return false;
  if (value === '') return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return validDay(value) && Number(value.slice(0, 4)) > 0;
  const atom = (date: string): boolean => {
    const match =
      /^(?:(\d{1,2}) )?(?:(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC) )?(\d{1,4})$/.exec(
        date,
      );
    if (!match || Number(match[3]) < 1 || (match[1] && !match[2])) return false;
    if (!match[1]) return true;
    return validDay(
      `${match[3].padStart(4, '0')}-${String(MONTHS.indexOf(match[2]) + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`,
    );
  };
  const range = /^(?:BET (.+) AND (.+)|FROM (.+) TO (.+))$/.exec(value);
  return range
    ? atom(range[1] ?? range[3]) && atom(range[2] ?? range[4])
    : atom(value.replace(/^(?:ABT|CAL|EST|BEF|AFT) /, ''));
}
export function validFamily(v: unknown): v is FamilyTree {
  if (
    !object(v) ||
    !Array.isArray(v.members) ||
    v.members.length > 200 ||
    !Array.isArray(v.links) ||
    v.links.length > 500 ||
    !v.members.every(identified) ||
    !uniqueIds(v.members) ||
    !v.links.every(identified) ||
    !uniqueIds(v.links) ||
    !v.members.every(
      (m) =>
        object(m) &&
        named(m.name) &&
        ['M', 'F', 'U'].includes(String(m.sex)) &&
        validFamilyDate(m.birth) &&
        validFamilyDate(m.death) &&
        !/[\r\n]/.test(String(m.birth) + String(m.death) + m.name),
    )
  )
    return false;
  const members = v.members as FamilyMember[],
    links = v.links as FamilyLink[];
  if (
    !links.every(
      (l) =>
        object(l) &&
        ['parent', 'partner'].includes(String(l.kind)) &&
        l.from !== l.to &&
        members.some((m) => m.id === l.from) &&
        members.some((m) => m.id === l.to),
    )
  )
    return false;
  const keys = links.map(
    (l) =>
      l.kind +
      ':' +
      (l.kind === 'partner'
        ? [l.from, l.to].sort().join(':')
        : `${l.from}:${l.to}`),
  );
  if (
    new Set(keys).size !== keys.length ||
    members.some(
      (m) =>
        links.filter((l) => l.kind === 'parent' && l.to === m.id).length > 2,
    )
  )
    return false;
  const active = new Set<string>(),
    done = new Set<string>();
  function walk(id: string): boolean {
    if (active.has(id)) return false;
    if (done.has(id)) return true;
    active.add(id);
    for (const l of links.filter((l) => l.kind === 'parent' && l.from === id))
      if (!walk(l.to)) return false;
    active.delete(id);
    done.add(id);
    return true;
  }
  return members.every((m) => walk(m.id));
}
export function familyPath(
  tree: FamilyTree,
  from: string,
  to: string,
): { ids: string[]; tokens: string[] } | null {
  if (
    !validFamily(tree) ||
    !tree.members.some((m) => m.id === from) ||
    !tree.members.some((m) => m.id === to)
  )
    throw Error('invalid');
  const queue = [{ ids: [from], tokens: [] as string[] }];
  const seen = new Set([from]);
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i],
      id = path.ids.at(-1)!;
    if (id === to) return path;
    if (path.ids.length > 12) continue;
    const current = tree.members.find((m) => m.id === id)!;
    const neighbors: { id: string; token: string }[] = [];
    for (const l of tree.links) {
      if (l.from === id || l.to === id) {
        const targetId = l.from === id ? l.to : l.from,
          target = tree.members.find((m) => m.id === targetId)!;
        const token =
          l.kind === 'partner'
            ? target.sex === 'M'
              ? '老公'
              : target.sex === 'F'
                ? '老婆'
                : '伴侣'
            : l.to === id
              ? target.sex === 'M'
                ? '爸爸'
                : target.sex === 'F'
                  ? '妈妈'
                  : '父母'
              : target.sex === 'M'
                ? '儿子'
                : target.sex === 'F'
                  ? '女儿'
                  : '子女';
        neighbors.push({ id: targetId, token });
      }
    }
    const parents = tree.links
      .filter((l) => l.kind === 'parent' && l.to === id)
      .map((l) => l.from);
    for (const other of tree.members) {
      if (
        other.id === id ||
        !tree.links.some(
          (l) =>
            l.kind === 'parent' &&
            parents.includes(l.from) &&
            l.to === other.id,
        )
      )
        continue;
      const older =
        validDay(current.birth) && validDay(other.birth)
          ? other.birth < current.birth
          : null;
      neighbors.unshift({
        id: other.id,
        token:
          other.sex === 'M'
            ? older === null
              ? '兄弟'
              : older
                ? '哥哥'
                : '弟弟'
            : other.sex === 'F'
              ? older === null
                ? '姐妹'
                : older
                  ? '姐姐'
                  : '妹妹'
              : '兄弟姐妹',
      });
    }
    for (const n of neighbors)
      if (!seen.has(n.id)) {
        seen.add(n.id);
        queue.push({
          ids: [...path.ids, n.id],
          tokens: [...path.tokens, n.token],
        });
      }
  }
  return null;
}
export async function familyKinship(
  tree: FamilyTree,
  from: string,
  to: string,
) {
  const path = familyPath(tree, from, to);
  if (!path) return { path: null, titles: [] };
  if (!path.tokens.length) return { path, titles: ['自己'] };
  if (path.tokens.some((t) => ['父母', '子女', '伴侣', '兄弟姐妹'].includes(t)))
    return { path, titles: [] };
  const sex = tree.members.find((m) => m.id === from)!.sex;
  return {
    path,
    titles: await calculateKinship({
      text: path.tokens.join('的'),
      sex: sex === 'M' ? 1 : sex === 'F' ? 0 : -1,
      reverse: false,
      chain: false,
    }),
  };
}
const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const gedDate = (s: string) =>
  validDay(s)
    ? `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`
    : s;
function localDate(s: string) {
  const m = /^(\d{1,2}) ([A-Z]{3}) (\d{4})$/.exec(s);
  if (!m) return s;
  const iso = `${m[3]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return validDay(iso) ? iso : s;
}
export function exportGedcom(tree: FamilyTree): string {
  if (!validFamily(tree)) throw Error('invalid');
  const ids = new Map(tree.members.map((m, i) => [m.id, `@I${i + 1}@`]));
  const groups = new Map<string, { parents: string[]; children: string[] }>();
  for (const l of tree.links.filter((l) => l.kind === 'partner')) {
    const parents = [l.from, l.to].sort();
    groups.set(parents.join('|'), { parents, children: [] });
  }
  for (const child of tree.members) {
    const parents = tree.links
      .filter((l) => l.kind === 'parent' && l.to === child.id)
      .map((l) => l.from)
      .sort();
    if (!parents.length) continue;
    const key = parents.join('|');
    const group = groups.get(key) ?? { parents, children: [] };
    group.children.push(child.id);
    groups.set(key, group);
  }
  const families = [...groups.values()];
  const lines = ['0 HEAD', '1 SOUR BREEZETOOLS', '1 GEDC', '2 VERS 7.0'];
  for (const m of tree.members) {
    lines.push(
      `0 ${ids.get(m.id)} INDI`,
      `1 NAME ${m.name.replaceAll('@', '@@')}`,
      `1 SEX ${m.sex}`,
    );
    if (m.birth) lines.push('1 BIRT', `2 DATE ${gedDate(m.birth)}`);
    if (m.death) lines.push('1 DEAT', `2 DATE ${gedDate(m.death)}`);
    families.forEach((f, i) => {
      if (f.parents.includes(m.id)) lines.push(`1 FAMS @F${i + 1}@`);
      if (f.children.includes(m.id)) lines.push(`1 FAMC @F${i + 1}@`);
    });
  }
  families.forEach((f, i) => {
    lines.push(`0 @F${i + 1}@ FAM`);
    if (
      f.parents.length === 2 &&
      !tree.links.some(
        (l) =>
          l.kind === 'partner' &&
          f.parents.includes(l.from) &&
          f.parents.includes(l.to),
      )
    )
      lines.push('1 _BREEZE_PARTNER N');
    f.parents.forEach((p, j) =>
      lines.push(`1 ${j ? 'WIFE' : 'HUSB'} ${ids.get(p)}`),
    );
    for (const child of f.children) lines.push(`1 CHIL ${ids.get(child)}`);
  });
  lines.push('0 TRLR');
  return '\ufeff' + lines.join('\r\n');
}
export function importGedcom(text: string): {
  tree: FamilyTree;
  omitted: number;
} {
  if (text.length > 1e6) throw Error('limit');
  const lines = text
    .replace(/^\ufeff/, '')
    .split(/\r?\n/)
    .filter(Boolean);
  if (
    lines.length > 20000 ||
    !lines[0]?.startsWith('0 HEAD') ||
    lines.at(-1) !== '0 TRLR'
  )
    throw Error('gedcom');
  const tree: FamilyTree = { members: [], links: [] };
  const families: {
    id: string;
    parents: string[];
    children: string[];
    partner: boolean;
  }[] = [];
  let person: FamilyMember | null = null,
    family: (typeof families)[number] | null = null,
    section = '',
    event = '';
  let omitted = 0;
  const recordIds = new Set<string>();
  for (const line of lines) {
    const match = /^(\d+) (?:(@[^@\s]+@) )?([A-Z0-9_]+)(?: (.*))?$/.exec(line);
    if (!match) throw Error('gedcom');
    const level = Number(match[1]),
      xref = match[2],
      tag = match[3],
      value = (match[4] ?? '').replaceAll('@@', '@');
    if (level > 10) throw Error('gedcom');
    if (level === 0) {
      person = null;
      family = null;
      event = '';
      section = tag;
      if (xref) {
        if (recordIds.has(xref)) throw Error('gedcom');
        recordIds.add(xref);
      }
      if (tag === 'INDI') {
        if (!xref) throw Error('gedcom');
        person = { id: xref, name: xref, sex: 'U', birth: '', death: '' };
        tree.members.push(person);
      } else if (tag === 'FAM') {
        if (!xref) throw Error('gedcom');
        family = { id: xref, parents: [], children: [], partner: true };
        families.push(family);
      } else if (!['HEAD', 'TRLR'].includes(tag)) omitted++;
      continue;
    }
    if (person) {
      if (level === 1) {
        event = tag;
        if (tag === 'NAME') person.name = value.replaceAll('/', '').trim();
        else if (tag === 'SEX')
          person.sex = value === 'M' || value === 'F' ? value : 'U';
        else if (!['BIRT', 'DEAT', 'FAMC', 'FAMS'].includes(tag)) omitted++;
      } else if (
        level === 2 &&
        tag === 'DATE' &&
        (event === 'BIRT' || event === 'DEAT')
      )
        person[event === 'BIRT' ? 'birth' : 'death'] = localDate(value);
      else omitted++;
    } else if (family) {
      if (level === 1 && ['HUSB', 'WIFE'].includes(tag))
        family.parents.push(value);
      else if (level === 1 && tag === 'CHIL') family.children.push(value);
      else if (level === 1 && tag === '_BREEZE_PARTNER')
        family.partner = value !== 'N';
      else omitted++;
    } else if (
      section === 'HEAD' &&
      tag === 'CHAR' &&
      !['UTF-8', 'ASCII'].includes(value)
    )
      throw Error('gedcomEncoding');
  }
  for (const f of families) {
    if (f.parents.length > 2) throw Error('gedcom');
    if (f.parents.length === 2 && f.partner)
      tree.links.push({
        id: `${f.id}:partner`,
        from: f.parents[0],
        to: f.parents[1],
        kind: 'partner',
      });
    for (const p of f.parents)
      for (const c of f.children)
        if (
          !tree.links.some(
            (l) => l.kind === 'parent' && l.from === p && l.to === c,
          )
        )
          tree.links.push({
            id: `${f.id}:${p}:${c}`,
            from: p,
            to: c,
            kind: 'parent',
          });
  }
  const partnerKeys = new Set<string>();
  tree.links = tree.links.filter((l) => {
    if (l.kind !== 'partner') return true;
    const key = [l.from, l.to].sort().join('|');
    if (partnerKeys.has(key)) return false;
    partnerKeys.add(key);
    return true;
  });
  if (!validFamily(tree)) throw Error('gedcom');
  return { tree, omitted };
}
