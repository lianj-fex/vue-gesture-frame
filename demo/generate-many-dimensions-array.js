export function generateManyDimensionsArray(dimensionLengths, iterator, __prevDimensionIndex = []) {
  if (!dimensionLengths.length) {
    return iterator(__prevDimensionIndex)
  } 
  const result = []
  for (let i = 0; i < dimensionLengths[0]; i++) {
    result.push(generateManyDimensionsArray(dimensionLengths.slice(1), iterator, __prevDimensionIndex.concat(i)))
  }
  return result
}
export default generateManyDimensionsArray