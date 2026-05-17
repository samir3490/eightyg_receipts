// Amount in words (Indian numbering system)
export const numberToWords = (num: number | string): string => {
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
    'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ',
    'Seventeen ', 'Eighteen ', 'Nineteen ',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const nStr = num.toString();
  if (nStr.length > 9) return 'Value too high';

  const match = ('000000000' + nStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!match) return '';

  const getPart = (valStr: string) => {
    const val = parseInt(valStr, 10);
    if (val === 0) return '';
    return a[val] || b[parseInt(valStr[0], 10)] + ' ' + a[parseInt(valStr[1], 10)];
  };

  let str = '';
  const crore = getPart(match[1]);
  const lakh = getPart(match[2]);
  const thousand = getPart(match[3]);
  const hundred = a[parseInt(match[4], 10)];
  const tens = getPart(match[5]);

  if (crore) str += crore + 'Crore ';
  if (lakh) str += lakh + 'Lakh ';
  if (thousand) str += thousand + 'Thousand ';
  if (hundred) str += hundred + 'Hundred ';
  if (tens) str += (str !== '' ? 'and ' : '') + tens;

  return str.trim() + ' Only';
};
