let _enable_debug = true;

export function enable_debug(b: boolean) {
  _enable_debug = b;
}

export function is_debug() : boolean { return _enable_debug; }

export function debug(...args: any[]) {
  if (_enable_debug) console.debug(...args);
}

export interface DumpWriter {
  writeLine(s: string);
  shift();
  unshift();
  shiftCount() : number;
}

export function CreateDumpWriter() : DumpWriter {
  let prefix = '';
  return <DumpWriter> {
    writeLine: (s) => console.log(`${prefix}${s}`),
    shift: () => prefix = prefix + '  ',
    unshift: () => prefix = prefix.slice(2),
    shiftCount: () : number => prefix.length
  }
}
