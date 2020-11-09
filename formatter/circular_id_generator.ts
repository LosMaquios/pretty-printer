export type CircularId = number;

export class CircularIdGenerator {
  /**
   * 
   */
  private _currentId: CircularId = 1;

  /**
   * 
   */
  private _generatedIds = new WeakMap<object, CircularId>();

  /**
   * 
   */
  generateId(obj: object) {
    let generatedId = this._generatedIds.get(obj);

    if (generatedId != null) {
      return generatedId;
    }

    this._generatedIds.set(
      obj,
      generatedId = this._currentId++,
    );

    return generatedId;
  }
}
