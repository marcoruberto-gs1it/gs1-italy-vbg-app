const names: Record<string, string> = {
  EAN13: 'EAN-13',
  EAN8: 'EAN-8',
  UPCA: 'UPC-A',
  UPCE: 'UPC-E',
  Code128: 'Code 128',
  Code39: 'Code 39',
  Code93: 'Code 93',
  ITF: 'ITF',
  ITF14: 'ITF-14',
  Codabar: 'Codabar',
  DataBar: 'GS1 DataBar',
  DataBarOmni: 'GS1 DataBar',
  DataBarStk: 'GS1 DataBar Stacked',
  DataBarStkOmni: 'GS1 DataBar Stacked',
  DataBarLtd: 'GS1 DataBar Limited',
  DataBarExp: 'GS1 DataBar Expanded',
  DataBarExpStk: 'GS1 DataBar Expanded',
  QRCode: 'QR Code',
  MicroQRCode: 'Micro QR',
  RMQRCode: 'rMQR',
  DataMatrix: 'Data Matrix',
  Aztec: 'Aztec',
  PDF417: 'PDF417',
  MaxiCode: 'MaxiCode',
}

const gs1Variants: Record<string, string> = {
  ']C1': 'GS1-128',
  ']d2': 'GS1 DataMatrix',
  ']d5': 'GS1 DataMatrix',
  ']Q3': 'GS1 QR Code',
  ']Q5': 'GS1 QR Code',
  ']z1': 'GS1 Aztec',
}

export function formatName(format: string, symbologyIdentifier = '') {
  return gs1Variants[symbologyIdentifier] ?? names[format.replace(/[^A-Za-z0-9]/g, '')] ?? names[format] ?? format
}
