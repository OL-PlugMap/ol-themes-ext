const devnull = () => {};

export const getLogger = () => {
    if(window.themesDebug)
        return console.log;
    return devnull;
}

export const getWarning = () => {
    if(!window.supressWarnings)
    {
        return console.warn;
    }
    return devnull;
}