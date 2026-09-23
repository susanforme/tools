declare module 'imagetracerjs' {
  const tracer: {
    imagedataToSVG(
      image: { width: number; height: number; data: Uint8ClampedArray },
      options: Record<
        string,
        number | boolean | Array<{ r: number; g: number; b: number; a: number }>
      >,
    ): string;
  };
  export default tracer;
}
