declare module 'relationship.js' {
  type RelationshipOptions = {
    text: string;
    sex?: -1 | 0 | 1;
    type?: 'default' | 'chain' | 'pair';
    reverse?: boolean;
    target?: string;
    mode?: string;
    optimal?: boolean;
  };
  export default function relationship(options: RelationshipOptions): string[];
}
