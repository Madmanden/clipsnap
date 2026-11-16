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

// Halve the image until it is within 2x of the target, then draw the final size.
// Scaling more than 2x in one pass skips source pixels and blurs text.
export function planDownscaleSteps(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const steps = [];
  let width = sourceWidth;
  let height = sourceHeight;

  while (width / 2 > targetWidth) {
    width = Math.round(width / 2);
    height = Math.max(1, Math.round(height / 2));
    steps.push({ width, height });
  }

  steps.push({ width: targetWidth, height: targetHeight });
  return steps;
}
