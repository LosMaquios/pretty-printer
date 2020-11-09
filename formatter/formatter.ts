/**
 * Basic pretty-formatter
 * 
 * Inspired by: https://github.com/facebook/jest/tree/master/packages/pretty-format
 */
import { getConstructorName, toISOString, toStringFn } from "../utils.ts";
import { CircularId, CircularIdGenerator } from "./circular_id_generator.ts";

export interface FormatterOptions {
  /**
   * Indentation size. Defaults to `2`
   */
  indent?: number;

  /**
   * Max depth for nested objects. Defaults to `20`
   */
  depth?: number;

  /**
   * When to indent root content. Defaults to `false`
   */
  indentRoot?: boolean;

  /**
   * Whether to escape tab/spaces on strings. Defaults to `false`
   */
  escapeString?: boolean;

  /**
   * Wheter to show circular id during formatting. Defaults to `false`
   */
  circularId?: boolean;
}

const DENO_FN_FORMAT_INDENTATION_SIZE = 4;
const NEWLINE_REGEX = /\n/g;

const escapeChars = {
  "\n": "n",
  "\t": "t",
};

const escapeReplacerFn = (e: string) =>
  `\\${escapeChars[e as keyof typeof escapeChars]}`;

const ESCAPE_REGEX = new RegExp(
  Object.keys(escapeChars).map((e) => escapeReplacerFn(e)).join("|"),
  "g",
);

const defaultFormatterOptions: Required<FormatterOptions> = {
  indent: 2,
  depth: 20,
  indentRoot: false,
  escapeString: false,
  circularId: false,
};

export class Entry {
  constructor(
    public key: any,
    public value: any,
    public separator: string,
  ) {}
}

export class Formatter {
  /**
   * 
   */
  options: Required<FormatterOptions>;

  private get _hitMaxDepth() {
    return this._currentDepth >= this.options.depth;
  }

  constructor(
    options: FormatterOptions = {},
    /**
     * @internal
     */
    private _initialIndent: number = null as any,
    /**
     * @internal
     */
    private _skipFirstLineIdentation = false,
    /**
     * @internal
     */
    private _currentDepth = 1,
    /**
     * @internal
     */
    private _seen = new WeakMap<object, CircularId>(),
    /**
     * @internal
     */
    private _circularIdGenerator = new CircularIdGenerator(),
  ) {
    this.options = {
      ...defaultFormatterOptions,
      ...options,
    };

    this._initialIndent = this._initialIndent ?? this.options.indent;
  }

  /**
   * 
   * @param arr 
   */
  formatArray(arr: any[] | ArrayLike<any>) {
    return this._formatObjectEntries(
      arr,
      ["[", "]"],
      function* () {
        const { length } = arr;

        for (let i = 0; i < length; i++) {
          yield arr[i];
        }
      },
    );
  }

  /**
   * 
   * @param bigint 
   */
  formatBigInt(bigint: BigInt) {
    return this._formatFirstLine(`${bigint}n`);
  }

  /**
   * 
   * @param bool 
   */
  formatBoolean(bool: boolean) {
    return this._formatFirstLine(String(bool));
  }

