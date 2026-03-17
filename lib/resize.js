export function resolveTargetSize(sourceWidth, sourceHeight, targetWidthSetting) {
  if (targetWidthSetting == null) {
    return {
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  const computedTargetWidth =
    targetWidthSetting < 1 ? Math.max(1, Math.round(sourceWidth * targetWidthSetting)) : targetWidthSetting;

  if (sourceWidth <= computedTargetWidth) {
    return {
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  const scale = computedTargetWidth / sourceWidth;

  return {
    width: computedTargetWidth,
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}
