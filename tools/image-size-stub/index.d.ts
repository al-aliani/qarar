// أنواع البديل المحلي عن image-size — تُطابق سطح الأصل (dist/index.d.ts) مبسَّطاً.
// انظر index.js للسياق الكامل وسبب وجود هذا البديل.

export interface ISizeCalculationResult {
  width?: number
  height?: number
  type?: string
}

/** يرمي دائماً — قياس أبعاد الصور غير مدعوم في هذا البديل. */
declare function imageSize(input: Uint8Array | string): ISizeCalculationResult
declare function imageSize(
  input: string,
  callback: (err: Error | null, dimensions?: ISizeCalculationResult) => void
): void

export declare const disableFS: (v: boolean) => void
export declare const disableTypes: (types: string[]) => void
export declare const setConcurrency: (c: number) => void
export declare const types: string[]

export { imageSize }
export default imageSize