  /**
   * 
   */
  formatCircularRef(obj: object) {
    return this._formatFirstLine(
      this._wrap(
        ["[", "]"],
        `Circular${
          this.options.circularId ? `#${this._seen.get(obj) ?? "unknown"}` : ""
        }`,
      ),
    );
  }

  /**
   * 
   * @param date 
   */
  formatDate(date: Date) {
    return this._formatFirstLine(
      `${getConstructorName(date)} { ${toISOString.call(date)} }`,
    );
  }

  /**
   * 
   * @param fn 
   */
  formatFunction(fn: (...args: any[]) => any) {
    const fnStr = toStringFn.call(fn);
    const fnLines = fnStr.split(NEWLINE_REGEX);
    const { length } = fnLines;

    if (length === 1) {
      return fnStr;
    }

    let extraIndentationCount = 0;
    const lastLineIndex = length - 1;

    // Format first fn line
    fnLines[0] = this._formatFirstLine(fnLines[0]);

    // Trim whitespaces from last line
    fnLines[lastLineIndex] = fnLines[lastLineIndex].replace(/^ +/, (ws) => {
      extraIndentationCount = ws.length;
      return this._formatWithIndent("");
    });

    if (length > 2) {
      const trimStartRegex = new RegExp(`^ {${extraIndentationCount},}`);

      for (let n = 1; n < lastLineIndex; n++) {
        fnLines[n] = fnLines[n].replace(trimStartRegex, ({ length }) => {
          const leftLength = length - extraIndentationCount;

          return this._formatWithIndent(
            "",
            this.options.indent + this._initialIndent * leftLength /
                DENO_FN_FORMAT_INDENTATION_SIZE,
          );
        });
      }
    }

    return fnLines.join("\n");
  }

  /**
   * 
   * @param iterable 
   */
  formatIterable(iterable: Iterable<any>) {
    return this._formatObjectEntries(
      iterable,
      ["{", "}"],
      iterable[Symbol.iterator].bind(iterable),
    );
  }

  /**
   * 
   * @param num 
   */
  formatNumber(num: number) {
    return this._formatFirstLine(String(num));
  }

  /**
   * 
   */
  formatNull() {
    return this._formatFirstLine("null");
  }

  /**
   * 
   * @param map 
   */
  formatMap(map: Map<any, any>) {
    return this._formatObjectEntries(
      map,
      ["{", "}"],
      function* () {
        for (const [key, value] of map) {
          yield new Entry(key, value, " => ");
        }
      },
    );
  }

  /**
   * 
   * @param obj 
   */
  formatObject(obj: Record<any, any>) {
    return this._formatObjectEntries(
      obj,
      ["{", "}"],
      function* () {
        // TODO: Support setters/getters fns

        const keys = Object.keys(obj);

        for (const key of keys) {
          yield new Entry(key, obj[key], ": ");
        }
      },
    );
  }

  /**
   * 
   * @param regex 
   */
  formatRegExp(regex: RegExp) {
    return this._formatFirstLine(String(regex));
  }

  /**
   * 
   * @param set 
   */
  formatSet(set: Set<any>) {
    return this._formatObjectEntries(
      set,
      ["{", "}"],
      function* () {
        for (const value of set) {
          yield value;
        }
      },
    );
  }

  /**
   * 
   * @param str 
   */
  formatString(str: string) {
    if (this.options.escapeString) {
      return this._formatFirstLine(
        this._wrap(
          ['"', '"'],
          str.replace(ESCAPE_REGEX, escapeReplacerFn),
        ),
      );
    }

    const lines = str.split(NEWLINE_REGEX);
    const { length } = lines;

    if (length === 1) {
      return this._formatFirstLine(
        this._wrap(['"', '"'], str),
      );
    }

    for (let n = 1; n < length; n++) {
      lines[n] = this._formatWithIndent(lines[n]);
    }

    return this._formatFirstLine(
      this._wrap(
        ["`", "`"],
        lines.join("\n"),
      ),
    );
  }

  /**
   * 
   * @param sym 
   */
  formatSymbol(sym: symbol) {
    return this._formatFirstLine(String(sym));
  }

  /**
   * 
   */
  formatUndefined() {
    return this._formatFirstLine("undefined");
  }

  /**
   * 
   * @param value 
   */
  format(value: any): string {
    const type = typeof value;

    switch (type) {
      case "bigint":
        return this.formatBigInt(value);
      case "boolean":
        return this.formatBoolean(value);
      case "function":
        return this.formatFunction(value);
      case "number":
        return this.formatNumber(value);
      case "string":
        return this.formatString(value);
      case "symbol":
        return this.formatSymbol(value);
      case "undefined":
        return this.formatUndefined();
      case "object": {
        if (value === null) {
          return this.formatNull();
        }

        if (value instanceof RegExp) {
          return this.formatRegExp(value);
        }

        if (value instanceof Date) {
          return this.formatDate(value);
        }

        if (value instanceof Map) {
          return this.formatMap(value);
        }

        if (value instanceof Set) {
          return this.formatSet(value);
        }

        if ("length" in value && typeof value.length === "number") {
          return this.formatArray(value);
        }

        if (typeof value[Symbol.iterator] === "function") {
          return this.formatIterable(value);
        }

        return this.formatObject(value);
      }
    }
  }

  private _getChildFormatter(skipFirstLineIdentation?: boolean) {
    return new Formatter(
      {
        ...this.options,
        indent: this.options.indent +
          (this.options.indentRoot ? this._initialIndent : 0),
        indentRoot: true,
      },
      this._initialIndent,
      skipFirstLineIdentation,
      this._currentDepth + 1,
      this._seen,
      this._circularIdGenerator,
    );
  }

  private _formatObjectEntries(
    obj: object,
    wrapper: [string, string],
    contentFormatter: () => Iterator<any>,
  ) {
    if (this._seen.has(obj)) {
      return this.formatCircularRef(obj);
    }

    const constructorName = getConstructorName(obj);

    if (this._hitMaxDepth) {
      return this._formatWithIndent(
        this._wrap(["[", "]"], constructorName),
      );
    }

    const seenId = this._circularIdGenerator.generateId(obj);
    this._seen.set(obj, seenId);

    let content = "";
    let item: IteratorResult<any>;
    const contentIterator = contentFormatter();

    while (!(item = contentIterator.next()).done) {
      const { value: entry } = item;
      const keyFormatter = this._getChildFormatter();

      if (!(entry instanceof Entry)) {
        content += `${keyFormatter.format(entry)},\n`;
      } else {
        const valueFormatter = this._getChildFormatter(true);

        content += this._wrap([
          keyFormatter.format(entry.key),
          `${valueFormatter.format(entry.value)},\n`,
        ], entry.separator);
      }
    }

    this._seen.delete(obj);

    return this._formatFirstLine(
      `${constructorName}${this.options.circularId ? `#${seenId}` : ""} ${
        this._wrap([
          wrapper[0],
          this.options.indentRoot
            ? this._formatWithIndent(wrapper[1])
            : wrapper[1],
        ], `\n${content}`)
      }`,
    );
  }

  private _formatWithIndent(content: string, indent = this.options.indent) {
    return `${" ".repeat(indent)}${content}`;
  }

  private _formatFirstLine(content: string) {
    return this._skipFirstLineIdentation || !this.options.indentRoot
      ? content
      : this._formatWithIndent(content);
  }

  private _wrap(
    wrapper: [string, string],
    content: string,
  ) {
    return `${wrapper[0]}${content}${wrapper[1]}`;
  }
}
