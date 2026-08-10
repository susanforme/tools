const DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const UNITS = ['', '拾', '佰', '仟'];
const SECTIONS = ['', '万', '亿', '兆'];

function sectionToChinese(section: number): string {
  let result = '';
  let zero = false;
  for (let i = 0; i < 4; i += 1) {
    const digit = Math.floor(section / 10 ** (3 - i)) % 10;
    if (digit === 0) {
      zero = result.length > 0;
      continue;
    }
    if (zero) {
      result += '零';
      zero = false;
    }
    result += `${DIGITS[digit]}${UNITS[3 - i]}`;
  }
  return result;
}

/** 将金额转为人民币大写（支持负数与两位小数） */
export function toRmbUppercase(amount: number): string {
  if (!Number.isFinite(amount)) throw new Error('请输入有效金额');
  if (Math.abs(amount) >= 1e16) throw new Error('金额过大');

  const negative = amount < 0;
  const absolute = Math.round(Math.abs(amount) * 100);
  if (absolute === 0) return '人民币零元整';

  const yuan = Math.floor(absolute / 100);
  const jiao = Math.floor((absolute % 100) / 10);
  const fen = absolute % 10;

  let integerPart = '';
  if (yuan === 0) {
    integerPart = '零元';
  } else {
    let remaining = yuan;
    const parts: string[] = [];
    for (let i = 0; remaining > 0 && i < SECTIONS.length; i += 1) {
      const section = remaining % 10000;
      if (section !== 0) {
        const prefix =
          remaining >= 10000 && section < 1000 ? '零' : '';
        parts.unshift(`${prefix}${sectionToChinese(section)}${SECTIONS[i]}`);
      } else if (parts.length > 0 && !parts[0]!.startsWith('零')) {
        parts.unshift('零');
      }
      remaining = Math.floor(remaining / 10000);
    }
    integerPart = `${parts.join('').replace(/零+/g, '零').replace(/零$/g, '')}元`;
  }

  let decimalPart = '';
  if (jiao === 0 && fen === 0) {
    decimalPart = '整';
  } else {
    if (jiao > 0) decimalPart += `${DIGITS[jiao]}角`;
    else if (fen > 0 && yuan > 0) decimalPart += '零';
    if (fen > 0) decimalPart += `${DIGITS[fen]}分`;
  }

  return `${negative ? '负' : ''}人民币${integerPart}${decimalPart}`;
}
