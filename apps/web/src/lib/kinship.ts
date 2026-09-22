export type KinshipRequest = {
  text: string;
  sex: -1 | 0 | 1;
  reverse: boolean;
  chain: boolean;
};

export async function calculateKinship(
  request: KinshipRequest,
): Promise<string[]> {
  const text = request.text.trim();
  if (
    !text ||
    text.length > 80 ||
    text.split('的').length > 12 ||
    ![-1, 0, 1].includes(request.sex)
  )
    throw new Error('INVALID_INPUT');
  const { default: relationship } = await import('relationship.js');
  return [
    ...new Set(
      relationship({
        text,
        sex: request.sex,
        reverse: request.reverse,
        type: request.chain ? 'chain' : 'default',
      }),
    ),
  ];
}
