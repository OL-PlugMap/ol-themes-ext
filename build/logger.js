const devnull = () => {
};
const getLogger = () => {
  if (window.themesDebug)
    return console.log;
  return devnull;
};
const getWarning = () => {
  if (!window.supressWarnings) {
    return console.warn;
  }
  return devnull;
};

export { getLogger, getWarning };
//# sourceMappingURL=logger.js.map
