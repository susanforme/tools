declare module 'jstat' {
  type JStat = {
    studentt: {
      cdf(x: number, df: number): number;
      inv(p: number, df: number): number;
    };
    chisquare: { cdf(x: number, df: number): number };
    centralF: { cdf(x: number, df1: number, df2: number): number };
  };
  export const jStat: JStat;
  const defaultExport: JStat;
  export default defaultExport;
}
