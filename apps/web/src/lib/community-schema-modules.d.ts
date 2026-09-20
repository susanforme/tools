declare module '@asyncapi/parser/browser/index.js' {
  import { Parser } from '@asyncapi/parser';
  export default Parser;
}
declare module 'node-sql-parser/build/postgresql' {
  import { Parser } from 'node-sql-parser';
  export { Parser } from 'node-sql-parser';
  const module: { Parser: typeof Parser };
  export default module;
}
declare module 'node-sql-parser/build/mysql' {
  import { Parser } from 'node-sql-parser';
  export { Parser } from 'node-sql-parser';
  const module: { Parser: typeof Parser };
  export default module;
}
