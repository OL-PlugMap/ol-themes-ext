export const getLogger = () => {
    if(window.themesDebug)
        return console.log;
    return () => {};
}