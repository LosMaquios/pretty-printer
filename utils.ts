const { toString } = Object.prototype;

export const { toString: toStringFn } = Function.prototype;
export const { toISOString } = Date.prototype;

export function getConstructorName<T extends object>(obj: T) {
  return (
    obj.constructor.name ??
      toString.call(obj).replace(/^\[object\s|\]$/g, "")
  );
}
