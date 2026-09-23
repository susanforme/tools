import { editMp3, type MusicTags, type TagEdit } from './music-tags';
import { safeMusicName } from './media-workspace-core';
export type TaggedFile = { name: string; tags: MusicTags; cover: Blob | null };
export type TagsRequest =
  | { type: 'read'; files: File[] }
  | {
      type: 'write';
      files: File[];
      tags: MusicTags[];
      edit: TagEdit;
      pattern: string;
    };
export type TagsResponse = { files: TaggedFile[] } | { zip: Uint8Array };
self.onmessage = async (event: MessageEvent<TagsRequest>) => {
  try {
    const q = event.data;
    if (
      !q.files.length ||
      q.files.length > 20 ||
      q.files.some((f) => f.size > 50_000_000) ||
      q.files.reduce((n, f) => n + f.size, 0) > 200_000_000
    )
      throw new Error('tagLimit');
    if (q.type === 'read') {
      const { parseBlob } = await import('music-metadata');
      const files: TaggedFile[] = [];
      for (const file of q.files) {
        const { common, format } = await parseBlob(file, {
          duration: false,
          skipCovers: false,
        });
        if (format.container !== 'MPEG') throw new Error('mp3');
        const picture = common.picture?.[0];
        files.push({
          name: file.name,
          tags: {
            title: common.title ?? '',
            artist: common.artist ?? '',
            album: common.album ?? '',
            track: common.track.no?.toString() ?? '',
          },
          cover: picture
            ? new Blob([new Uint8Array(picture.data)], { type: picture.format })
            : null,
        });
      }
      self.postMessage({ result: { files } });
    } else {
      if (q.files.length !== q.tags.length) throw new Error('invalid');
      const { zipSync } = await import('fflate');
      const entries: Record<string, Uint8Array> = {};
      for (const [i, file] of q.files.entries()) {
        const tags = {
          ...q.tags[i]!,
          ...Object.fromEntries(
            Object.entries(q.edit).filter(([key]) => key !== 'cover'),
          ),
        };
        const name = safeMusicName(q.pattern, tags, file.name);
        let unique = name,
          index = 2;
        while (Object.hasOwn(entries, unique))
          unique = name.replace(/\.mp3$/i, ` (${index++}).mp3`);
        entries[unique] = await editMp3(
          new Uint8Array(await file.arrayBuffer()),
          q.edit,
        );
      }
      const zip = zipSync(entries, { level: 0 });
      self.postMessage({ result: { zip } }, [zip.buffer]);
    }
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
