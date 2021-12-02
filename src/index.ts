interface Printers {
  [astFormat: string]: Printer;
}

interface Printer {
  print: () => void;
}

// function print(
//   astPath: ASTPath,
// )

export const printer: Printers = {
  'liquid-html': {
    print,
  }
}
